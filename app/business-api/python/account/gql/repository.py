"""Direct successor to the old in-memory services.py — real Postgres queries.

This is the "business logic" layer referenced by the target architecture
(MCP tool -> GraphQL resolver -> business logic -> DB). Both mcp_tools.py and
the GraphQL resolvers in queries.py/mutations.py call into these repositories;
neither talks to SQLAlchemy directly.
"""
import logging
import random
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from credit_service_client import record_credit_event
from db.models import AccountORM, BeneficiaryORM, CardLimitRequestORM, CardORM, CardSecuritySettingsORM
from transaction_service_client import notify_transaction

# Real card-utilization thresholds a credit scoring model would actually care
# about - crossing from "elevated" into "healthy" utilization on a real
# credit card is a genuine positive signal.
UTILIZATION_HEALTHY = Decimal("30")

logger = logging.getLogger(__name__)


def _validate_account_id(account_id: str) -> None:
    if not account_id:
        raise ValueError("AccountId is empty or null")
    if not account_id.isdigit():
        raise ValueError("AccountId is not a valid number")


class AccountRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_accounts_by_user_name(self, user_name: str) -> List[AccountORM]:
        logger.info("get_accounts_by_user_name user_name=%s", user_name)
        stmt = (
            select(AccountORM)
            .where(AccountORM.user_name == user_name)
            .options(selectinload(AccountORM.payment_methods))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_account_details(self, account_id: str) -> Optional[AccountORM]:
        logger.info("get_account_details account_id=%s", account_id)
        _validate_account_id(account_id)
        stmt = (
            select(AccountORM)
            .where(AccountORM.id == account_id)
            .options(selectinload(AccountORM.payment_methods))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_registered_beneficiary(self, account_id: str) -> List[BeneficiaryORM]:
        logger.info("get_registered_beneficiary account_id=%s", account_id)
        _validate_account_id(account_id)
        stmt = select(BeneficiaryORM).where(BeneficiaryORM.account_id == account_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class CardRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_credit_cards(self, account_id: str) -> List[CardORM]:
        logger.info("get_credit_cards account_id=%s", account_id)
        _validate_account_id(account_id)
        stmt = select(CardORM).where(CardORM.account_id == account_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_card_details(self, card_id: str) -> Optional[CardORM]:
        logger.info("get_card_details card_id=%s", card_id)
        if not card_id:
            raise ValueError("CardId is empty or null")
        stmt = select(CardORM).where(CardORM.id == card_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _require_card(self, card_id: str) -> CardORM:
        if not card_id:
            raise ValueError("CardId is empty or null")
        card = await self.get_card_details(card_id)
        if card is None:
            raise RuntimeError(f"Card {card_id} not found")
        return card

    async def recharge_card(self, card_id: str, amount: float) -> CardORM:
        logger.info("recharge_card card_id=%s amount=%.2f", card_id, amount)
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")
        amount = Decimal(str(amount))
        card = await self._require_card(card_id)
        if card.type != "recharge":
            raise RuntimeError("Only recharge cards can be recharged")
        recharged_amount = card.recharged_amount or Decimal("0")
        if recharged_amount + amount > (card.limit_amount or Decimal("0")):
            raise RuntimeError("Recharge amount exceeds credit limit")
        card.recharged_amount = round(recharged_amount + amount, 2)
        card.balance = round((card.balance or Decimal("0")) + amount, 2)
        await self.session.commit()
        await self.session.refresh(card)
        # Recharging is money moving on the account just like a payment - it
        # must show up in transaction history/Dashboard/Analytics the same
        # way (BUG-004: this call didn't exist before, so recharges were
        # invisible everywhere outside the card's own balance field).
        await notify_transaction(
            account_id=card.account_id,
            description=f"Card recharge - {card.name}",
            payment_type="recharge",
            amount=float(amount),
            timestamp=datetime.now(timezone.utc).isoformat(),
            flow_type="income",
            card_id=card.id,
            category="Card Recharge",
        )
        return card

    async def pay_with_card(self, card_id: str, amount: float) -> CardORM:
        logger.info("pay_with_card card_id=%s amount=%.2f", card_id, amount)
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")
        amount = Decimal(str(amount))
        card = await self._require_card(card_id)
        balance = card.balance or Decimal("0")
        if balance < amount:
            raise RuntimeError("Insufficient available balance")
        limit_amount = card.limit_amount or Decimal("0")
        utilization_before = (balance / limit_amount * 100) if limit_amount > 0 else Decimal("0")
        card.balance = round(balance - amount, 2)
        await self.session.commit()
        await self.session.refresh(card)
        # Same gap as above (BUG-004) - a card bill payment is money leaving
        # the account exactly like processPayment's flow, but this call never
        # notified transaction-service, so it never appeared in Transaction
        # history/Dashboard/Analytics despite the card's own balance being
        # correct.
        await notify_transaction(
            account_id=card.account_id,
            description=f"Card payment - {card.name}",
            payment_type="card_payment",
            amount=float(amount),
            timestamp=datetime.now(timezone.utc).isoformat(),
            flow_type="outcome",
            card_id=card.id,
            category="Credit Card Payment",
        )

        # Paying down a real credit card's utilization is a genuine credit-
        # scoring input - only fires for type="credit" cards (a recharge card
        # is prepaid, not debt, so utilization doesn't apply to it), and only
        # when the payment actually moved utilization from elevated into
        # healthy territory, not on every single payment.
        if card.type == "credit" and limit_amount > 0:
            utilization_after = card.balance / limit_amount * 100
            if utilization_before >= UTILIZATION_HEALTHY > utilization_after:
                account = await self.session.get(AccountORM, card.account_id)
                if account is not None:
                    await record_credit_event(
                        customer_id=str(account.customer_id),
                        event_id="CE" + uuid.uuid4().hex[:12].upper(),
                        event_type="utilization_decrease",
                        impact="positive",
                        description=f"Credit utilization on {card.name} improved to {utilization_after:.1f}%",
                    )
        return card

    async def freeze_card(self, card_id: str) -> CardORM:
        card = await self._require_card(card_id)
        card.frozen = True
        await self.session.commit()
        await self.session.refresh(card)
        return card

    async def unfreeze_card(self, card_id: str) -> CardORM:
        card = await self._require_card(card_id)
        card.frozen = False
        await self.session.commit()
        await self.session.refresh(card)
        return card

    async def unblock_card(self, card_id: str) -> CardORM:
        card = await self._require_card(card_id)
        card.status = "active"
        await self.session.commit()
        await self.session.refresh(card)
        return card

    async def close_card(self, card_id: str) -> CardORM:
        """Permanently closes a card - unlike freeze (reversible) or block
        (also reversible via unblock), there is no "reopen" for a closed
        card, matching how real banks treat a customer-initiated closure.
        Requires a zero balance first, same convention as every other
        money-guard in this repository (recharge/pay_with_card)."""
        card = await self._require_card(card_id)
        if card.status == "closed":
            raise RuntimeError(f"Card {card_id} is already closed")
        balance = card.balance or Decimal("0")
        if balance > 0:
            raise RuntimeError(
                f"Cannot close card with an outstanding balance of {balance} - pay it off first"
            )
        card.status = "closed"
        card.frozen = False
        await self.session.commit()
        await self.session.refresh(card)
        return card

    async def get_security_settings(self, card_id: str) -> CardSecuritySettingsORM:
        """Returns the card's settings row, creating the (default-valued) row
        on first access - every card has settings even though nothing writes
        one at card-issuance time."""
        await self._require_card(card_id)
        stmt = select(CardSecuritySettingsORM).where(CardSecuritySettingsORM.card_id == card_id)
        result = await self.session.execute(stmt)
        settings = result.scalar_one_or_none()
        if settings is None:
            settings = CardSecuritySettingsORM(card_id=card_id)
            self.session.add(settings)
            await self.session.commit()
            await self.session.refresh(settings)
        return settings

    async def update_security_settings(
        self,
        card_id: str,
        online_transactions: Optional[bool] = None,
        international_transactions: Optional[bool] = None,
        contactless_payments: Optional[bool] = None,
        atm_withdrawals: Optional[bool] = None,
        daily_transaction_limit: Optional[float] = None,
        daily_online_limit: Optional[float] = None,
    ) -> CardSecuritySettingsORM:
        settings = await self.get_security_settings(card_id)
        if online_transactions is not None:
            settings.online_transactions = online_transactions
        if international_transactions is not None:
            settings.international_transactions = international_transactions
        if contactless_payments is not None:
            settings.contactless_payments = contactless_payments
        if atm_withdrawals is not None:
            settings.atm_withdrawals = atm_withdrawals
        if daily_transaction_limit is not None:
            settings.daily_transaction_limit = Decimal(str(daily_transaction_limit))
        if daily_online_limit is not None:
            settings.daily_online_limit = Decimal(str(daily_online_limit))
        await self.session.commit()
        await self.session.refresh(settings)
        return settings

    async def request_limit_increase(self, card_id: str, requested_limit: float) -> CardLimitRequestORM:
        card = await self._require_card(card_id)
        if requested_limit <= float(card.limit_amount or 0):
            raise ValueError("Requested limit must be greater than the current limit")
        record = CardLimitRequestORM(
            id="LIMIT" + uuid.uuid4().hex[:10].upper(),
            card_id=card_id,
            current_limit=card.limit_amount or Decimal("0"),
            requested_limit=Decimal(str(requested_limit)),
            status="under_review",
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def get_limit_requests(self, card_id: str) -> List[CardLimitRequestORM]:
        stmt = select(CardLimitRequestORM).where(CardLimitRequestORM.card_id == card_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def issue_card(
        self, account_id: str, name: str, card_type: str, circuit: str, limit_amount: float,
    ) -> CardORM:
        """Issues (and immediately activates) a new card on the account -
        there's no underwriting queue in this system, matching the existing
        Apply-for-Card UX (approval is instant)."""
        _validate_account_id(account_id)
        card = CardORM(
            id="card_" + uuid.uuid4().hex[:12],
            account_id=account_id,
            type=card_type,
            circuit=circuit,
            name=name,
            activation_date=date.today(),
            expiration_date=date.today().replace(year=date.today().year + 4),
            balance=Decimal("0"),
            number="4" + "".join(str(random.randint(0, 9)) for _ in range(15)),
            limit_amount=Decimal(str(limit_amount)),
            status="active",
            cvv=f"{random.randint(0, 999):03d}",
            frozen=False,
        )
        self.session.add(card)
        await self.session.commit()
        await self.session.refresh(card)
        return card
