# FinTech Platform Migration — Progress Log

This document records the migration of the cloned Azure banking-assistant sample
into the target FinTech AI Operations Platform architecture:

```
React UI -> FastAPI -> LangGraph (planned) -> Domain Agent -> MCP Tool ->
Business Microservice -> GraphQL API -> Business Logic -> Database (Postgres)
```

Original repo: `Azure-Samples/agent-openai-python-banking-assistant` — a Python
multi-agent banking assistant (FastAPI backend + Microsoft Agent Framework
handoff orchestration + 3 in-memory MCP business microservices + React
frontend). Target: 8 Postgres-backed microservices, GraphQL APIs, real
admin/customer auth and RBAC, deployed on Azure Container Apps.

---

## 1. What existed before (baseline)

- 5 Azure Container Apps: `backend`, `web`, `account`, `transaction`, `payment`.
- Business services (`account`, `transaction`, `payment`) stored data as
  hardcoded Python dicts in `services.py` — no database, no persistence,
  reset on every restart.
- Auth was entirely mocked: `UserProfileHelper` always returned the same
  hardcoded user (`bob-user-123`), no login, no per-user data isolation.
- MCP tools called `services.py` directly; a thin REST layer existed
  alongside but was not what the AI agents used.
- No GraphQL anywhere.

## 2. Target architecture decisions (confirmed with user)

- **Database**: single PostgreSQL instance, schema-per-domain
  (`account_schema`, `customer_schema`, `transaction_schema`, `loan_schema`,
  `credit_schema`, `payment_schema`, `document_schema`,
  `communication_schema`).
- **GraphQL**: Strawberry (code-first), one `/graphql` endpoint per service,
  mounted alongside `/mcp` (and `/api` REST where it pre-existed).
- **Auth**: real Entra ID (Azure AD) JWT validation, built but disabled by
  default (`AUTH_ENABLED=false`).
- **Ownership enforcement**: enforced at the business-service level (not
  just LLM instructions). The backend injects the caller's validated
  `customer_id`/`role` into every MCP tool call server-side
  (`app/backend/app/tools/identity_injecting_mcp_tool.py`); each service's
  MCP tools independently re-validate ownership (defense in depth).

## 3. The 8 business microservices — all built and live-tested

Each follows the same pattern: Postgres (SQLAlchemy async models + Alembic
migration) + Strawberry GraphQL (`/graphql`) + MCP tools (`/mcp`) with
server-enforced ownership checks.

| # | Service | Port (dev) | Notes |
|---|---|---|---|
| 1 | **Account** | 8070 | Existing service migrated. Balances, cards, payment methods, beneficiaries. Also gained a `GET /api/accounts/{account_id}` REST endpoint (added later, for the frontend). |
| 2 | **Customer** | 8073 | New. Owns `customer_id`/role — the real identity source of truth, wired into backend auth (`customer_service_client.py`) with fallback to a static demo map. |
| 3 | **Transaction** | 8071 | Existing service migrated. Verifies account ownership via a cross-service GraphQL call to account-service (fails closed if unreachable). |
| 4 | **Loan** | 8074 | New. Apply/approve/reject, auto-generates a real amortized EMI schedule on approval. |
| 5 | **Credit** | 8075 | New. Credit score + history, read-mostly. |
| 6 | **Payment** | 8072 | Existing service migrated. Was previously fire-and-forget (silently swallowed failures); now persists every payment with a real status lifecycle (`processing/paid/failed/cancelled`), calls transaction-service via GraphQL instead of raw REST, and added `getPaymentStatus`/`cancelPayment`/`retryPayment`. |
| 7 | **Document** | 8076 | New. Owns no primary data — generates statements/receipts/loan letters by pulling from account/transaction/payment/loan services over GraphQL. |
| 8 | **Communication** | 8077 | New. Email/WhatsApp/notifications — delivery is a clearly-labeled **stub** (no real provider credentials exist); every send is still recorded for real audit history. |

Demo data: 3 accounts — `1000` (admin, customer_id `1111...1111`), `1010` +
`1020` (customer "Bob", customer_id `2222...2222`).

## 4. Backend changes (auth + agent wiring)

- `app/backend/app/helpers/auth.py`, `middleware/auth_middleware.py`,
  `helpers/request_context.py` — real Entra ID JWT validation, off by default.
- `app/backend/app/helpers/user_profile_helper.py` — now reads from request
  context (real or mock) instead of a hardcoded dict.
- `app/backend/app/tools/identity_injecting_mcp_tool.py` — subclasses
  `MCPStreamableHTTPTool`, overrides `call_tool()` to inject
  `callerCustomerId`/`callerRole` server-side on every MCP call (LLM cannot
  override these).
- `app/backend/app/helpers/user_profile_provider.py` — also injects
  `customer_id`/`role` into the agent's prompt context (not just email),
  since several new MCP tools require an explicit `customerId` argument for
  self-lookups and the LLM had no way to know its own customer_id otherwise.
  This is prompt context only — the actual security boundary remains the
  server-side injection above, independently re-validated per tool call.
- 5 new AI agents (Customer, Loan, Credit, Document, Communication) added for
  **both** `foundry_v2` and `azure_chat` variants; supervisor/triage logic in
  both `handoff_orchestrator.py` files updated to route to all 8 specialists.
- `transaction_agent.py` / `payment_agent.py` (both variants) fixed to use
  `IdentityInjectingMCPTool` — previously only the Account agent had this.
- DI containers wired with the 5 new agent factories and `*_MCP_URL` settings.
- Note: the `simple`/`main_handoff.py` entrypoint was **not** extended with
  the 5 new agents — only the primary ChatKit entrypoint has all 8 wired in.

## 5. Real bugs found and fixed

1. **Naming collision**: a local `graphql/` package in each service would
   have shadowed the third-party `graphql-core` library. Renamed to `gql/`.
