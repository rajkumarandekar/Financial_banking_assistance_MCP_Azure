from fastmcp import FastMCP
import logging
from typing import Annotated, Optional

from db.base import get_session_context
from gql import mappers
from gql.repository import AccountRepository, CardRepository

logger = logging.getLogger(__name__)
mcp = FastMCP("Account MCP Server")

CALLER_ARGS_DOC = (
    "callerCustomerId/callerRole are injected server-side by the backend from the "
    "caller's validated identity (see app/backend/app/tools/identity_injecting_mcp_tool.py) "
    "and are NOT controlled by the LLM/agent."
)


def _check_account_ownership(account_customer_id, caller_customer_id: Optional[str], caller_role: Optional[str]) -> None:
    """Enforce customer_id ownership independently of the backend's own enforcement
    (defense in depth: this service does not trust the caller blindly)."""
    if caller_role == "admin":
        return
    if caller_customer_id is None or str(account_customer_id) != caller_customer_id:
        raise PermissionError("Not authorized to access this account")


@mcp.tool(name="getAccountsByUserName", description="Get the list of all accounts for a specific user")
async def get_accounts_by_user_name(
    userName: Annotated[str, "username of logged user"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getAccountsByUserName called with userName=%s callerRole=%s", userName, callerRole)
    async with get_session_context() as session:
        repo = AccountRepository(session)
        rows = await repo.get_accounts_by_user_name(userName)
        visible = [row for row in rows if callerRole == "admin" or str(row.customer_id) == callerCustomerId]
        return [mappers.orm_to_account(row) for row in visible]


@mcp.tool(name="getAccountDetails", description="Get account details and available payment methods")
async def get_account_details(
    accountId: Annotated[str, "Unique identifier for the user account"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("Request to getAccountDetails with accountId: %s callerRole=%s", accountId, callerRole)
    async with get_session_context() as session:
        repo = AccountRepository(session)
        row = await repo.get_account_details(accountId)
        if row is None:
            return None
        _check_account_ownership(row.customer_id, callerCustomerId, callerRole)
        return mappers.orm_to_account(row)


@mcp.tool(name="getRegisteredBeneficiary", description="Get list of registered beneficiaries for a specific account")
async def get_registered_beneficiary(
    accountId: Annotated[str, "Unique identifier for the user account"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("Request to getRegisteredBeneficiary with accountId: %s", accountId)
    async with get_session_context() as session:
        account_repo = AccountRepository(session)
        account = await account_repo.get_account_details(accountId)
        if account is None:
            return []
        _check_account_ownership(account.customer_id, callerCustomerId, callerRole)
        rows = await account_repo.get_registered_beneficiary(accountId)
        return [mappers.orm_to_beneficiary(row) for row in rows]


@mcp.tool(name="getCreditCards", description="Get the list of credit cards bound to an account")
async def get_credit_cards(
    accountId: Annotated[str, "Unique identifier for the user account"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("Request to getCreditCards with accountId: %s", accountId)
    async with get_session_context() as session:
        account_repo = AccountRepository(session)
        account = await account_repo.get_account_details(accountId)
        if account is None:
            return []
        _check_account_ownership(account.customer_id, callerCustomerId, callerRole)
        card_repo = CardRepository(session)
        rows = await card_repo.get_credit_cards(accountId)
        return [mappers.orm_to_card(row) for row in rows]


@mcp.tool(name="getCardDetails", description="Get the details of a single credit card")
async def get_card_details(
    cardId: Annotated[str, "Unique identifier for the card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("Request to getCardDetails with cardId: %s", cardId)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        card = await card_repo.get_card_details(cardId)
        if card is None:
            return None
        account_repo = AccountRepository(session)
        account = await account_repo.get_account_details(card.account_id)
        if account is not None:
            _check_account_ownership(account.customer_id, callerCustomerId, callerRole)
        return mappers.orm_to_card(card)


async def _require_owned_card(session, card_repo: CardRepository, card_id: str, caller_customer_id, caller_role):
    """Shared lookup+ownership-check for every card-mutating tool below - the
    UI's REST endpoints reach CardRepository directly and rely on the account
    router layer for this; MCP tools have no equivalent layer, so each one
    must resolve the owning account and check ownership itself, same as
    getCardDetails already does for reads."""
    card = await card_repo.get_card_details(card_id)
    if card is None:
        raise RuntimeError(f"Card {card_id} not found")
    account_repo = AccountRepository(session)
    account = await account_repo.get_account_details(card.account_id)
    if account is not None:
        _check_account_ownership(account.customer_id, caller_customer_id, caller_role)
    return card


@mcp.tool(name="freezeCard", description="Temporarily freeze a card, blocking new transactions until unfrozen (reversible, self-service)")
async def freeze_card(
    cardId: Annotated[str, "Unique identifier for the card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("freezeCard cardId=%s", cardId)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        row = await card_repo.freeze_card(cardId)
        return mappers.orm_to_card(row)


@mcp.tool(name="unfreezeCard", description="Unfreeze a previously frozen card, restoring normal use")
async def unfreeze_card(
    cardId: Annotated[str, "Unique identifier for the card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("unfreezeCard cardId=%s", cardId)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        row = await card_repo.unfreeze_card(cardId)
        return mappers.orm_to_card(row)


@mcp.tool(name="unblockCard", description="Clear a card's blocked status (e.g. after a dispute is resolved), returning it to active")
async def unblock_card(
    cardId: Annotated[str, "Unique identifier for the card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("unblockCard cardId=%s", cardId)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        row = await card_repo.unblock_card(cardId)
        return mappers.orm_to_card(row)


@mcp.tool(name="closeCard", description="Permanently close a card - irreversible, requires the card's balance to be zero first")
async def close_card(
    cardId: Annotated[str, "Unique identifier for the card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("closeCard cardId=%s", cardId)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        row = await card_repo.close_card(cardId)
        return mappers.orm_to_card(row)


@mcp.tool(name="payWithCard", description="Pay down a card's balance from the card's own available balance")
async def pay_with_card(
    cardId: Annotated[str, "Unique identifier for the card"],
    amount: Annotated[float, "Amount to pay, must be greater than zero"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("payWithCard cardId=%s amount=%s", cardId, amount)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        row = await card_repo.pay_with_card(cardId, amount)
        return mappers.orm_to_card(row)


@mcp.tool(name="rechargeCard", description="Add funds to a prepaid recharge-type card (not applicable to credit/debit cards)")
async def recharge_card(
    cardId: Annotated[str, "Unique identifier for the card"],
    amount: Annotated[float, "Amount to recharge, must be greater than zero"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("rechargeCard cardId=%s amount=%s", cardId, amount)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        row = await card_repo.recharge_card(cardId, amount)
        return mappers.orm_to_card(row)


@mcp.tool(name="getCardSecuritySettings", description="Get a card's security settings (online/international/contactless/ATM toggles and spend limits)")
async def get_card_security_settings(
    cardId: Annotated[str, "Unique identifier for the card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("getCardSecuritySettings cardId=%s", cardId)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        settings = await card_repo.get_security_settings(cardId)
        return {
            "cardId": settings.card_id,
            "onlineTransactions": settings.online_transactions,
            "internationalTransactions": settings.international_transactions,
            "contactlessPayments": settings.contactless_payments,
            "atmWithdrawals": settings.atm_withdrawals,
            "dailyTransactionLimit": float(settings.daily_transaction_limit),
            "dailyOnlineLimit": float(settings.daily_online_limit),
        }


@mcp.tool(name="updateCardSecuritySettings", description="Update a card's security settings - only pass the fields being changed, leave the rest unset")
async def update_card_security_settings(
    cardId: Annotated[str, "Unique identifier for the card"],
    onlineTransactions: Annotated[Optional[bool], "Allow online transactions"] = None,
    internationalTransactions: Annotated[Optional[bool], "Allow international transactions"] = None,
    contactlessPayments: Annotated[Optional[bool], "Allow contactless/tap-to-pay"] = None,
    atmWithdrawals: Annotated[Optional[bool], "Allow ATM withdrawals"] = None,
    dailyTransactionLimit: Annotated[Optional[float], "Daily total transaction limit"] = None,
    dailyOnlineLimit: Annotated[Optional[float], "Daily online transaction limit"] = None,
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("updateCardSecuritySettings cardId=%s", cardId)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        settings = await card_repo.update_security_settings(
            cardId,
            online_transactions=onlineTransactions,
            international_transactions=internationalTransactions,
            contactless_payments=contactlessPayments,
            atm_withdrawals=atmWithdrawals,
            daily_transaction_limit=dailyTransactionLimit,
            daily_online_limit=dailyOnlineLimit,
        )
        return {
            "cardId": settings.card_id,
            "onlineTransactions": settings.online_transactions,
            "internationalTransactions": settings.international_transactions,
            "contactlessPayments": settings.contactless_payments,
            "atmWithdrawals": settings.atm_withdrawals,
            "dailyTransactionLimit": float(settings.daily_transaction_limit),
            "dailyOnlineLimit": float(settings.daily_online_limit),
        }


@mcp.tool(name="requestCardLimitIncrease", description="Submit a credit limit increase request for a card - the requested limit must be greater than the current limit")
async def request_card_limit_increase(
    cardId: Annotated[str, "Unique identifier for the card"],
    requestedLimit: Annotated[float, "The new limit being requested"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("requestCardLimitIncrease cardId=%s requestedLimit=%s", cardId, requestedLimit)
    async with get_session_context() as session:
        card_repo = CardRepository(session)
        await _require_owned_card(session, card_repo, cardId, callerCustomerId, callerRole)
        record = await card_repo.request_limit_increase(cardId, requestedLimit)
        return {
            "id": record.id,
            "cardId": record.card_id,
            "currentLimit": float(record.current_limit),
            "requestedLimit": float(record.requested_limit),
            "status": record.status,
        }


@mcp.tool(name="issueCard", description="Issue and immediately activate a new card on an account (self, or on behalf of any customer's account if admin)")
async def issue_card(
    accountId: Annotated[str, "Account to issue the card on"],
    name: Annotated[str, "Display name for the card, e.g. 'Meridian Cashback Card'"],
    cardType: Annotated[str, "credit | debit | recharge"],
    circuit: Annotated[str, "visa | mastercard | amex"],
    limitAmount: Annotated[float, "Credit limit for the new card"],
    callerCustomerId: Annotated[Optional[str], CALLER_ARGS_DOC] = None,
    callerRole: Annotated[str, "role of the authenticated caller: admin|customer"] = "customer",
):
    logger.info("issueCard accountId=%s name=%s type=%s", accountId, name, cardType)
    async with get_session_context() as session:
        account_repo = AccountRepository(session)
        account = await account_repo.get_account_details(accountId)
        if account is None:
            raise RuntimeError(f"Account {accountId} not found")
        _check_account_ownership(account.customer_id, callerCustomerId, callerRole)
        card_repo = CardRepository(session)
        row = await card_repo.issue_card(accountId, name, cardType, circuit, limitAmount)
        return mappers.orm_to_card(row)
