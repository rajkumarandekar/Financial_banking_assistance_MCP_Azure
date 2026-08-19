from typing import Optional

import strawberry
from strawberry.types import Info

from db.models import TransactionORM
from gql import mappers
from gql.repository import TransactionRepository
from gql.types import TransactionType


@strawberry.input
class NotifyTransactionInput:
    id: str
    accountId: str
    description: Optional[str] = None
    type: Optional[str] = None
    flowType: Optional[str] = None
    recipientName: Optional[str] = None
    recipientBankReference: Optional[str] = None
    paymentType: Optional[str] = None
    amount: Optional[float] = None
    timestamp: Optional[str] = None
    cardId: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def notify_transaction(self, info: Info, input: NotifyTransactionInput) -> TransactionType:
        from datetime import datetime

        repo = TransactionRepository(info.context["db_session"])
        row = TransactionORM(
            id=input.id,
            account_id=input.accountId,
            description=input.description,
            type=input.type,
            flow_type=input.flowType,
            recipient_name=input.recipientName,
            recipient_bank_reference=input.recipientBankReference,
            payment_type=input.paymentType,
            amount=input.amount,
            timestamp=datetime.fromisoformat(input.timestamp.replace("Z", "+00:00")) if input.timestamp else datetime.now(),
            card_id=input.cardId,
            category=input.category,
            status=input.status,
        )
        saved = await repo.notify_transaction(input.accountId, row)
        return mappers.orm_to_transaction(saved)
