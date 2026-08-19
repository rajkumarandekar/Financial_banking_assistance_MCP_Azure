from db.models import TransactionORM
from gql.types import TransactionType


def orm_to_transaction(row: TransactionORM) -> TransactionType:
    return TransactionType(
        id=row.id,
        description=row.description,
        type=row.type,
        flowType=row.flow_type,
        recipientName=row.recipient_name,
        recipientBankReference=row.recipient_bank_reference,
        accountId=row.account_id,
        paymentType=row.payment_type,
        amount=float(row.amount) if row.amount is not None else None,
        timestamp=row.timestamp.isoformat() if row.timestamp else None,
        cardId=row.card_id,
        category=row.category,
        status=row.status,
    )
