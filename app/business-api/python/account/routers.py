from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import logging

from db.base import get_session
from gql import mappers
from gql.repository import AccountRepository, CardRepository

logger = logging.getLogger(__name__)
router = APIRouter()


class CardAmountRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount for the requested card operation")


class SecuritySettingsUpdate(BaseModel):
    onlineTransactions: Optional[bool] = None
    internationalTransactions: Optional[bool] = None
    contactlessPayments: Optional[bool] = None
    atmWithdrawals: Optional[bool] = None
    dailyTransactionLimit: Optional[float] = Field(None, gt=0)
    dailyOnlineLimit: Optional[float] = Field(None, gt=0)


class LimitIncreaseRequest(BaseModel):
    requestedLimit: float = Field(..., gt=0)


class IssueCardRequest(BaseModel):
    name: str
    type: str = Field(..., description="credit | debit | recharge")
    circuit: str = Field(..., description="visa | mastercard | amex")
    limit: float = Field(..., gt=0)


def _security_settings_to_dict(row) -> dict:
    return {
        "cardId": row.card_id,
        "onlineTransactions": row.online_transactions,
        "internationalTransactions": row.international_transactions,
        "contactlessPayments": row.contactless_payments,
        "atmWithdrawals": row.atm_withdrawals,
        "dailyTransactionLimit": float(row.daily_transaction_limit),
        "dailyOnlineLimit": float(row.daily_online_limit),
    }


def _limit_request_to_dict(row) -> dict:
    return {
        "id": row.id,
        "cardId": row.card_id,
        "currentLimit": float(row.current_limit),
        "requestedLimit": float(row.requested_limit),
        "status": row.status,
        "submittedAt": row.submitted_at.isoformat() if row.submitted_at else None,
    }


def _to_runtime_http_error(err: RuntimeError) -> HTTPException:
    message = str(err)
    if "not found" in message.lower():
        code = status.HTTP_404_NOT_FOUND
    else:
        code = status.HTTP_400_BAD_REQUEST
    return HTTPException(status_code=code, detail=message)


@router.get("/accounts/{account_id}")
async def get_account_details(account_id: str, session: AsyncSession = Depends(get_session)):
    """Return account details (balance, holder, currency, activation date)."""
    logger.info("Get account details for account_id=%s", account_id)
    try:
        account = await AccountRepository(session).get_account_details(account_id)
        if account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return mappers.orm_to_account(account)
    except ValueError as ve:
        logger.exception("Validation error while retrieving account detail")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get("/accounts/{account_id}/cards")
async def list_credit_cards(account_id: str, session: AsyncSession = Depends(get_session)):
    """Return all credit cards for a given account."""
    logger.info("List credit cards for account_id=%s", account_id)
    try:
        rows = await CardRepository(session).get_credit_cards(account_id)
        return [mappers.orm_to_card(row) for row in rows]
    except ValueError as ve:
        logger.exception("Validation error while listing cards")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get("/cards/{card_id}")
async def get_card_details(card_id: str, session: AsyncSession = Depends(get_session)):
    """Return the card details for a single identifier."""
    logger.info("Get card details for card_id=%s", card_id)
    try:
        card = await CardRepository(session).get_card_details(card_id)
        if card is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
        return mappers.orm_to_card(card)
    except ValueError as ve:
        logger.exception("Validation error while retrieving card detail")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post("/cards/{card_id}/recharge")
async def recharge_card(card_id: str, request: CardAmountRequest, session: AsyncSession = Depends(get_session)):
    """Recharge the selected card.

    The request amount must be positive."""
    logger.info("Recharge card card_id=%s amount=%.2f", card_id, request.amount)
    try:
        card = await CardRepository(session).recharge_card(card_id, request.amount)
        return mappers.orm_to_card(card)
    except ValueError as ve:
        logger.exception("Validation error during recharge")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        logger.exception("Runtime error during recharge")
        raise _to_runtime_http_error(re)


@router.post("/cards/{card_id}/pay")
async def pay_with_card(card_id: str, request: CardAmountRequest, session: AsyncSession = Depends(get_session)):
    """Record a payment and debit the available balance."""
    logger.info("Pay with card card_id=%s amount=%.2f", card_id, request.amount)
    try:
        card = await CardRepository(session).pay_with_card(card_id, request.amount)
        return mappers.orm_to_card(card)
    except ValueError as ve:
        logger.exception("Validation error during payment")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        logger.exception("Runtime error during payment")
        raise _to_runtime_http_error(re)


