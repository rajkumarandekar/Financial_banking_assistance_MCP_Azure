import datetime
import uuid
from typing import Optional

import strawberry
from strawberry.types import Info

from gql import mappers
from gql.repository import PaymentRepository
from gql.types import PaymentType
from transaction_service_client import notify_transaction


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def cancel_payment(self, info: Info, payment_id: str) -> PaymentType:
        repo = PaymentRepository(info.context["db_session"])
        row = await repo.cancel_payment(payment_id)
        return mappers.orm_to_payment(row)

    @strawberry.mutation
    async def process_payment(
        self,
        info: Info,
        customer_id: str,
        account_id: str,
        description: str,
        amount: float,
        recipient_name: Optional[str] = None,
        recipient_bank_code: Optional[str] = None,
        payment_type: Optional[str] = None,
        card_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> PaymentType:
        """Same create -> notify transaction-service -> mark paid/failed flow
        as the processPayment MCP tool, minus the ownership re-derivation
        (this raw GraphQL layer trusts the caller-resolved customer_id, same
        unguarded convention as loan-service's apply_loan - ownership is only
        enforced at the MCP/AI layer in this POC, not here)."""
        repo = PaymentRepository(info.context["db_session"])
        payment = await repo.create_payment(
            payment_id="PAY" + uuid.uuid4().hex[:12].upper(),
            customer_id=customer_id,
            account_id=account_id,
            description=description,
            amount=amount,
            recipient_name=recipient_name,
            recipient_bank_code=recipient_bank_code,
            payment_type=payment_type,
            card_id=card_id,
            category=category,
        )

        # Hardcoded "paid" - a transaction only ever gets created here because
        # notify_transaction just succeeded, so that's the only status that's
        # ever actually true for it (see the MCP processPayment tool for the
        # full story - this raw GraphQL layer used to leave status unset
        # entirely, which stored NULL and caused the same kind of permanent
        # mismatch against the real payment.status).
        transaction_id = await notify_transaction(
            account_id=account_id,
            description=description,
            payment_type=payment_type,
            amount=amount,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            recipient_name=recipient_name,
            recipient_bank_code=recipient_bank_code,
            card_id=card_id,
            category=category,
            status="paid",
        )

        if transaction_id is not None:
            payment = await repo.mark_paid(payment.id, transaction_id)
        else:
            payment = await repo.mark_failed(payment.id, "Failed to record transaction in transaction-service")
        return mappers.orm_to_payment(payment)

    @strawberry.mutation
    async def retry_payment(self, info: Info, payment_id: str) -> PaymentType:
        repo = PaymentRepository(info.context["db_session"])
        payment = await repo.get_payment(payment_id)
        if payment is None:
            raise RuntimeError(f"Payment {payment_id} not found")
        if payment.status != "failed":
            raise RuntimeError(f"Payment {payment_id} is not in a failed state (status={payment.status})")

        transaction_id = await notify_transaction(
            account_id=payment.account_id,
            description=payment.description,
            payment_type=payment.payment_type,
            amount=float(payment.amount),
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            recipient_name=payment.recipient_name,
            recipient_bank_code=payment.recipient_bank_code,
            card_id=payment.card_id,
            category=payment.category,
            status="paid",
        )

        if transaction_id is not None:
            payment = await repo.mark_paid(payment_id, transaction_id)
        else:
            payment = await repo.mark_failed(payment_id, "Retry failed to record transaction in transaction-service")
        return mappers.orm_to_payment(payment)
