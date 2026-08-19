# Entra ID app registration setup (manual prerequisite)

## Status: DONE (2026-08-15)

The app registration exists and has been live-tested end-to-end (real JWT
issued by Entra ID, validated by `app/backend/app/helpers/auth.py`, correct
customer_id/role resolved, `AuthMiddleware` correctly returns 401/200).

- Tenant: `b0785f94-1d88-480f-a174-c4297777243b` (`rajkumarnilakanta53552gmail.onmicrosoft.com`, personal "Default Directory")
- App (client) ID: `2a0314bc-bd93-480e-81d4-57463430fab9`
- App Roles defined: `admin`, `customer` (both included in the token's `roles` claim — not currently read by `auth.py`, which still resolves role via `demo_customer_map.py`; wiring the token's own `roles` claim as the primary source instead of the demo map is a reasonable future simplification)
- Public client / device-code flow enabled (for testing without a client secret)
- Demo identities in this tenant:
  - **Admin**: the tenant owner's own account (`rajkumarnilakanta53552@gmail.com`, guest identity) — assigned the `admin` app role
  - **Customer**: a new native user, `bob.user@rajkumarnilakanta53552gmail.onmicrosoft.com` — assigned the `customer` app role. Password was set at creation time; not recorded in the repo. Rotate/reset it via `az ad user update` if needed.
- `app/backend/app/helpers/demo_customer_map.py` updated with this tenant's real emails (kept the original `@contoso.com` placeholders too, for anyone testing against a different tenant).

**To actually enable this locally**: create `app/backend/.env.dev` (gitignored,
not committed) with:
```
AUTH_ENABLED=true
AZURE_TENANT_ID=b0785f94-1d88-480f-a174-c4297777243b
AZURE_AD_BACKEND_CLIENT_ID=2a0314bc-bd93-480e-81d4-57463430fab9
```
Left as an opt-in step rather than the new default, since flipping it on
changes behavior for anyone running the backend locally without a token.

---


The backend's JWT validation code (`app/backend/app/helpers/auth.py`,
`app/backend/app/middleware/auth_middleware.py`) is ready to use but disabled
by default (`AUTH_ENABLED=false`) because it depends on an Azure AD (Entra ID)
app registration that **requires tenant permissions this project has not yet
confirmed are available**. Until this is done, the app runs unauthenticated
with the mock user profile (`bob.user@contoso.com`, role `customer`) — the
rest of the stack (GraphQL, MCP tools, ownership enforcement) works and can be
demoed without this step.

App registration itself is not expressible in pure Bicep (it requires the
Microsoft Graph Bicep extension or `az ad app` / Graph API calls), so it's a
manual step here, not part of `azd provision`.

## Steps (run once you have Azure AD app-registration permissions)

1. Create the app registration:
   ```bash
   az ad app create --display-name "banking-assistant-backend" \
     --sign-in-audience AzureADMyOrg
   ```
   Note the returned `appId` — this is `AZURE_AD_BACKEND_CLIENT_ID`.

2. Get your tenant id:
   ```bash
   az account show --query tenantId -o tsv
   ```
   This is `AZURE_TENANT_ID`.

3. Define two App Roles (`admin`, `customer`) on the app registration so
   tokens carry a `roles` claim — for the current POC, role is instead
   resolved server-side via `app/backend/app/helpers/demo_customer_map.py`
   (email → customer_id/role), so this step is optional until a real
   customer directory (customer-service) exists.

4. Create the two demo users in the tenant (or reuse existing ones) with
   emails matching `demo_customer_map.py`:
   - `admin@contoso.com` (mapped to role `admin`)
   - `bob.user@contoso.com` (mapped to role `customer`)

5. Set the following in the backend's environment (`.env.dev` locally, or
   Container Apps secrets/env in production):
   ```
   AUTH_ENABLED=true
   AZURE_TENANT_ID=<tenant id from step 2>
   AZURE_AD_BACKEND_CLIENT_ID=<appId from step 1>
   ```

6. Verify: call any backend endpoint without a token → expect `401`. Get a
   token for a demo user (e.g. `az account get-access-token` against a test
   client, or via MSAL in a small script) and call again with
   `Authorization: Bearer <token>` → expect `200`, and confirm
   `UserProfileHelper.get_customer_id()` resolves the right demo customer.

No backend code changes are required once these env vars are set — the
middleware and `demo_customer_map.py` pick them up automatically.
