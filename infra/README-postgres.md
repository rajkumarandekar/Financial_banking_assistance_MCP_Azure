# Postgres wiring status

## Status: PROVISIONED (2026-08-15), not yet wired into main.bicep

A real Azure Database for PostgreSQL Flexible Server has been provisioned
manually via Azure CLI (not yet through `infra/main.bicep` / `azd`):

- Resource group: `banking-assistant-rg-in` (Central India)
- Server: `banking-assistant-pg` (Burstable B1ms, Postgres 16)
- Database: `bankingassistant`
- Admin login: `bankadmin` (password not recorded in the repo — see your
  password manager / the terminal history from provisioning)
- Firewall: `AllowAllAzureServices` (0.0.0.0 special rule for in-Azure
  traffic) + a rule for the dev machine's IP used during setup (remove or
  update this rule if your IP changes, or once all access happens through
  actual deployed Container Apps)

All 8 services' schemas exist on this server and have had their Alembic
migrations applied (`account_schema`, `customer_schema`,
`transaction_schema`, `loan_schema`, `credit_schema`, `payment_schema`,
`document_schema`, `communication_schema`). Demo data seeded for account,
customer, transaction, and credit (the services with seed scripts).

Live-verified: account-service queried live over GraphQL against this
server and returned real seeded data.

`infra/shared/storage/postgres.bicep` (written earlier, matching this same
Burstable B1ms / Postgres 16 shape) is **still not wired into
`infra/main.bicep`** — the server above was created directly via `az`
rather than through that bicep module, since this was done ahead of the
full `azd` deployment pass (Phase D). Wiring it in now would create a
*second*, redundant server unless the module is adjusted to reference the
existing one instead of declaring a new resource. Recommended when Phase D
happens: either (a) import the existing server into the bicep deployment as
a `existing` resource reference, or (b) delete this manually-created server
and let `azd provision` create it fresh from `postgres.bicep` — either
works, (a) avoids re-seeding data.

## Local dev env var

Every service reads a single `DATABASE_URL`:
```
DATABASE_URL=postgresql+asyncpg://bankadmin:<password>@banking-assistant-pg.postgres.database.azure.com:5432/bankingassistant?ssl=require
```
Put this in each service's local `.env.dev` (gitignored) to point local dev
at the real Azure server instead of Neon.

## To wire `postgres.bicep` into `main.bicep` later (Phase D)

1. In `infra/main.bicep`, add:
   ```bicep
   @secure()
   param postgresAdminPassword string

   module postgres 'shared/storage/postgres.bicep' = {
     name: 'postgres'
     scope: rg
     params: {
       name: '${abbrs.dBforPostgreSQLServers}${resourceToken}'
       location: location
       tags: tags
       administratorLogin: 'bankadmin'
       administratorLoginPassword: postgresAdminPassword
     }
   }
   ```
2. `postgresAdminPassword` should come from an azd secure env var (`azd env set-secret` or a Key Vault reference), never a plain param default.
3. Extend each service's container-app bicep (`infra/app/*.bicep`) with `POSTGRES_HOST`/`POSTGRES_DATABASE`/`POSTGRES_USER` as plain values, and `POSTGRES_PASSWORD` as a Container Apps secret (the shared `container-app-upsert.bicep` module already supports a `secrets` param).
4. Build `DATABASE_URL` either in each container app's env from the parts above, or pass it as a single secret directly.
