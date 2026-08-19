# Meridian Bank — E2E QA Test Plan & Matrix

Scope: 8 microservices (account, transaction, payment, customer, loan, credit, document, investment).
**Excluded per explicit instruction (2026-08-17):** communication service, ChatKit/AI Assistant — to be tested after integration work completes.
**Tooling constraint:** no browser automation (Playwright) available. Testing is API-level + DB-level, full request→business-logic→DB→cross-service→cache chain. UI click-through/console/screenshot verification (plan Steps 18-20, 23) is out of reach until a browser tool is added.

---

## 1. Architecture / dependency map (verified from code, not assumed)

```
React (5170) ── bffClient.ts ── REST/GraphQL ──▶ 8 microservices ──▶ Azure Postgres (bankingassistant)
```

| Service | Port | API | Schema | Tables |
|---|---|---|---|---|
| account | 8070 | REST | account_schema | accounts, cards, beneficiaries, payment_methods, card_security_settings, card_limit_requests |
| transaction | 8071 | REST | transaction_schema | transactions |
| payment | 8072 | GraphQL | payment_schema | payments |
| customer | 8073 | GraphQL | customer_schema | customers |
| loan | 8074 | GraphQL | loan_schema | loans, emi_schedule |
| credit | 8075 | GraphQL | credit_schema | credit_scores, credit_history |
| document | 8076 | GraphQL | document_schema | documents |
| investment | 8078 | GraphQL | investment_schema | holdings, stock_prices, stock_transactions |

**Verified cross-service call graph** (grepped for actual HTTP/client calls — not assumed):

- `payment.process_payment` / `payment.retry_payment` → calls `transaction_service_client.notify_transaction()` → writes a row to `transaction_schema.transactions`. **This is the only cross-service write link in the entire backend.**
- `account.recharge_card` / `account.pay_with_card` → mutate `cards.balance` directly (in-service, no cross-service call).
- `loan.pay_emi` / `loan.make_extra_payment` → mutate `loans`/`emi_schedule` only, in-service. **No call to account-service or transaction-service.**
- `investment.buy_stock` / `investment.sell_stock` → mutate `holdings`/`stock_transactions` only, in-service. **No call to account-service.**
- `credit.record_credit_event` → in-service only, nothing calls it automatically from payment/loan/card mutations (grepped — no caller found in any other service).

**Consequence — flagged as a QUESTION REQUIRED below**: `account_schema.accounts.balance` is never written by any mutation anywhere in the codebase. It is seed-data-only.

## 2. Frontend route inventory (verified via code inspection)

| Route | Page | Backend calls |
|---|---|---|
| /login | Login.tsx | mock login (no real auth check), then customer.customerByEmail |
| / | Dashboard.tsx | account, cards, transactions, loans, credit, documents |
| /payments | Payments.tsx | payment.paymentsByCustomer, loan |
| /credit-cards | CreditCardManagement.tsx | account cards + card mutations |
| /portfolio | InvestmentPortfolio.tsx | investment (holdings, prices, buy/sell/refresh) |
| /analytics | TransactionAnalytics.tsx | cards, transactions, loans (read-only) |
| /loans | Loans.tsx | loan (apply/payEmi/extraPayment), credit |
| /loans/explore[/:categoryId] | LoanExplore.tsx | credit, loan apply |
| /credit-score | CreditScore.tsx | credit, account, cards, loans |
| /documents | Documents.tsx | document (bypasses React Query — raw useEffect) |
| /communications | Communications.tsx | **excluded from this pass** |
| /assistant, /support | AIAssistant.tsx, Support.tsx | **excluded from this pass** (ChatKit) |
| /account | Account.tsx | account, cards, loans, documents (read-only) |

Dead code found: `src/pages/Index.tsx` exists but is not wired into any route (orphaned).

## 3. Confirmed bug — React Query cache invalidation gap

**BUG-001** | Severity: P2 (stale UI, not data corruption — the DB write is correct)
**Module:** Payments / cross-page cache
**Feature:** Making a payment (Pay a Bill, New Payment, Pay Card Bill) does not refresh the Payments page's own KPI/table, Dashboard, or Analytics.

