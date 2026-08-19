from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from typing import Optional

from db.base import get_session
from db.models import TransactionORM
from gql import mappers
from gql.repository import TransactionRepository

logger = logging.getLogger(__name__)

router = APIRouter()


class TransactionRequest(BaseModel):
    """Kept REST-compatible with the payment service's existing POST call
    (app/business-api/python/payment/services.py) until that call is migrated
    to GraphQL."""
    id: str
    description: Optional[str] = None
    type: Optional[str] = None
    flowType: Optional[str] = None
    recipientName: Optional[str] = None
    recipientBankReference: Optional[str] = None
    accountId: Optional[str] = None
    paymentType: Optional[str] = None
    amount: Optional[float] = None
    timestamp: Optional[str] = None
    cardId: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


@router.get("/{account_id}")
async def get_transactions(
    account_id: str,
    payment_type: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    card_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """Get transactions for an account. Optionally filter by payment type."""
    logger.info("Get transactions for accountid=%s payment_type=%s transaction_type=%s card_id=%s", account_id, payment_type, transaction_type, card_id)
    try:
        repo = TransactionRepository(session)
        if payment_type or transaction_type or card_id:
            rows = await repo.get_transactions_by_type(account_id, payment_type, transaction_type, card_id)
        else:
            rows = await repo.get_last_transactions(account_id, limit=1000)
        return [mappers.orm_to_transaction(row) for row in rows]
    except ValueError as ve:
        logger.exception("Validation error while getting transactions")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def notify_transaction(account_id: str, transaction: TransactionRequest, session: AsyncSession = Depends(get_session)):
    """Notify a new transaction for an account."""
    logger.info("Notify transaction for accountid=%s transaction=%s", account_id, transaction.id)
    try:
        repo = TransactionRepository(session)
        row = TransactionORM(
            id=transaction.id,
            account_id=account_id,
            description=transaction.description,
            type=transaction.type,
            flow_type=transaction.flowType,
            recipient_name=transaction.recipientName,
            recipient_bank_reference=transaction.recipientBankReference,
            payment_type=transaction.paymentType,
            amount=transaction.amount,
            timestamp=(
                datetime.fromisoformat(transaction.timestamp.replace("Z", "+00:00"))
                if transaction.timestamp
                else datetime.now()
            ),
            card_id=transaction.cardId,
            category=transaction.category,
            status=transaction.status,
        )
        await repo.notify_transaction(account_id, row)
    except ValueError as ve:
        logger.exception("Validation error while notifying transaction")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