2. **asyncpg strictness**: seed scripts passed date/amount fields as plain
   strings; fixed to use real `date`/`Decimal` objects.
3. **Timezone mismatch**: ORM `created_at`/`updated_at` columns were missing
   `timezone=True`, mismatching the migration's `TIMESTAMPTZ` columns.
4. **Decimal/float mixing**: card mutations crashed mixing `Decimal` (DB)
   with `float` (GraphQL input).
5. **Column-length overflow**: payment-service generated full-UUID
   transaction IDs into a `VARCHAR(20)` column.
6. **Silent failure swallowing (original repo behavior)**: pre-migration
   payment service returned `"ok"` even when notifying transaction-service
   failed. Fixed — failures are now recorded with a reason, and
   `retryPayment` exists to recover.
7. **MCP double-mount bug (pre-existing in the original repo)**: mounting
   the MCP sub-app under `/mcp` while it also defined its own internal
   `/mcp` route doubled up to a working endpoint at `/mcp/mcp` instead of
   `/mcp`. Never caught by the original tests (they call MCP tool Python
   functions directly, not over real HTTP). Fixed in all 8 services: mount
   at root (`/`), and mount it *last* so it doesn't shadow other routes.
8. **fastmcp version drift**: unpinned `fastmcp` in new services resolved a
   breaking newer major version. Pinned to `2.12.3` consistently.
9. **`az` CLI not on PATH for the backend process**: broke
   `AzureCliCredential` when the backend tried to call the real Foundry
   model locally. Fixed by prepending the CLI's install dir to `PATH` when
   launching the backend for local testing.
10. **Preview endpoint always served `application/octet-stream`**
    (`app/backend/app/routers/chatkit/attachment_routers.py`): it guessed
    the MIME type from the `attachment_id` string (e.g. `atc_d4a7f448`),
    which never has a file extension, so the guess always failed silently.
    Found by the user testing the real upload/preview flow through Swagger
    — browsers were downloading images as generic blobs instead of
    rendering them. Fixed to use the attachment's real stored `mime_type`
    instead. Verified via curl (`content-type: image/png`) and a valid PNG
    round-trip.
11. **Missing account REST endpoint**: account-service only exposed cards
    over REST; balance/holder/currency were GraphQL-only. Added
    `GET /api/accounts/{account_id}` so the frontend (which uses REST, not
    GraphQL) could fetch real account details.

## 6. Verification performed

- Every service: migration applied, seed data loaded, GraphQL/REST tested
  live against real Postgres, MCP tool ownership enforcement tested
  directly and via Swagger/GraphiQL by the user.
- Cross-service flows tested end-to-end: full payment lifecycle, document
  generation pulling from 4 different services.