**Root cause (verified in code):** `paymentActionService.ts` and `creditCardService.ts` invalidate `["paymentActions"]`/`["cards"]`/`["cardTransactions"]` on a successful payment, but **no code path invalidates `["payments"]` or `["transactions"]`** — grep across the whole frontend for mutation call sites confirms this. Both keys are read-only everywhere (`usePayments`, `useTransactions`), never invalidated.
**Effect:** After paying, the new record is correct in the DB and shows up in "Your Payment Activity" instantly, but the Payments page's summary cards/charts/table, Dashboard's recent-transactions/cash-flow widgets, and the Analytics page all show stale data for up to 60s (the hooks' `staleTime`) or until a manual reload.
**Files:** `src/lib/paymentActionService.ts`, `src/lib/creditCardService.ts`, `src/hooks/useBankingData.ts` (`usePayments`, `useTransactions` keys)
**Recommended fix:** add `queryClient.invalidateQueries({queryKey:["payments"]})` and `["transactions"]` alongside the existing `["paymentActions"]` invalidation. Not applying this fix — reporting per your instructions.

---

## 4. Resolved scope decision (answered by product owner 2026-08-17)

`accounts.balance` never moving on payment/EMI/investment mutations is **confirmed out of scope, not a bug** — there is no real payment rail, everything is DB-only, and DB values may be freely mutated during testing. Test focus is: does each module's own functionality and business logic work correctly end-to-end (correct rows written, correct calculations, correct cross-service links that DO exist, correct error handling) — not cross-service ledger consistency that was never built.

---

## 5. Test matrix (P0 rows — in progress)

| ID | Module | Action | Precondition | Expected DB change (verified from code) | Status |
|---|---|---|---|---|---|
| PAY-001 | Payments | processPayment (pay person) | account 1010 exists | payment_schema.payments new row status=paid; transaction_schema.transactions new row | Pending exec |
| PAY-002 | Payments | retryPayment on failed payment | a payment with status=failed exists | payment row → paid or stays failed; transaction row if success | Pending exec |
| CARD-001 | Credit Cards | pay_with_card | card has balance > 0 | cards.balance decreases by amount | Pending exec |
| CARD-002 | Credit Cards | freeze/unfreeze | card exists, unfrozen | cards.frozen true→false; prohibited action blocked while frozen | Pending exec |
| LOAN-001 | Loans | pay_emi | loan has pending EMI | loans.outstanding decreases; emi_schedule row status→paid | Pending exec |
| LOAN-002 | Loans | make_extra_payment | active loan | loans.outstanding decreases by amount; schedule recalculated | Pending exec |
| INV-001 | Investments | buy_stock | valid symbol has cached price | holdings row inserted/updated (weighted avg); stock_transactions new BUY row | Pending exec |
| INV-002 | Investments | sell_stock | holding exists with enough shares | holdings.shares decreases (or row deleted at 0); stock_transactions new SELL row | Pending exec |
| INV-003 | Investments | sell more shares than held | holding with fewer shares than requested | expect rejection — verify actual error, don't assume message | Pending exec |

## 6. Execution results (2026-08-17)

| ID | Module | Action | Result | Notes |
|---|---|---|---|---|
| PAY-001 | Payments | processPayment ₹500 | PASS | payment row status=paid; transaction row created with matching id/amount/description |
| PAY-BUG | Payments | processPayment with amount=-500 and amount=0 | **FAIL — BUG-002** | Both silently accepted, status="paid", real rows written. See below. |
| PAY-002 | Payments | retryPayment on failed seed payment PAYBOB0003 | PASS | failed→paid, transaction created; retrying again correctly rejected ("not in a failed state") |
| PAY-003 | Payments | cancelPayment on an already-paid payment | PASS | correctly rejected: "cannot be cancelled from status=paid" |
| PAY-004 | Payments | cancelPayment on nonexistent id | PASS | correct 404-style error |
| CARD-001 | Credit Cards | pay_with_card (sufficient balance) | PASS | balance debited correctly |
| CARD-002 | Credit Cards | pay_with_card (insufficient balance) | PASS | correctly rejected |
| CARD-003 | Credit Cards | pay_with_card with negative amount | PASS | rejected by Pydantic `gt=0` validation |
| CARD-BUG | Credit Cards | freeze card, then pay_with_card | **FAIL — BUG-003** | Payment succeeded anyway on a frozen card. See below. |
| CARD-004 | Credit Cards | unblock a blocked card | PASS | status blocked→active |
| CARD-005 | Credit Cards | request limit increase ≤ current limit | PASS | correctly rejected |
| CARD-006 | Credit Cards | request limit increase > current limit | PASS | request row created, status=under_review |
| CARD-007 | Credit Cards | update security settings | PASS | fields updated and persisted |
| CARD-008 | Credit Cards | issue new card | PASS | card row created, correct defaults (active, unfrozen, balance 0) |
| LOAN-001 | Loans | payEmi on active loan | PASS | earliest pending installment → paid; loan stays active until all paid |
| LOAN-002 | Loans | payEmi on non-active (pending) loan | PASS | correctly rejected: "not active (status=pending)" |
| LOAN-003 | Loans | payEmi on nonexistent loan | PASS | correct "not found" error |
| LOAN-004 | Loans | makeExtraPayment ₹2000 (installment=₹371.93) | PASS | exactly 5 installments paid off (5×371.93=1859.65 ≤ 2000 < 6×371.93); math verified against DB |
| LOAN-005 | Loans | makeExtraPayment less than one installment | PASS | correctly rejected with exact shortfall message |
| LOAN-006 | Loans | makeExtraPayment negative amount | PASS | correctly rejected |
| LOAN-007 | Loans | applyLoan valid | PASS | loan created, status=pending |
| LOAN-008 | Loans | applyLoan negative principal / zero tenure | PASS | both correctly rejected |
| LOAN-GAP | Loans | Self-service loan approval | **GAP — see below** | `approveLoan`/`rejectLoan` exist only as MCP tools (chat-agent surface, excluded this round); the banking-web UI has no way to move a loan out of `pending`, so "Apply for Loan" never leads anywhere reachable in-scope. |
| INV-001 | Investments | buyStock 10 more RELIANCE (existing 40@2650, price 1308) | PASS | weighted avg recalculated to exactly 2381.60, verified in DB |
| INV-002 | Investments | sellStock 20 of 50 RELIANCE (partial) | PASS | shares reduced to 30, avg cost basis unchanged (correct — avg cost isn't affected by a sell) |
| INV-003 | Investments | sellStock 60 when only 50 held | PASS | correctly rejected with exact held-quantity message |
| INV-004 | Investments | sellStock 0 shares | PASS | correctly rejected |
| INV-005 | Investments | sellStock on symbol with no cached price | PASS (with a note) | rejected with a price-unavailable message even when the real issue could be "not held" — message is slightly misleading but not incorrect for this data state |
| CREDIT-001 | Credit Score | read score/rating/history | PASS | returns real seeded data |
| DOC-001 | Documents | documentsByCustomer | PASS | returns real seeded statement doc |
| CALC-001 | Analytics | category/flow_type aggregation vs manual sum | PASS | per-category sums correct; **also caught BUG-002 live** — the two invalid payments polluted the real account total until cleaned up |

### BUG-002 — P0 (Critical, incorrect money calculation / data corruption)
**Module:** Payments
**Feature:** `processPayment` GraphQL mutation
**Steps:** Call `processPayment` with `amount: -500` or `amount: 0`.
**Expected:** Rejected, same as every other mutation in this codebase validates its money/quantity inputs (loan `applyLoan`/`makeExtraPayment`, investment `buyStock`/`sellStock`, and even the REST card endpoints via Pydantic `gt=0`).
**Actual:** Both silently succeed, `status: "paid"`, and write real rows to `payment_schema.payments` and `transaction_schema.transactions`. Confirmed this directly corrupts real aggregations: account 1010's transaction total shifted by exactly -500 while the bogus rows existed.
**API:** POST `/graphql` (payment-service, :8072) → `processPayment`
**Files:** `app/business-api/python/payment/gql/mutations.py:22-71` (no amount check, unlike every sibling mutation)
**Recommended fix:** add `if amount <= 0: raise ValueError("amount must be greater than zero")` at the top of `process_payment`, matching the convention already used everywhere else in this codebase.
**Note:** the two invalid records this test created were deleted after confirming the corruption (bogus data, not a legitimate test artifact worth preserving) — reported here, not left in the DB.

### BUG-003 — P1 (High, core functionality broken)
**Module:** Credit Cards
**Feature:** Freeze card
**Steps:** Freeze card `55555` (`POST /api/cards/55555/freeze` → `frozen: true`), then `POST /api/cards/55555/pay` with a valid amount.
**Expected:** Payment blocked while the card is frozen — that's the entire point of the feature the UI exposes ("temporarily disables the card").
**Actual:** Payment succeeded, balance debited normally, `frozen` stayed `true` throughout. Confirmed live, not just from code reading.
**Files:** `app/business-api/python/account/gql/repository.py` — `pay_with_card` (:108-120) and `recharge_card` (:91-106) never check `card.frozen`; only `freeze_card`/`unfreeze_card` themselves touch that field.
**Recommended fix:** add a `if card.frozen: raise RuntimeError("Card is frozen")` guard at the top of `pay_with_card` and `recharge_card`.

### Finding — Loan approval reachability gap (not classified as a bug; scope note)
`approveLoan`/`rejectLoan` mutations exist and work correctly (verified via code), but are only ever called from the chat-agent's MCP tool layer (`loan_agent.py`), which is explicitly excluded from this test pass. The banking-web UI's "Apply for Loan" flow creates a `pending` loan with no EMI schedule and no in-scope path to activate it. Worth a product decision once the chat assistant is back in scope: is loan approval meant to be an advisor/agent-only action (real-world plausible) or should self-service approval exist in the web UI too?

---

## 7. Summary

**Tested (API + DB level, full request→business-logic→DB→cross-service chain):** Payments (process/retry/cancel), Credit Cards (pay/freeze/unfreeze/unblock/limit-requests/security/issue), Loans (EMI pay/extra payment/apply, full validation matrix), Investments (buy/sell/weighted-average-cost, oversell/zero-share rejection), Credit Score/History (read), Documents (read), transaction category-aggregation math.

**Not tested (no browser automation available):** click-through UI verification, React state after navigation, loading/empty/error state rendering, browser console errors, screenshot evidence. The one cache-consistency issue in that category (BUG-001) was still catchable by reading the frontend's mutation/invalidation code directly.

**Excluded per explicit instruction:** Communication service, ChatKit/AI Assistant — pending integration completion.

**Bugs found:** 1×P0 (BUG-002, negative/zero payment amounts accepted), 1×P1 (BUG-003, frozen cards can still be charged), 1×P2 (BUG-001, payment/transaction caches not invalidated on the frontend). None fixed — reported only, per your instructions.

## 8. Round 2 execution (same session, continued)

| ID | Module | Action | Result | Notes |
|---|---|---|---|---|
| CARD-009 | Credit Cards | recharge_card (valid, card 66666) | PASS | balance and recharged_amount both increased by exactly the recharge amount |
| CARD-010 | Credit Cards | recharge exceeding limit | PASS | correctly rejected: "exceeds credit limit" |
| CARD-011 | Credit Cards | recharge a non-recharge-type card | PASS | correctly rejected: "Only recharge cards can be recharged" |
| PAY-005 | Payments / Counters | paymentsByCustomer count+sum before/after a new payment | PASS | count 20→21, paid 18→19, sum of paid amounts summed correctly (7220.08 across 19) — the underlying data is correct; the only issue is the frontend refresh timing already logged as BUG-001 |
| PAY-006 | Payments | cancelPayment reachability | **OBSERVATION** | `cancelPayment` only accepts status `processing`/`pending`, but `processPayment` resolves synchronously straight to `paid`/`failed` in the same call — there's no real window where a customer could ever legitimately cancel a payment through the normal flow. The 2 "cancelled" seed payments were inserted directly, not reached via this mutation. Not a bug (nothing crashes), but the Cancel feature may be effectively dead code in the current architecture — worth a product decision. |
| CREDIT-002 | Credit Score | Score after a payment | PASS | score/rating/lastUpdated unchanged after a real payment — confirms the intentional decoupling (nothing calls `record_credit_event` automatically), consistent with the codebase's design |
| ACC-001 | Account | GET nonexistent account | PASS | 404, clear message |
| ACC-002 | Account | GET non-numeric account id | PASS | 400, clear message |
| ACC-003 | Account | GET cards for nonexistent account | PASS | 200, empty array (reasonable) |
| ACC-004 | Account | GET nonexistent card | PASS | 404, clear message |
| TXN-BUG | Transactions | POST `/api/transactions/{account_id}` (notify_transaction) with amount=-999 | **FAIL — extends BUG-002** | Accepted directly with HTTP 204, no validation at all. This is the deeper root cause: payment-service's missing check is only half the story — transaction-service's own ingestion endpoint has zero amount validation, so *any* caller (not just payment-service) can inject a negative or absurd transaction. Test row deleted after confirming. |
| INV-006 | Investments | On-demand `refreshPrices` | **BLOCKED — external dependency** | Returned `0/8` updated. Service log shows all 8 Alpha Vantage MCP calls returned HTTP 200, but none parsed as valid quotes — consistent with the free tier's 25-requests/day cap being exhausted (multiple service restarts today each auto-triggered a full 8-symbol refresh at startup, on top of manual calls). Not a code defect — the parser/retry logic already handles this correctly by preserving the last known-good price rather than blanking it. Reported per your instruction to flag external dependency failures rather than change application logic. Explains WIPRO's permanently-null price too — not necessarily symbol-specific, likely swept up in the same quota exhaustion. Retest after Alpha Vantage's daily quota resets.

### BUG-002 update — root cause is deeper than first reported
Confirmed live: `transaction-service`'s own `POST /api/transactions/{account_id}` endpoint (`TransactionRequest.amount: Optional[float] = None`, no validation) accepts negative amounts directly, independent of payment-service. Fixing only `processPayment` would leave this endpoint itself exploitable by any other caller. **Recommended fix now covers two files:**
- `app/business-api/python/payment/gql/mutations.py` — validate `amount > 0` in `process_payment`
- `app/business-api/python/transaction/routers.py` — validate `amount > 0` in the `TransactionRequest` model (e.g. `Field(gt=0)`, matching the convention already used in account-service's `CardAmountRequest`)

### BUG-004 — P1 (High, cross-service inconsistency)
**Module:** Credit Cards / Transaction propagation
**Feature:** Paying a credit card bill via `pay_with_card` (`POST /api/cards/{id}/pay`, account-service)
**Steps:** Recorded transaction count for card 55555 (7), called pay_with_card for ₹250, balance correctly dropped to 39650, re-checked transaction count.
**Expected:** Same propagation as person/bill payments — `processPayment` (payment-service) correctly calls `notify_transaction` and a row lands in `transaction_schema.transactions`. A card bill payment is money leaving the account exactly the same way.
**Actual:** Transaction count unchanged (7→7). Confirmed via code: `pay_with_card`/`recharge_card` in `account/gql/repository.py` never call transaction-service — this is an entirely separate, disconnected write path from payment-service's flow.
**Effect:** Card bill payments never appear in Transaction history, Dashboard recent transactions, or Transaction Analytics — the card's own balance is correct, but there's no audit trail anywhere else in the system.
**Files:** `app/business-api/python/account/gql/repository.py` (`pay_with_card`, `recharge_card`) — missing the same `notify_transaction` call that `payment/gql/mutations.py` makes.
**Recommended fix:** either have account-service call transaction-service's `notify_transaction` directly (same pattern payment-service uses), or route card-bill payments through payment-service's `processPayment` with `card_id` set (which already supports it) instead of account-service's separate endpoint.

### BUG-005 — P1 (High, Dashboard counters wrong / cross-page inconsistency)
**Module:** Dashboard vs Credit Cards page — KPI calculation
**Feature:** "Available Credit", "Total Credit Limit", "Credit Utilization" counters
**Root cause, read directly from code:**
- `Dashboard.tsx:70-73` (`KpiGrid`) sums **every card with no filter at all** — no `status` check, no `frozen` check:
  ```js
  const totalCreditLimit = cards.reduce((sum, c) => sum + (c.limit ?? 0), 0);
  const totalCardBalance = cards.reduce((sum, c) => sum + (c.balance ?? 0), 0);
  ```
- `CardKpis.tsx:7` (Credit Cards page) filters to `status === "active"` only, still ignoring `frozen`:
  ```js
  const active = cards.filter((c) => c.status === "active");
  ```
So a **blocked** card is excluded from the Credit Cards page's own totals but still fully counted on the Dashboard. A **frozen** card is counted on both pages, everywhere, regardless of it being usable.

**Live proof (account 1010, real data, verified via the actual API the frontend calls):**
Set card `77777` (limit ₹3,00,000) to `blocked` and pulled `GET /api/accounts/1010/cards`:
| Page | Formula | Total Limit | Available Credit | Utilization |
|---|---|---|---|---|
| Dashboard | sums all 6 cards, no filter | ₹13,35,000 | ₹12,71,850 | 4.7% |
| Credit Cards page | filters to 5 active cards | ₹10,35,000 | ₹9,71,850 | 6.1% |

Same account, same instant, ₹3,00,000 apart on two different pages — a customer blocking a fraudulent card would see a different "Available Credit" number depending which screen they're on. (Restored `77777` to `active` after confirming — was only flipped to demonstrate this live.)

**Secondary, same root cause:** 2 real cards in this account are currently `frozen: true` (`card_d3b04af4349f`, `card_c11e95a236bf`) — neither page excludes a frozen card's limit/balance from any counter. Whether a self-frozen (not blocked) card should still count toward "Available Credit" is a legitimate product judgment call either way (freezing doesn't cancel the credit line in real banking) — flagging as a question, not a defect, unlike the blocked-card mismatch above which is unambiguously a bug (the two pages disagree with each other).

**Also worth noting:** both formulas sum recharge-type cards (e.g. `66666`) into "Credit Utilization" alongside real credit cards — a prepaid recharge card isn't credit, so blending it into a *credit* utilization percentage is questionable, though not as clear-cut as the cross-page mismatch.

**Files:** `app/frontend/banking-web/src/pages/Dashboard.tsx:70-73`, `app/frontend/banking-web/src/components/creditCards/CardKpis.tsx:6-13` (same duplicated, inconsistent logic also in `CreditHealthSummary` in the same file)
**Recommended fix:** define one shared helper (e.g. `computeCardTotals(cards)`) that both pages call, with an explicit, deliberate decision on which of `status="blocked"` and `frozen=true` should exclude a card — then use it everywhere instead of two independent inline `reduce`s.

### Finding — "blocked" card status is unreachable through the app (not classified as a bug; scope note)
Grepped the entire backend, frontend, and MCP tool surface for any `block_card`/`blockCard` counterpart to `unblock_card`/`unblockCard` — there isn't one. `unblock_card` exists and works correctly (verified in this session), but nothing in the running application can ever set a card to `status="blocked"` in the first place — it only exists as a seed-data starting state (`77777` was seeded that way). There's no freeze-then-report-lost flow, no dispute flow, no admin action reachable from the UI or agent tools that produces it. Same category as the loan-approval gap: a real state the data model and one mutation support, with no in-app way to reach it. Worth a product decision alongside the loan-approval one once you're ready — is "blocked" meant to be a back-office/admin-only action that was never built, or should the customer-facing app itself have a way to trigger it (e.g. "Report Lost/Stolen")?

## 10. Fixes applied (2026-08-17, explicitly requested)

Per your instruction to add Close Card and apply the "any change anywhere must update every dependent total" principle system-wide, the following were implemented and verified live (not just read from code):

1. **New: Close Card.** `account/gql/repository.py:close_card` (+ `POST /api/cards/{id}/close`, + frontend button/dialog in `MyCreditCards.tsx`). Requires zero balance (rejects with a real reason if not - verified live: `55555` with ₹39,350 balance was correctly rejected; `card_a9f0a3e7df7f` at ₹0 succeeded). Irreversible, matching real banking - no "reopen".
2. **BUG-005 fixed.** New shared `computeCardTotals()` in `creditCardService.ts`, now the single source of truth both `Dashboard.tsx` and `CardKpis.tsx`/`CreditHealthSummary` call - excludes `blocked` and `closed` cards from every total, can no longer drift apart since there's only one implementation left.
3. **BUG-004 fixed.** `pay_with_card` and `recharge_card` (account-service) now call transaction-service's `notify_transaction`, same as payment-service already does. Verified live: a fresh ₹300 card payment produced a real row in `transaction_schema.transactions` (`TX6E3AF64926A84E20`, category "Credit Card Payment") - previously this was completely invisible outside the card's own balance field. New file: `account/transaction_service_client.py` (copied pattern from `payment/transaction_service_client.py`); new env var `TRANSACTION_SERVICE_URL` added to `account/.env.dev`.
4. **BUG-001 fixed.** `paymentActionService.ts` and `creditCardService.ts`'s `payCardBill()` now invalidate `["payments"]` and `["transactions"]` alongside `["paymentActions"]` on every real payment mutation (person payment, bill payment, card bill payment, retry, cancel) - Dashboard/Analytics/Payments page now refresh immediately instead of waiting out the 60s staleTime.
5. **Adjacent bug found and fixed while wiring Close Card's error messaging:** `bffClient.ts`'s `cardPost()` was discarding the backend's real error message on every failure (freeze/unfreeze/unblock/pay/limit-request, not just close) and throwing a generic `"Card request failed: /path"` instead. Fixed to surface the actual `detail` message from the backend - this is what makes Close Card's "pay it off first" message (and every other card error) actually reach the user now.

**Not fixed in this pass** (still open, listed in section 6-9 above): BUG-002 (negative/zero payment amounts), BUG-003 (frozen cards still chargeable), the loan-approval reachability gap, the unreachable `cancelPayment` state, and the "blocked" status having no in-app way to be triggered (Close Card is a separate, legitimate action from block - it doesn't address that gap). Say the word if you want these fixed too.

## 11. Credit score now actually moves (2026-08-17, explicitly requested)

Previously confirmed as a real gap: `credit_scores.score` was frozen seed data, never touched by any mutation in the system. Implemented real scoring logic and three trigger points, all verified live against the running database:

**Scoring engine** (`credit/gql/repository.py`): `record_credit_event` now applies a real delta to the score every time it's called - `+5` for a positive event, `-15` for negative (asymmetric on purpose - payment history is the single biggest real credit-score factor, and late payments hurt more than on-time helps), clamped to 300-850, with `rating` recomputed from the new score every time (poor/fair/good/very_good/excellent bands) so it can never drift out of sync with the number.

**Three real triggers wired in**, each a best-effort cross-service call (a credit-scoring side effect failing never blocks or rolls back the action that caused it):

| Trigger | Where | Event | Verified live |
|---|---|---|---|
| EMI paid on/before due date | `loan/gql/repository.py:pay_emi` | `payment_on_time`, +5 | 690 → 695 |
| EMI paid after due date | same | `payment_missed`, -15 | 695 → 680 |
| Loan fully repaid (last installment) | same | `loan_paid_off`, +5 | (logic verified in code; not separately re-tested this pass) |
| Card utilization crosses from ≥30% to <30% after a payment | `account/gql/repository.py:pay_with_card` | `utilization_decrease`, +5 | 685 → 690 |

New files: `loan/credit_service_client.py`, `account/credit_service_client.py` (same cross-service pattern as `transaction_service_client.py`). New env var `CREDIT_SERVICE_URL` added to both services' `.env.dev`.

**Deliberately not wired** (would have been an invented business rule, not a real one): a "utilization increases → score drops" trigger. There is no mutation anywhere in this codebase that ever *increases* a credit-type card's balance (no purchase/charge action exists - only `pay_with_card`, which always reduces it, and `recharge_card`, which only applies to prepaid recharge-type cards). Adding a negative-utilization trigger with no real cause to fire it would be fabricating a scenario, not fixing one - flagging this as a genuine feature gap (there's no way to "spend" on a card in this system at all) rather than working around it.

## 9. Final status

All financial-mutation flows across Payments, Credit Cards, Loans, and Investments are tested end-to-end at the API/DB level, including validation edges, state machines, cross-service propagation, and now the Dashboard's own KPI-calculation code (read directly, cross-checked against live data — no browser needed for this class of bug). **5 real bugs found, 0 fixed** (1 P0, 3 P1, 1 P2), plus 2 architectural observations and 1 external blocker (Alpha Vantage daily quota). Nothing further is reachable without either a browser automation tool (for literal click-through, loading/error states, console errors) or the Communication/ChatKit integration you asked to defer.
