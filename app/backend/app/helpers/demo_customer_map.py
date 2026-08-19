"""POC shim mapping authenticated Entra ID identities to a customer_id + role.

This exists because customer-service (the eventual owner of customer_id issuance
and the real customer/user directory) does not exist yet. Once it does, this
mapping should be replaced by a lookup against customer-service instead of a
static dict.

Keys are matched against the token's email/preferred_username claim.
"""

DEMO_CUSTOMER_MAP: dict[str, dict[str, str]] = {
    # Real Entra ID demo identities in the tenant used for testing
    # (b0785f94-1d88-480f-a174-c4297777243b). Admin is mapped under both
    # possible preferred_username forms Entra may present for a guest
    # identity signed in via a personal Microsoft account (the raw external
    # email, or the tenant-normalized UPN) - only one will actually appear
    # in a real token, but both are harmless to keep mapped.
    "rajkumarnilakanta53552@gmail.com": {
        "customer_id": "11111111-1111-1111-1111-111111111111",
        "roles": "admin",
    },
    "rajkumarnilakanta53552_gmail.com#ext#@rajkumarnilakanta53552gmail.onmicrosoft.com": {
        "customer_id": "11111111-1111-1111-1111-111111111111",
        "roles": "admin",
    },
    "bob.user@rajkumarnilakanta53552gmail.onmicrosoft.com": {
        "customer_id": "22222222-2222-2222-2222-222222222222",
        "roles": "customer",
    },
    # Original placeholder identities - kept so account/customer-service seed
    # data (seeded under these emails) still resolves for local dev without
    # AUTH_ENABLED, and for anyone testing with their own contoso.com-style
    # Entra tenant instead of this one.
    "admin@contoso.com": {
        "customer_id": "11111111-1111-1111-1111-111111111111",
        "roles": "admin",
    },
    "bob.user@contoso.com": {
        "customer_id": "22222222-2222-2222-2222-222222222222",
        "roles": "customer",
    },
}

DEFAULT_ROLE = "customer"


def resolve_customer_id_and_role(email: str | None) -> tuple[str | None, str]:
    if email and email.lower() in DEMO_CUSTOMER_MAP:
        entry = DEMO_CUSTOMER_MAP[email.lower()]
        return entry["customer_id"], entry["roles"]
    return None, DEFAULT_ROLE
