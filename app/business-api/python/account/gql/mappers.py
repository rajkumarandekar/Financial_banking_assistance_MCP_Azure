"""Translates DB rows (Decimal/date) into GraphQL-facing types (float/str).

Kept as a single explicit boundary between the DB layer and the API layer,
per the "layers must stay separate" architecture rule.
"""
from typing import Optional

from db.models import AccountORM, BeneficiaryORM, CardORM, PaymentMethodORM
from gql.types import AccountType, BeneficiaryType, CardType, PaymentMethodSummaryType, PaymentMethodType


def _date_str(value) -> Optional[str]:
    return value.isoformat() if value is not None else None


def orm_to_payment_method_summary(row: PaymentMethodORM) -> PaymentMethodSummaryType:
    return PaymentMethodSummaryType(
        id=row.id,
        type=row.type,
        name=row.name,
        activationDate=_date_str(row.activation_date),
        expirationDate=_date_str(row.expiration_date),
    )


def orm_to_payment_method(row: PaymentMethodORM) -> PaymentMethodType:
    return PaymentMethodType(
        id=row.id,
        type=row.type,
        activationDate=_date_str(row.activation_date),
        expirationDate=_date_str(row.expiration_date),
        availableBalance=float(row.available_balance) if row.available_balance is not None else None,
        cardNumber=row.card_number,
        status=row.status,
    )


def orm_to_card(row: CardORM) -> CardType:
    return CardType(
        id=row.id,
        type=row.type,
        circuit=row.circuit,
        name=row.name,
        activationDate=_date_str(row.activation_date),
        expirationDate=_date_str(row.expiration_date),
        balance=float(row.balance) if row.balance is not None else None,
        rechargedAmount=float(row.recharged_amount) if row.recharged_amount is not None else None,
        number=row.number,
        limit=float(row.limit_amount) if row.limit_amount is not None else None,
        status=row.status,
        cvv=row.cvv,
        frozen=row.frozen,
    )


def orm_to_beneficiary(row: BeneficiaryORM) -> BeneficiaryType:
    return BeneficiaryType(id=row.id, fullName=row.full_name, bankCode=row.bank_code, bankName=row.bank_name)


def orm_to_account(row: AccountORM, include_payment_methods: bool = True) -> AccountType:
    return AccountType(
        id=row.id,
        userName=row.user_name,
        accountHolderFullName=row.account_holder_full_name,
        currency=row.currency,
        activationDate=_date_str(row.activation_date),
        balance=float(row.balance) if row.balance is not None else None,
        paymentMethods=(
            [orm_to_payment_method_summary(pm) for pm in row.payment_methods] if include_payment_methods else None
        ),
        customerId=str(row.customer_id),
    )