@router.post("/cards/{card_id}/freeze")
async def freeze_card(card_id: str, session: AsyncSession = Depends(get_session)):
    """Temporarily disables the card without changing its status."""
    logger.info("Freeze card card_id=%s", card_id)
    try:
        card = await CardRepository(session).freeze_card(card_id)
        return mappers.orm_to_card(card)
    except RuntimeError as re:
        raise _to_runtime_http_error(re)


@router.post("/cards/{card_id}/unfreeze")
async def unfreeze_card(card_id: str, session: AsyncSession = Depends(get_session)):
    logger.info("Unfreeze card card_id=%s", card_id)
    try:
        card = await CardRepository(session).unfreeze_card(card_id)
        return mappers.orm_to_card(card)
    except RuntimeError as re:
        raise _to_runtime_http_error(re)


@router.post("/cards/{card_id}/unblock")
async def unblock_card(card_id: str, session: AsyncSession = Depends(get_session)):
    """Clears a "blocked" status (e.g. after a dispute is resolved)."""
    logger.info("Unblock card card_id=%s", card_id)
    try:
        card = await CardRepository(session).unblock_card(card_id)
        return mappers.orm_to_card(card)
    except RuntimeError as re:
        raise _to_runtime_http_error(re)


@router.post("/cards/{card_id}/close")
async def close_card(card_id: str, session: AsyncSession = Depends(get_session)):
    """Permanently closes a card. Requires a zero balance; irreversible."""
    logger.info("Close card card_id=%s", card_id)
    try:
        card = await CardRepository(session).close_card(card_id)
        return mappers.orm_to_card(card)
    except RuntimeError as re:
        raise _to_runtime_http_error(re)


@router.get("/cards/{card_id}/security")
async def get_card_security(card_id: str, session: AsyncSession = Depends(get_session)):
    logger.info("Get card security settings card_id=%s", card_id)
    try:
        settings = await CardRepository(session).get_security_settings(card_id)
        return _security_settings_to_dict(settings)
    except RuntimeError as re:
        raise _to_runtime_http_error(re)


@router.put("/cards/{card_id}/security")
async def update_card_security(card_id: str, request: SecuritySettingsUpdate, session: AsyncSession = Depends(get_session)):
    logger.info("Update card security settings card_id=%s", card_id)
    try:
        settings = await CardRepository(session).update_security_settings(
            card_id,
            online_transactions=request.onlineTransactions,
            international_transactions=request.internationalTransactions,
            contactless_payments=request.contactlessPayments,
            atm_withdrawals=request.atmWithdrawals,
            daily_transaction_limit=request.dailyTransactionLimit,
            daily_online_limit=request.dailyOnlineLimit,
        )
        return _security_settings_to_dict(settings)
    except RuntimeError as re:
        raise _to_runtime_http_error(re)


@router.post("/cards/{card_id}/limit-requests")
async def request_card_limit_increase(card_id: str, request: LimitIncreaseRequest, session: AsyncSession = Depends(get_session)):
    logger.info("Request card limit increase card_id=%s requested=%.2f", card_id, request.requestedLimit)
    try:
        record = await CardRepository(session).request_limit_increase(card_id, request.requestedLimit)
        return _limit_request_to_dict(record)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise _to_runtime_http_error(re)


@router.get("/cards/{card_id}/limit-requests")
async def list_card_limit_requests(card_id: str, session: AsyncSession = Depends(get_session)):
    logger.info("List card limit requests card_id=%s", card_id)
    rows = await CardRepository(session).get_limit_requests(card_id)
    return [_limit_request_to_dict(r) for r in rows]


@router.post("/accounts/{account_id}/cards")
async def issue_card(account_id: str, request: IssueCardRequest, session: AsyncSession = Depends(get_session)):
    """Issues and immediately activates a new card on the account (no
    underwriting queue in this system)."""
    logger.info("Issue card account_id=%s name=%s", account_id, request.name)
    try:
        card = await CardRepository(session).issue_card(
            account_id, request.name, request.type, request.circuit, request.limit
        )
        return mappers.orm_to_card(card)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