- `IdentityInjectingMCPTool` tested against real running MCP servers.
- Backend test suite (`pytest`) stayed at 6 skipped / 0 failed throughout.
- **Real live AI chat conversation** — see section 9 below (this was the one
  gap called out earlier; it's since been closed).

## 7. Phase B — Real login (DONE, 2026-08-15)

Created a real Entra ID app registration (`banking-assistant-backend`,
client id `2a0314bc-bd93-480e-81d4-57463430fab9`) in the user's own Azure
tenant (`b0785f94-1d88-480f-a174-c4297777243b`), with `admin`/`customer` App
Roles, two demo identities (tenant owner = admin, new
`bob.user@...onmicrosoft.com` native user = customer). Full chain
live-tested with a real MSAL-acquired token: JWT signature verified via
JWKS, audience/issuer checked, correct customer_id/role resolved,
`AuthMiddleware` correctly returns 401/401/200 for no-token/bad-token/valid
token. See `docs/entra-app-registration-setup.md`. Still `AUTH_ENABLED=false`
by default — opt-in via local `.env.dev` (not committed).

## 8. Phase C — Database decision (DONE, 2026-08-15)

Provisioned a real Azure Database for PostgreSQL Flexible Server
(`banking-assistant-pg`, Burstable B1ms, Postgres 16, resource group
`banking-assistant-rg-in`, Central India). All 8 services' migrations
applied; demo data seeded. See `infra/README-postgres.md`.

## 9. Phase D — Deploy to Azure (DONE, 2026-08-15)

Wrote 5 new bicep app modules (`infra/app/{customer,loan,credit,document,
communication}.bicep`), wired `databaseUrl` as a Container Apps secret into
all 8 business-service modules, added the 5 new services to `azure.yaml`.

**Provisioned via `azd provision`** (resource group `rg-banking-assistant-dev`,
Central India for compute, `eastus`/`eastus2` for AI resources due to
regional quota availability):
- Container Apps Environment with all **10** container apps: backend, web,
  account, transaction, payment, customer, loan, credit, document,
  communication
- Azure AI Foundry + **`gpt-4.1-mini`** model deployment (GlobalStandard,
  capacity 50) — `gpt-4.1` had zero quota on this subscription in every
  region checked; `gpt-4.1-mini` had real quota (200) in `eastus`
- Document Intelligence, Storage Account, Cosmos DB, Container Registry,
  Log Analytics, Application Insights

**Issues hit and resolved during provisioning**:
- `gpt-4.1` GlobalStandard and Standard SKUs both had 0 quota — switched to
  `gpt-4.1-mini` GlobalStandard after checking actual quota availability via
  `az cognitiveservices usage list` across several regions.
- Subscription-wide limit of 1 Container App Environment — a pre-existing,
  unrelated one (`rag-chatbot-env` in resource group `RAG_chatbot`, from an
  earlier project) was using the slot. **Deleted with explicit user
  confirmation** (only the environment + its one container app; other
  resources in that resource group were left untouched).
- Azure CLI / azd device-code login was blocked by the tenant's Security
  Defaults policy (`AADSTS530035`) — resolved by using interactive browser
  login (`az login` / `azd auth login` without `--use-device-code`) instead.

Note: this only provisions *infrastructure* — the container apps are
running placeholder images, not the real application code. `azd deploy`
(building/pushing real Docker images for all 10 services) has **not** been
run yet.

## 10. Full local end-to-end testing (2026-08-15)

With real Azure resources now available (Postgres + AI Foundry), ran the
**entire stack locally** end-to-end for the first time — all 8 business
services + backend (with real `gpt-4.1-mini` credentials, not mocked) +
the actual React frontend (`banking-web`), all pointed at real Azure
Postgres and real Azure AI Foundry.

**Real AI chat conversation confirmed working**: a message sent through the
actual ChatKit protocol correctly triaged to AccountAgent, called the real
MCP tool, hit real Postgres, and streamed back a correct natural-language
answer — verified both via raw HTTP and through the actual browser UI.
Multiple domains tested through the real UI by the user: account balance,
transactions, credit score, loans, customer profile, document generation
(pulls real data from 4 services and formats it), communication (with
human-in-the-loop approval).

**Known model-reliability caveat**: `gpt-4.1-mini` occasionally executes an
MCP tool call successfully (confirmed via logs — correct data, ownership
check passed) but doesn't always produce a final text response afterward,
particularly observed on loan queries in one test. This looks like small-model
behavior, not a bug in the underlying plumbing — flagging in case it recurs
and a larger model or prompt tuning is needed.

## 11. Frontend work (2026-08-15)

- **Theme**: changed primary color from blue to light green across the
  whole app (`index.css` CSS variables + all hardcoded `blue-*` Tailwind
  classes in `Navigation.tsx`, `AIAgent.tsx`, `Account.tsx`, `Dashboard.tsx`,
  `NotFound.tsx`, `CreditCardManagement.tsx`). Data-category chart colors
  (expense pie-chart slice, transaction-type dot) intentionally left alone —
  those are data categorization, not brand theming.
- **Real data wiring** (`Dashboard.tsx`, `Account.tsx`,
  `TransactionAnalytics.tsx`, `api/bffClient.ts`): replaced mocked numbers
  with real calls to account/transaction services wherever a real backing
  field exists — balance, credit limit/utilization, recent transactions,
  expense-by-category breakdown, income/expenses/cash-flow analytics, account
  holder/currency/activation date. Fixed a real bug along the way: `Payment`
  amounts are always positive on the wire, direction is carried by a
  separate `flowType` field ("income"/"outcome") — initial code incorrectly
  assumed sign-encoded amounts.
- **Explicitly left as decorative mock**, per user's own scope decision —
  no real backing data exists for these anywhere in the system:
  - User identity ("Michael Carter") — kept as-is, not switched to Bob User
  - Investment Portfolio — no investment service was ever built
  - Dashboard's month-by-month balance trend chart — only *current* balance
    is stored anywhere, no historical time-series
  - Account Number/SWIFT/IBAN/Routing Number — no such fields exist in the
    account domain model at all
- Clarified for the user: everything currently shown **is** the customer
  perspective (Bob's own data, correctly scoped) — there is **no admin view
  built yet** in this frontend. That remains a real Phase E task.

## 12. What's left (superseded in part by Section 13 below)

**Phase D remainder**
- `azd deploy` — build and push real Docker images for all 10 services
  (infrastructure exists, application code doesn't run there yet).

**Phase E — Frontend**
- Real admin view (see everything) vs. customer view (own data only) — needs
  `AUTH_ENABLED=true` plus a way to select/switch identity, and admin-specific
  UI (customer search, cross-account visibility) that doesn't exist yet.
- ~~UI for loans, credit, documents, communications — backend fully supports
  these (tested via AI chat), but there's no dedicated page/UI for them yet,
  only the chat panel.~~ **No longer accurate** — Loans and Credit Cards each
  got full dedicated screens in Section 13 below. Documents/Communications
  still have no dedicated UI beyond the chat panel.

**Not done / explicitly deferred**
- The `simple`/`main_handoff.py` agent entrypoint only has
  account/transaction/payment wired in, not the 5 new agents.
- LangGraph swap (target architecture calls for LangGraph instead of
  Microsoft Agent Framework's `HandoffBuilder`) — not started.
- No real email/WhatsApp provider wired into communication-service (stub
  only, by design for this POC).
- `infra/shared/storage/postgres.bicep` still isn't wired into
  `infra/main.bicep` — the Postgres server was created directly via `az`,
  ahead of the bicep-based deployment. See `infra/README-postgres.md`.

## 13. Phase F — Frontend feature buildout & redesign (2026-08-16 to 2026-08-17)

A major frontend session: several full feature screens were built from
scratch, all "not demo they are real ... not real enterprise level" per the
user's explicit direction — meaning every screen is fully functional against
real backend data where a real service exists, and where no backend exists
(payments execution, loan servicing, card actions, investing), the screen
runs on a genuine local-state simulation (reactive service + localStorage)
rather than static mock numbers or a "Demo" label. The word "Demo" was
removed from all user-visible text **and** internal identifiers/filenames
across the frontend (see the renames below).

### 13.1 Dashboard redesign
Rebuilt around visualizations instead of a KPI-card wall: `KpiGrid`,
`CreditScoreCard` (animated needle gauge — real bug fixed: the needle's CSS
`transition` was on a `transform` that was never actually set; replaced with
a real per-frame `requestAnimationFrame` tween), `FinancialHealthCard`,
`CashFlowCard`, `SpendingCategories`, `SpendingTrendCard`, `QuickActions`,
`RecentTransactions`, `UpcomingPayments`, `FinancialInsight`,
`ImportantUpdates`. New shared libs: `lib/cashFlow.ts` (zero-filled monthly
income/expense buckets — always emits N consecutive months even where the
ledger has gaps, so range toggles never look broken), `lib/chartTokens.ts`
(single source of truth for every chart colour — `SERIES` for income/expense
polarity, `CATEGORY_PALETTE` for spending-category identity, colour-vision
tested), `lib/creditScore.ts`, `lib/upcomingEmis.ts`, `lib/navigation.ts`.

### 13.2 Payments (human-action-only, does not touch the AI Assistant)
New Payment / Pay a Bill flows: review → confirm → processing → success,
explicitly simulated (no real money moves) with a labeled 12% random failure
rate and retry/cancel. `lib/paymentActionService.ts` (renamed from
`demoPaymentService.ts`) is the reactive store (`useSyncExternalStore` +
localStorage) — same pattern reused by every simulated-action feature after
it. Fixed a real layout bug: "Your Payment Activity" now renders inside the
same grid column as the payments table instead of below the whole two-column
grid, so it fills the leftover vertical space. Added pagination (5/page) to
Payment History.

### 13.3 Loans & Lending Center
`pages/Loans.tsx` (My Loans, EMI/interest calculators, eligibility checker,
applications) plus a **second dedicated screen** `pages/LoanExplore.tsx`
(`/loans/explore` and `/loans/explore/:categoryId`), reachable via a new
sidebar sub-item ("Explore Loans", indented under "Loans"). The Loan Offers
comparison section used to appear on *both* screens — removed from the main
Loans page, kept only on Explore Loans, since it was a straight duplicate.
"Auto Loan" renamed to "Car" everywhere. `lib/loanCenterService.ts` is the
reactive store: EMI schedule generation, `payEMI`, `makeExtraPayment`,
`calculateEligibility`, applications.

**Sidebar behavior fix**: "Explore Loans" now only renders while a Loans
page is actually active (`location.pathname` starts with `/loans`) instead
of always being visible — implemented in `components/Sidebar.tsx` via
`isParentActive()`, which walks back to the nearest non-sub item in the same
nav group. Also fixed `NavLink`'s `end` prop for `/loans` so the parent
"Loans" item doesn't stay highlighted while on `/loans/explore` (NavLink
prefix-matches by default).

### 13.4 Credit Card Management Center
`pages/CreditCardManagement.tsx` + `components/creditCards/*`:
KPIs, a `RadialBarChart`-based Credit Health gauge, a card carousel
(embla-based `Carousel` — deliberately used instead of a CSS grid, because
grid items don't shrink below intrinsic content width by default and kept
causing "cut off at page edge" bugs; Carousel self-clips via
`overflow-hidden` and doesn't have that failure mode), spending analytics
(donut + monthly bars — monthly bars are two-color: green when a month has
zero spend, red proportional to spend when it doesn't), rewards/offers (each
offer now has a distinct colour identity — icon/badge/hover border — instead
of one repeated primary-tinted card), transactions (each row shows which
card it belongs to), statements, security/limits, and an Apply-for-Card flow
that **actually issues a new card** (`issueCard()` in
`lib/creditCardService.ts`, merged into the visible card list via
`useAddedCards()`) rather than only recording an application record.

**Real bugs fixed along the way**: `CardTransactions`/`CardSpendingAnalytics`
were inferring credit/debit direction from `amount > 0`, but the real
transaction wire format always sends a positive `amount` with direction
carried separately in `flowType` (`"income" | "outcome"`) — every real
transaction was rendering as a credit and Card Spending showed ₹0. Category
colours were keyed to invented category names that never matched real data
(all gray). Monthly bars were in Map-insertion order, not chronological.

**Statements — real PDF download**: `lib/statementPrinter.ts` was rewritten
around `jspdf` (`doc.save(filename)` triggers an actual browser file
download) after the user twice rejected a "print dialog" approach — "View"
opens an HTML preview with no auto-print, "Download PDF" saves a real file.

### 13.5 "Demo" naming removed
Renamed both user-visible copy and internal identifiers/filenames:
`DemoPayment.ts` → `PaymentAction.ts`, `demoPaymentService.ts` →
`paymentActionService.ts`, `demoPaymentDerived.ts` → `paymentActionDerived.ts`,
`DemoPaymentSection.tsx` → `PaymentActionSection.tsx`,
`DemoPaymentDetailsDrawer.tsx` → `PaymentActionDetailsDrawer.tsx`,
`DemoLoan` → `LoanAccount`, `useDemoLoans` → `useLoanAccounts`. The
underlying simulated/local-state architecture was intentionally **kept** —
the user's instruction was about labeling, not about replacing the
simulation with a real backend integration ("not real enterprise level").

### 13.6 Transaction Analytics — refinement, not a rebuild
Kept the original page structure (header/filters → KPIs → trend charts →
category breakdown → activity/insights) but rebuilt the internals around a
new centralized `lib/transactionAnalytics.ts` (totals, previous-period
comparison, category breakdown, zero-filled trend bucketing at day/week/month
granularity depending on the selected range, top category, largest
transaction, credit-card spend). Date Range / Category / Account filters now
actually drive every section. Category rows open a detail Sheet (total,
count, average, largest, recent transactions). Cross-links Credit Card
Spending and Loan EMI into the category view without duplicating those
screens' own math. Export produces real files: CSV via a Blob download, and
a PDF report via `lib/analyticsReportPdf.ts` (jsPDF, same "real download,
not a print dialog" approach as Statements). "Ask AI about my spending"
hands off to the existing AI Assistant via its router-state `prefill`
mechanism (same one Payments already used).

### 13.7 Investment Portfolio — re-added to the sidebar
The page/route (`/portfolio`) existed in code but had been dropped from
`lib/navigation.ts` at some earlier point, making it unreachable from the
UI. Re-added under a new "Investing" nav group. Rebuilt on a new
`lib/investmentService.ts` (same reactive-store pattern as the other
simulated-action features) with NSE-style Indian large-cap seed data
(RELIANCE, TCS, HDFC Bank, Infosys, ICICI Bank, etc.) instead of the old
US-ticker/`$`-denominated mock, so it's consistent with the rest of the
app's ₹ currency. Buy/Sell in the Trade dialog now genuinely execute
(weighted-average cost recalculated on buy, shares decremented/position
closed on sell, every trade appended to a real transaction log) instead of
only `console.log`-ing. A holding's `currentPrice` is always looked up from
the market-trend list by symbol rather than duplicated onto the holding
itself, so it can't drift out of sync with the Market Trends tab.

**Left as dead code (not deleted — file-delete was blocked by the
session's permission classifier)**: `mocks/bffApi.ts` and the two model
files only it used, `models/Portfolio.ts` and `models/Dashboard.ts`. Nothing
imports any of them anymore; `bffApi.ts` also has several pre-existing type
errors (wrong `CreditCard` constructor arity, a `date` field that doesn't
exist on `CreditCardTransaction`) that predate this session. Safe to delete
manually — `rm src/mocks/bffApi.ts src/models/Portfolio.ts src/models/Dashboard.ts`.

### 13.8 Real bugs / environment issues fixed this phase
- **Postgres firewall/IP drift** (recurring): the dev machine's public IP
  changed several times across the session, each time breaking login until
  `az postgres flexible-server firewall-rule update` was re-run for
  `AllowMyDevMachine`. One occurrence needed a full server restart plus a
  full admin-password reset. Proved via a raw Postgres `SSLRequest` packet
  test that one block was the client's own network/security software
  intercepting the TLS handshake, not Azure or the app — resolved by
  switching to a mobile hotspot.
- **`tsc` verification gotcha, discovered and corrected mid-session**: the
  repo root `tsconfig.json` is solution-style (`"files": []` +
  `"references"`) — running `npx tsc --noEmit -p .` **does not actually
  type-check anything** without `--build`. Every type-check claim earlier in
  this session used that invocation and was effectively a no-op. The correct
  command is `npx tsc --noEmit -p tsconfig.app.json`. Re-running the correct
  check against everything built this session found **zero new errors** —
  the only pre-existing errors are in `mocks/bffApi.ts` (see 13.7) and a
  handful of unrelated pre-existing chat-widget typing issues
  (`components/chat/**`, `common/config.ts`) that predate this session.
  `npm run build` (`vite build`) does **not** type-check at all — Vite/esbuild
  strips types without validating them — so it was never sufficient on its
  own either; `tsc -p tsconfig.app.json` is the only real type-check.

## 14. Phase G — Real data migration: seed volume + wiring local-state features to Postgres (2026-08-17)

Everything built in Phase F (13.2-13.4, 13.7) ran on frontend-only
localStorage simulations layered on top of read-mostly real data. This phase
replaces that, service by service: seed the database with "medium" (not
thin, not exhaustively complete) realistic volume, then wire each
frontend feature's *actions* to real GraphQL mutations instead of local
state. Investment stays untouched per explicit user instruction. API-style
convention (confirmed with the user): account/transaction extend their
existing REST layer for new writes; loan/payment/credit/customer (which
have never had REST, GraphQL/MCP-only) get new GraphQL mutations instead —
each service keeps using whichever style it already committed to.

### 14.1 Phase 1 — Seed data (all done, verified via real REST/GraphQL queries, not just direct DB reads)

| Service | Before | After |
|---|---|---|
| transaction | 14 rows, all on account 1010 | 106 rows across accounts 1000/1010/1020, ~9 months back, real card attribution (`db/seed.py` Section 2 - deterministic generator, seeded RNG) |
| credit | 2 scores, 4 history events | 2 scores (unchanged - `CreditScoreORM.customer_id` is the primary key, one row per customer, so there is **no time-series/snapshot table** to seed a real score-history trend into), 20 history events across ~a year |
| loan | 0 (no seed script existed) | 6 loans - 4 active with real computed EMI schedules (reducing-balance formula, some installments already paid), 1 pending application, 1 rejected application |
| payment | 0 (no seed script existed) | 23 payments - realistic paid/pending/failed/cancelled mix |

Both `transaction/db/seed.py` and `credit/db/seed.py` originally errored on
re-run (`UniqueViolationError` - their original rows already existed from
earlier in this session) - fixed by adding an idempotency guard (query
existing ids first, skip anything already present) so both are now safe to
re-run anytime.

**Known limitation, not fixed in this phase**: real account data is
EUR (bob's accounts 1010/1020) and USD (admin's account 1000) - the
frontend has displayed everything as ₹/INR all session. New seed data
stays consistent with the existing EUR/USD values rather than introducing a
third currency. Needs a decision (fix backend currency vs. frontend display)
before Phase 2 wiring makes the mismatch user-visible.

### 14.2 Phase 2.1 — Loans wired to real backend (done)

**Backend** (`loan/gql/repository.py`, `gql/mutations.py`, `mcp_tools.py`):
added `pay_emi(loan_id)` (pays the earliest pending installment, closes the
loan once every installment is paid) and `make_extra_payment(loan_id,
amount)` (pays off as many whole upcoming installments as the amount
covers - no partial-installment credit, since the fixed-schedule model
doesn't recompute amortization). Both added as plain GraphQL mutations
(matching `apply_loan`'s existing unguarded pattern - the raw GraphQL layer
has no ownership checks anywhere in this service, only `mcp_tools.py` does)
and as MCP tools with the same `_check_self_or_admin` ownership check as
`approve_loan`/`reject_loan`, so the AI Assistant gets the same capability
through the identity-injected path. Verified live against real seeded loans
(`payEmi` advanced LNBOBPER001's installment 6 from pending→paid;
`makeExtraPayment` on LNBOBCAR001 paid off 2 more installments).

**Frontend** (`lib/loanCenterService.ts` - full rewrite of the "active
loans" and "applications" sections, math functions like `calculateEMI`/
`generateSchedule`/`calculateEligibility` untouched): `useLoanAccounts()`
and `useLoanApplications()` now read real data via the existing
`useLoans()` React Query hook (was already fetching real GraphQL data but
unused - `Loans.tsx` was calling the local-state version instead).
`payEMI`/`makeExtraPayment`/`createApplication` now call new `bffClient`
methods (`payLoanEmi`/`makeLoanExtraPayment`/`applyForLoan`) and invalidate
the `["loans"]` query afterward via a newly-extracted `lib/queryClient.ts`
singleton (previously `queryClient` was a local const inside `App.tsx`,
unreachable from a non-component module without a circular import).

**Real backend constraint discovered and worked around**: `LoanType` (the
GraphQL type) has no `outstanding`/`principalPaid`/`interestPaid` fields -
loan-service only stores principal/rate/tenure and a flat EMI schedule
(installment number, due date, amount, paid/pending), no stored running
balance. `deriveLoanMetrics()` computes these client-side by walking the
same reducing-balance amortization formula loan-service itself uses,
for exactly as many installments as are marked "paid" server-side - not
a new independent calculation, the same math on both ends.
`applicantName`/`employmentType`/`monthlyIncome` on `LoanApplication`
aren't part of loan-service's schema either; name/email now come from the
real signed-in profile (`useAuth()`), employment/income render as "Not
provided" rather than a fabricated number.

Verified end-to-end through the actual dev-server proxy path
(`POST /api/graphql/loan`, same route `bffClient` calls) - `tsc -p
tsconfig.app.json`, ESLint, and `npm run build` all clean, zero new errors
beyond the pre-existing ones already tracked in section 13.8.

### 14.3 Phase 2.2 — Payments wired to real backend (done)

**Backend discovery**: payment-service's MCP tools (`processPayment`, `getPaymentStatus`, `cancelPayment`, `retryPayment` in `mcp_tools.py`) were already fully built and real - create payment, call transaction-service's `notifyTransaction`, mark paid/failed on the real outcome, with real cross-service ownership checks. The gap was purely that only `cancel_payment` was exposed as a GraphQL mutation; the web app (which calls GraphQL directly for payment-service, same as loan-service) had no way to reach `processPayment`/`retryPayment`.

Added `process_payment` and `retry_payment` GraphQL mutations to `payment/gql/mutations.py`, mirroring the MCP tool's create → `notify_transaction` → mark paid/failed flow (minus the MCP-only ownership re-derivation, same unguarded-raw-GraphQL convention as loan-service). Verified live: a real `processPayment` call created a payment, called real transaction-service, got back a real transaction id, and the resulting transaction is queryable from transaction-service afterward. `retryPayment`'s guard (rejects a non-`failed` payment) verified too.

**Frontend** (`lib/paymentActionService.ts` - full rewrite): "Pay now" for New Payment / Pay a Bill now executes as one real atomic mutation (create + notify + mark, no more fake 1s delay / 12% random failure). "Schedule for later" has no real backend equivalent (no service supports deferred execution) and stays a local-only draft - the only local state left in this file. Added `usePaymentActionRecords()` (real `paymentsByCustomer` query) to `hooks/useBankingData.ts`; `usePaymentActions()` now merges real records with local scheduled drafts.

**Real double-counting bug caught and fixed**: `Dashboard.tsx` used to merge `paidActionTransactions(paymentActions)` into the real transaction list, because paid payment actions used to be purely local (never in transaction-service). Now that "pay now" creates a *real* transaction-service row via `notify_transaction`, that merge would have double-counted every paid payment in spending/cash-flow charts. Removed the merge; `paymentActionDerived.ts`'s now-dead `toTransactionRecord`/`paidActionTransactions` removed too.

**Real infra gap found and fixed**: `vite.config.ts` never had a dev-server proxy entry for `/api/graphql/payment` at all (only customer/loan/credit/document/communication were proxied) - every new payment-service GraphQL call from the browser would have 404'd. Added the missing proxy rule; verified live through the actual dev-server path afterward.

### 14.4 Phase 2.3 — Credit Cards wired to real backend (done, biggest lift)

account-service had **zero** schema for freeze/security-settings/limit-requests/card-issuance before this - unlike loan/payment, this wasn't "add a mutation to existing tables," it needed real migrations.

**New migrations** (`account/migrations/versions/0002_card_management.py`, `0003_card_atm_withdrawals.py`, both applied to the real Postgres instance):
- `cards.frozen` boolean column (orthogonal to `status` - a card can be active *and* frozen)
- `card_security_settings` table (one row per card, auto-created with defaults on first read: online/international/contactless/ATM toggles + daily transaction/online limits)
- `card_limit_requests` table (id, card_id, current/requested limit, status, submitted_at)

**New account-service code**: `CardRepository` gained `freeze_card`/`unfreeze_card`/`unblock_card`/`get_security_settings`/`update_security_settings`/`request_limit_increase`/`get_limit_requests`/`issue_card` (issues and activates a real new card immediately - no underwriting queue exists in this system, matching the pre-existing Apply-for-Card UX). Exposed as **REST** (`routers.py`), matching account-service's existing convention (it already had REST, unlike loan/payment/credit) - `POST /cards/{id}/freeze|unfreeze|unblock|pay`, `GET/PUT /cards/{id}/security`, `POST/GET /cards/{id}/limit-requests`, `POST /accounts/{id}/cards`. Not added as MCP tools/GraphQL this round (scope call - the actual ask was the web Credit Card Management screen, not AI-assistant parity for these 5 actions; flagged here as a real follow-up if AI parity is wanted later).

**Frontend** (`lib/creditCardService.ts` - full rewrite): removed the local `overrides`/`addedCards` stores entirely - `frozen`, `status`, and `balance` are now genuinely live on every `useCards()` fetch, and issued cards appear through that same query once invalidated (no more separate merge in `CreditCardManagement.tsx`). `payCardBill` now does two real calls: `submitPayment` (payment-service, creates the transaction) then `payCardBalance` (account-service, debits the card) - **only if the payment actually succeeded**; a caught real bug in my own first draft would have debited the card even on a failed payment record, fixed before shipping. Offers/rewards/applications-as-a-concept stay local (no real card marketplace or underwriting queue, same scope boundary as loan-service's product catalog).

**Real infra gap found and fixed**: same class of issue as 14.3 - `vite.config.ts` had a proxy rule for `/api/accounts/` but nothing for bare `/api/cards/...`, which is what all 6 new endpoints are served under. Added `/api/cards/` → account-service; verified live afterward.

**Environmental interruption, not a code issue**: mid-verification, account-service (freshly restarted) stopped reaching Postgres - same network/TLS-interception symptom as the earlier documented incident (raw TCP to the DB host succeeded, but the Postgres/TLS handshake hung; the other 5 already-connected services kept working fine on their existing connections). Also caught the IP drifting twice more during this session (`152.57.190.234` → `27.6.178.207` → `152.57.234.15`), each requiring another `az postgres flexible-server firewall-rule update`. Resolved the same way as before - switching network - and all 6 endpoints were then reverified live through the real dev-server proxy path, including a real card-bill payment that correctly debited a card's balance (₹42,500 → ₹40,000).

**Verified**: `tsc -p tsconfig.app.json`, ESLint, `npm run build` all clean across every phase in this section; every new backend capability (Loans, Payments, Credit Cards) was proven live via curl against the real dev-server proxy path, not just direct-to-service.

## 15. Phase H — Investment as a real 9th microservice, prices from a real remote MCP server (2026-08-17)

Previous explicit instruction this session was "leave Investment as frontend-only simulation." User reversed that: wants a real service, with stock prices sourced from a real third-party remote MCP server (not scraped/faked), since the actual use case is "buy stocks, hold for ~1 year, check daily."

**Researched before writing any code** (an actual free, hosted, HTTP-reachable MCP server had to exist - nothing was assumed): confirmed **Alpha Vantage's official remote MCP server** (`alphavantage/alpha_vantage_mcp` on GitHub) at `https://mcp.alphavantage.co/mcp?apikey=...` - real, hosted, free tier available, and explicitly supports NSE/BSE Indian symbols (`RELIANCE.BSE` etc.) via its `GLOBAL_QUOTE` tool, matching the existing NSE-ticker portfolio data. Free tier is 25 requests/day, which shaped the design: prices are refreshed on a server-side timer (every 8h) and cached, never fetched live per page load.

### New service: `app/business-api/python/investment/`

Full 9th microservice, same shape as the other 8 (Postgres `investment_schema` + Strawberry GraphQL `/graphql` + MCP tools `/mcp`, port 8078) - scaffolded from scratch (`pyproject.toml`, Alembic migration, `db/`, `gql/`, `mcp_tools.py`, `main.py`), `uv sync`'d, migrated, and seeded with the same portfolio that used to live only in the frontend (5 holdings, Reliance/TCS/HDFC Bank/Infosys/ICICI Bank, for bob.user@contoso.com).

- **`stock_prices`** - the price cache. Only table `price_refresh.py` writes to; holdings always read from here, never call Alpha Vantage directly (keeps every UI load free and fast, and keeps the service inside the 25 req/day budget regardless of traffic). Tracks `last_error` per symbol so a failed refresh shows "stale/unavailable," not a silently wrong price.
- **`holdings`** - real positions (symbol, shares, weighted-average purchase price). `avg_purchase_price` recomputed on every additional buy, same convention the old frontend simulation used.
- **`stock_transactions`** - real buy/sell history.
- **`price_refresh.py`** - calls Alpha Vantage's remote MCP server as a client via `fastmcp.Client(url)` (already a shared dependency in every service - no new library needed), parses `GLOBAL_QUOTE`'s response defensively (handles both structured and text-block MCP response shapes), and never lets one bad symbol abort the whole batch. Runs once at startup and every 8h from the FastAPI lifespan, plus an on-demand `refreshPrices` mutation for a manual "Refresh Prices" button.
- `buy_stock`/`sell_stock` always resolve price from the server-side cache, never a client-supplied value - and correctly refuse to execute if that symbol hasn't been priced yet ("Price for X is not available yet"), rather than fabricating a price or silently succeeding at ₹0.

**Verified end-to-end via real curl calls** (against both the service directly and through the actual frontend dev-server proxy path): holdings/prices/transactions queries; buy/sell correctly reject when no cached price exists; buy/sell correctly execute once a price exists (weighted-average recompute confirmed, insufficient-shares-to-sell guard confirmed with the exact real error message); `company_name` auto-resolves from the price cache so the frontend doesn't need to pass it for any already-tracked symbol. Test trades were made and then cleaned up afterward, leaving the real seed state intact.

**What's blocked on the user, not on code**: `price_refresh.py` gracefully logs a warning and no-ops if `ALPHA_VANTAGE_API_KEY` isn't set (confirmed - service starts fine, no crash) - the live Alpha Vantage call itself hasn't been exercised yet because that requires a real API key only the user can obtain (free, instant, at alphavantage.co). One thing flagged as needing a live check once the key exists: the exact NSE/BSE symbol suffix format (`RELIANCE.BSE` was used per Alpha Vantage's documented international-listing convention, but community sources gave conflicting `NSE:` colon-prefixed examples) - may need a one-line adjustment to `TRACKED_SYMBOLS` in `db/seed.py` after the first real quote comes back.

### Frontend (`lib/investmentService.ts` - full rewrite, `pages/InvestmentPortfolio.tsx` updated)

`useHoldings`/`useMarketTrends`/`useInvestmentTransactions` now read real data via new `bffClient`/`useBankingData.ts` hooks (`useHoldings`, `useStockPrices`, `useStockTransactions`). `buyStock`/`sellStock` are real async mutations now. Added a "Refresh Prices" button (calls the on-demand mutation) and handled the "no price yet" state honestly throughout - the portfolio/market-trends tables show "Pending refresh" instead of a fabricated ₹0, and the trade dialog disables Buy/Sell with a clear message if the selected symbol hasn't been priced yet.

**New proxy route**: `/api/graphql/investment` added to `vite.config.ts` (same gap pattern as payment/cards in section 14.3/14.4 - a new backend surface needs its own dev-server route or the browser can't reach it at all).

**Verified**: `tsc -p tsconfig.app.json`, ESLint, `npm run build` all clean; holdings query verified live through the real dev-server proxy path.

**Not yet done**: live-verify the actual Alpha Vantage price fetch (blocked on the user's API key) and confirm/adjust the NSE symbol suffix format against a real response.

## 16. Phase I — Real Alpha Vantage verification + Investments dashboard redesign (2026-08-17)

User provided a real free Alpha Vantage API key. This closed out the one item Phase H left unverified, surfaced two real bugs that only a live call could catch, and was followed by a full visual redesign of the Investments page (from a reference image) built entirely on the resulting real data - no fabricated values anywhere.

### 16.1 Two real bugs found and fixed via live testing

1. **Response-shape bug**: `price_refresh.py`'s parser assumed the classic Alpha Vantage REST JSON shape (`{"Global Quote": {"05. price": ...}}`). A live call proved the actual MCP server returns something different entirely: `{"result": "<CSV string>"}` with header row `symbol,open,high,low,price,volume,latestDay,previousClose,change,changePercent` and one data row. The original parser silently "succeeded" with `price: null` and no error, since it never checked the price field was actually present after finding *some* dict. Rewrote `_parse_global_quote` to parse the real CSV via Python's `csv` module, and added a defensive check that null-prices a symbol as failed rather than marking it refreshed with nothing in it.
2. **Burst rate-limit bug**: refreshing all 8 tracked symbols back-to-back intermittently returned empty responses for otherwise-valid symbols (confirmed: `HDFCBANK.BSE`/`INFY.BSE` failed in a tight loop, succeeded every time when manually spaced out). Added a 2.5s gap between each symbol's request in the refresh batch.

**Also confirmed live**: the `.BSE` suffix convention (`RELIANCE.BSE` etc.) is correct - 7 of the 8 tracked symbols resolve real data. `TATAMOTORS.BSE` does not resolve (only its US ADR ticker `TTM` does, priced in USD - not a substitute for the BSE-listed share, so not used); swapped for `WIPRO.BSE`, confirmed working, in both `db/seed.py` and the live database. Real live prices confirmed for the portfolio: RELIANCE ₹1,308.00, TCS ₹2,359.00, HDFCBANK ₹727.35, INFY ₹1,169.05, ICICIBANK ₹1,418.00. Also hit and correctly handled the documented 25 req/day free-tier limit mid-testing (`{"error": {"type": "rate_limit", ...}}` response) - the existing "keep last known price, record last_error" design already handled this gracefully with no code change needed.

**Note on today's seed purchase prices**: the original `avg_purchase_price` values in `db/seed.py` were placeholder "flavor" numbers picked before any real price existed (e.g. RELIANCE at ₹2,650). Real current prices are substantially lower across most holdings, so the portfolio now correctly shows large real losses (~-40% overall) rather than the gains the placeholder numbers implied. This is the real math working correctly on admittedly-arbitrary seed data, not a bug - a realistic seed would need purchase prices sourced from real historical quotes, which is a reasonable follow-up if desired.

### 16.2 Investments page redesign (from a reference image)

Rebuilt `pages/InvestmentPortfolio.tsx` to match a provided reference design, with an explicit rule going in: every number shown must come from real pulled data and real calculations - where the reference called for data this system has no real source for, that piece was left out rather than faked.

**New `lib/investmentAnalytics.ts`** (pure calculations, same pattern as `transactionAnalytics.ts`/`cashFlow.ts`): portfolio value/gain-loss/invested-amount, **today's gain/loss** (genuinely real - Alpha Vantage's quote includes each symbol's change vs. previous close, so summing `shares × change` across holdings is a real day-over-day figure, not an estimate), best performer, sector breakdown (donut), top gainers/losers, watchlist (tracked symbols not currently held), and a live market-open/closed status with real countdown computed from actual NSE/BSE trading hours (09:15-15:30 IST, Mon-Fri) - pure clock math, no API call, ticks every second.

**New components** (`components/investments/`): `PortfolioKpis`, `MarketStatusBadge`, `PortfolioOverview` (sector donut), `TopMovers`, `WatchlistTable`, `LiveMarketTicker`.

**Deliberately substituted or omitted rather than faked**:
- Reference showed "Large Cap / Mid Cap" distribution - no market-cap classification exists in this data source, so the donut shows **sector** breakdown instead (real data this system actually has).
- Reference showed a historical "Portfolio Performance" line chart (1D/1W/1M/3M/1Y/All) - would need Alpha Vantage's `TIME_SERIES_DAILY` per holding, which couldn't be live-verified today (daily quota was exhausted by the testing in 16.1) - **left out of this pass** rather than shipping an unverified chart. Real transaction history already exists to reconstruct actual historical share counts correctly if this is built later (not just "current shares projected backward").
- Reference showed a Market Indices card (NIFTY 50/SENSEX/BANK NIFTY) - tested live, no confirmed working symbol format within today's quota - **omitted** rather than guessed.
- Reference showed an "Alerts" tab - no alert engine exists - **not built**.

**Verified**: `tsc -p tsconfig.app.json`, ESLint, `npm run build` all clean. Holdings/prices verified live through the real dev-server proxy path with real current prices. One test-only finding: combining two top-level GraphQL fields in a single request (e.g. `query { holdingsByCustomer stockPrices }`) throws a real `SQLAlchemy IllegalStateChangeError` from concurrent resolver execution sharing one session - this is a latent issue in the shared-session `gql/context.py` pattern used identically across all 9 services (not introduced by this phase), and doesn't affect the actual app: every real `bffClient` call sends its own single-field query, never a combined one. Documented here rather than silently worked around.
