from typing import Optional

import strawberry


@strawberry.type
class PaymentMethodSummaryType:
    id: str
    type: str
    name: Optional[str] = None
    activationDate: Optional[str] = None
    expirationDate: Optional[str] = None


@strawberry.type
class PaymentMethodType:
    id: str
    type: str
    activationDate: Optional[str] = None
    expirationDate: Optional[str] = None
    availableBalance: Optional[float] = None
    cardNumber: Optional[str] = None
    status: Optional[str] = None


@strawberry.type
class CardType:
    id: str
    type: str
    circuit: Optional[str] = None
    name: str
    activationDate: Optional[str] = None
    expirationDate: Optional[str] = None
    balance: Optional[float] = None
    rechargedAmount: Optional[float] = None
    number: Optional[str] = None
    limit: Optional[float] = None
    status: Optional[str] = None
    cvv: Optional[str] = None
    frozen: bool = False


@strawberry.type
class BeneficiaryType:
    id: str
    fullName: str
    bankCode: str
    bankName: str


@strawberry.type
class AccountType:
    id: str
    userName: str
    accountHolderFullName: str
    currency: str
    activationDate: Optional[str] = None
    balance: Optional[float] = None
    paymentMethods: Optional[list[PaymentMethodSummaryType]] = None
    # Internal ownership field, used by other services (e.g. transaction-service)
    # for cross-service ownership checks - this GraphQL API is not public-facing.
    customerId: Optional[str] = None
