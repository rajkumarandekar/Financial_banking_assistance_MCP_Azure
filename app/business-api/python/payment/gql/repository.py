import logging
import uuid
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import PaymentORM

logger = logging.getLogger(__name__)


class PaymentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_payment(
        self,
        payment_id: str,
        customer_id: str,
        account_id: str,
        description: str,
        amount: float,
        recipient_name: Optional[str] = None,
        recipient_bank_code: Optional[str] = None,
        payment_type: Optional[str] = None,
        card_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> PaymentORM:
        payment = PaymentORM(
            id=payment_id,
            customer_id=uuid.UUID(customer_id),
            account_id=account_id,
            description=description,
            recipient_name=recipient_name,
            recipient_bank_code=recipient_bank_code,
            payment_type=payment_type,
            amount=Decimal(str(amount)),
            card_id=card_id,
            category=category,
            status="processing",
        )
        self.session.add(payment)
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def get_payment(self, payment_id: str) -> Optional[PaymentORM]:
        stmt = select(PaymentORM).where(PaymentORM.id == payment_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_payments_by_customer(self, customer_id: str) -> List[PaymentORM]:
        stmt = (
            select(PaymentORM)
            .where(PaymentORM.customer_id == uuid.UUID(customer_id))
            .order_by(desc(PaymentORM.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def mark_paid(self, payment_id: str, transaction_id: str) -> PaymentORM:
        payment = await self._require(payment_id)
        payment.status = "paid"
        payment.transaction_id = transaction_id
        payment.failure_reason = None
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def mark_failed(self, payment_id: str, reason: str) -> PaymentORM:
        payment = await self._require(payment_id)
        payment.status = "failed"
        payment.failure_reason = reason
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def cancel_payment(self, payment_id: str) -> PaymentORM:
        payment = await self._require(payment_id)
        if payment.status not in ("processing", "pending"):
            raise RuntimeError(f"Payment {payment_id} cannot be cancelled from status={payment.status}")
        payment.status = "cancelled"
        await self.session.commit()
        await self.session.refresh(payment)
        return payment

    async def _require(self, payment_id: str) -> PaymentORM:
        payment = await self.get_payment(payment_id)
        if payment is None:
            raise RuntimeError(f"Payment {payment_id} not found")
        return payment
