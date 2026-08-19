import logging
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import TransactionORM

logger = logging.getLogger(__name__)


def _validate_account_id(account_id: str) -> None:
    if not account_id:
        raise ValueError("AccountId is empty or null")
    if not account_id.isdigit():
        raise ValueError("AccountId is not a valid number")


class TransactionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_transactions_by_recipient_name(self, account_id: str, name: str) -> List[TransactionORM]:
        logger.info("get_transactions_by_recipient_name account_id=%s name=%s", account_id, name)
        _validate_account_id(account_id)
        stmt = (
            select(TransactionORM)
            .where(TransactionORM.account_id == account_id)
            .where(TransactionORM.recipient_name.ilike(f"%{name}%"))
            .order_by(desc(TransactionORM.timestamp))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_last_transactions(self, account_id: str, limit: int = 5) -> List[TransactionORM]:
        logger.info("get_last_transactions account_id=%s limit=%s", account_id, limit)
        _validate_account_id(account_id)
        stmt = (
            select(TransactionORM)
            .where(TransactionORM.account_id == account_id)
            .order_by(desc(TransactionORM.timestamp))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_transactions_by_type(
        self,
        account_id: str,
        payment_type: Optional[str] = None,
        transaction_type: Optional[str] = None,
        card_id: Optional[str] = None,
    ) -> List[TransactionORM]:
        logger.info(
            "get_transactions_by_type account_id=%s payment_type=%s transaction_type=%s card_id=%s",
            account_id, payment_type, transaction_type, card_id,
        )
        _validate_account_id(account_id)
        stmt = select(TransactionORM).where(TransactionORM.account_id == account_id)
        if transaction_type:
            stmt = stmt.where(TransactionORM.type == transaction_type)
        if payment_type:
            stmt = stmt.where(TransactionORM.payment_type == payment_type)
        if card_id:
            stmt = stmt.where(TransactionORM.card_id == card_id)
        stmt = stmt.order_by(desc(TransactionORM.timestamp))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def notify_transaction(self, account_id: str, transaction: TransactionORM) -> TransactionORM:
        logger.info("notify_transaction account_id=%s transaction_id=%s", account_id, transaction.id)
        _validate_account_id(account_id)
        transaction.account_id = account_id
        self.session.add(transaction)
        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction
