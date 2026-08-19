from typing import Optional

import strawberry


@strawberry.type
class TransactionType:
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
