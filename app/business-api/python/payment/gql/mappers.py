from db.models import PaymentORM
from gql.types import PaymentType


def orm_to_payment(row: PaymentORM) -> PaymentType:
    return PaymentType(
        id=row.id,
        customerId=str(row.customer_id),
        accountId=row.account_id,
        description=row.description,
        recipientName=row.recipient_name,
        recipientBankCode=row.recipient_bank_code,
        paymentType=row.payment_type,
        amount=float(row.amount),
        cardId=row.card_id,
        category=row.category,
        status=row.status,
        failureReason=row.failure_reason,
        transactionId=row.transaction_id,
        createdAt=row.created_at.isoformat() if row.created_at else None,
    )
