import logging
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CustomerORM

logger = logging.getLogger(__name__)


class CustomerRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_customer_by_id(self, customer_id: str) -> Optional[CustomerORM]:
        logger.info("get_customer_by_id customer_id=%s", customer_id)
        try:
            cid = uuid.UUID(customer_id)
        except ValueError as exc:
            raise ValueError("customer_id is not a valid UUID") from exc
        stmt = select(CustomerORM).where(CustomerORM.id == cid)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_customer_by_email(self, email: str) -> Optional[CustomerORM]:
        logger.info("get_customer_by_email email=%s", email)
        stmt = select(CustomerORM).where(CustomerORM.email == email.lower())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def search_customers(self, query: str) -> List[CustomerORM]:
        """Admin-only operation (enforced by callers, not here) - substring match on
        email or full_name. POC scope: no pagination (only 2 demo customers exist)."""
        logger.info("search_customers query=%s", query)
        like = f"%{query.lower()}%"
        stmt = select(CustomerORM).where(
            (CustomerORM.email.ilike(like)) | (CustomerORM.full_name.ilike(like))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_contact_details(
        self, customer_id: str, phone: Optional[str] = None, full_name: Optional[str] = None
    ) -> CustomerORM:
        customer = await self.get_customer_by_id(customer_id)
        if customer is None:
            raise RuntimeError(f"Customer {customer_id} not found")
        if phone is not None:
            customer.phone = phone
        if full_name is not None:
            customer.full_name = full_name
        await self.session.commit()
        await self.session.refresh(customer)
        return customer
