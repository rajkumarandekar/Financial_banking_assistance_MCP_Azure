from typing import Optional

import strawberry


@strawberry.type
class PaymentType:
    id: str
    customerId: str
    accountId: str
    description: str
    recipientName: Optional[str] = None
    recipientBankCode: Optional[str] = None
    paymentType: Optional[str] = None
    amount: float
    cardId: Optional[str] = None
    category: Optional[str] = None
    status: str
    failureReason: Optional[str] = None
    transactionId: Optional[str] = None
    createdAt: Optional[str] = None
