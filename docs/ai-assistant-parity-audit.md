# AI Banking Assistant — UI/Chat Parity Audit & Live Test Report

Scope executed this pass: **repository audit + live end-to-end testing** (Phases 1-4 + real chat tests). No implementation changes made yet — per the task's own Phase 5/6 ordering ("identify missing capabilities" before "implement only missing capabilities"), and because the gaps found are significant enough to warrant your sign-off on priority before building.

Two independent architectures exist and were audited: `azure_chat/*` and `foundry_v2/*` (mirror each other 1:1). **`foundry_v2` is the one actually running** (`AGENTS_TYPE=foundry_v2` in `app/backend/.env.dev`, confirmed from the live server's own startup log). A third, older `azure_chat/simple/*` tree also exists (account/transaction/payment only, no approval gating) — appears to be a legacy prototype, not used by the live `/chatkit` endpoint.

---

## 1. Architecture (as it actually runs)

```
React UI ──bffClient.ts──▶ 9 microservices ──▶ Azure Postgres
                                  ▲
                                  │ MCP (streamable HTTP)
                                  │
ChatKit UI ──/chatkit──▶ FastAPI ChatKit server
                                  │
                          HandoffOrchestrator (Azure AI Foundry, multi-agent)
                                  │
                    ┌─────────────┼──────────────────────────┐
              TriageAgent   8 specialist agents (one per domain, NO investment)
                                  │
                    IdentityInjectingMCPTool (per MCP server)
                                  │
                    same 8 services' MCP servers (investment excluded)
```

Real multi-agent handoff (Microsoft `agent_framework`), not a single mega-tool-list agent. `TriageAgent` routes by LLM judgment to one of: Account, TransactionHistory, Payment, Customer, Loan, Credit, Document, Communication. **No Investment agent exists.**

## 2. MCP tool inventory (verified from code, `app/business-api/python/*/mcp_tools.py`)

| Service | Tools | Mutating | Ownership-checked |
|---|---|---|---|
| account | `getAccountsByUserName`, `getAccountDetails`, `getRegisteredBeneficiary`, `getCreditCards`, `getCardDetails` | 0 of 5 | Yes |
| transaction | `getTransactionsByRecipientName`, `getCardTransactions`, `getLastTransactions` | 0 of 3 | Yes (cross-service) |
| payment | `processPayment`, `getPaymentStatus`, `cancelPayment`, `retryPayment` | 3 of 4 | Yes |
| customer | `getCustomerProfile`, `searchCustomers` (admin-only), `updateContactDetails` | 1 of 3 | Yes |
| loan | `applyLoan`, `getLoans`, `getLoanDetails`, `getEmiSchedule`, `approveLoan`, `rejectLoan`, `payEmi`, `makeExtraPayment` | 5 of 8 | Yes |
| credit | `getCreditScore`, `getCreditHistory` | 0 of 2 | Yes |
| document | `generateStatement`, `generateReceipt`, `generateLoanLetter`, `getDocument`, `listDocuments` | 3 of 5 | Yes |
| communication | `sendEmail`, `sendWhatsapp`, `sendNotification`, `getCommunicationHistory` | 3 of 4 | Yes |
| investment | `getHoldings`, `getStockPrices`, `buyStock`, `sellStock`, `refreshStockPrices` | 3 of 5 | Yes — **but never called by the agent backend at all** |

**Critical gap #1 — account-service has zero MCP tools for card actions.** Freeze, unfreeze, unblock, close (added this session), pay, recharge, security settings, limit requests, and card issuance are all REST-only. The AI cannot do any of these today, at the tool-definition level — not a routing bug, the capability genuinely does not exist for the LLM to call.

**Critical gap #2 — investment-service is fully implemented and MCP-ready, but zero-wired into the chat backend.** No `investment_agent.py` file exists in any agent tree; `settings.py` has no `INVESTMENT_MCP_URL`; the DI containers never instantiate an investment specialist. Confirmed by grep across the entire backend tree.

## 3. Confirmation / approval policy (real, framework-level — not prompt-only)

`IdentityInjectingMCPTool(..., approval_mode={"always_require_approval": [...]})` gates exactly these tools, verified in code and live:

| Agent | Gated tools |
|---|---|
| Payment | `processPayment` |
| Loan | `approveLoan`, `rejectLoan` |
| Communication | `sendEmail`, `sendWhatsapp`, `sendNotification` |

Everything else (including `customer.updateContactDetails`, `payment.cancelPayment`/`retryPayment`, `loan.payEmi`/`makeExtraPayment`/`applyLoan`, all 3 `document` generate-tools, and both `investment.buyStock`/`sellStock` if they were ever wired) has **no approval gate** — they'd execute immediately if the agent decided to call them. `payEmi`/`makeExtraPayment`/`applyLoan` not being gated is arguably fine (a loan payment isn't as destructive as approving someone else's loan), but worth a deliberate decision rather than an oversight.

## 4. Authorization model (defense in depth, verified in code)

1. `AuthMiddleware` resolves the real authenticated identity (or the mock Bob User when `AUTH_ENABLED=false`, which is the current dev state) into a per-request `ContextVar`.
2. `UserProfileProvider` injects it into the LLM's prompt context — **advisory only, not a security boundary** (guides the model on what ID to reference).
3. `IdentityInjectingMCPTool.call_tool()` **overwrites** whatever `callerCustomerId`/`callerRole` the LLM tried to pass, every single call, with the real authenticated values — the actual enforcement point on the client side.
4. Every MCP tool independently re-validates ownership server-side (`_check_self_or_admin` / `_check_account_ownership` / `_check_payment_ownership`) — the LLM cannot bypass this even if steps 2-3 were somehow compromised.

This is a genuinely sound design — confirmed live in every test (correct `callerCustomerId` on every tool call, matching Bob User throughout).

## 5. Live end-to-end tests run

All four ran against the **real** `foundry_v2` `HandoffOrchestrator`, real Azure AI Foundry (`gpt-4.1-mini`), real MCP servers, real Postgres — driven directly (bypassing only the ChatKit HTTP/SSE transport, which is OpenAI SDK boilerplate, not the integration under test). Test script left at `app/backend/test_agent.py` if you want to rerun or extend it.

| # | Test | Result |
|---|---|---|
| 1 | "What is my account balance?" | **PASS.** Triage → AccountAgent → real MCP call → real data (₹185,000 / ₹3,000 across 2 accounts) → correct grounded response. |
| 2 | "Freeze my Primary Platinum card." | **FAIL — real bug.** Agent correctly found the card, then said *"I will proceed to freeze it... I do not have direct capability... I will escalate this request to a service agent who can assist you immediately."* **No such escalation exists.** This is a fabricated promise — a direct violation of the "never hallucinate success" requirement. Root cause: gap #1 above. |
| 3 | "How is my Reliance stock doing?" | **Fails safely.** Triage correctly refuses: *"I am not able to help with stock market-related queries."* No fabricated price, no fabricated capability — honest limitation, not a lie. Root cause: gap #2 above. |
| 4 | Full 3-turn payment: "Pay 500 to ACME Energy" → provided bank code (agent correctly noticed ACME Energy wasn't a registered beneficiary and asked, rather than guessing) → "Yes, please proceed" | **PASS, fully verified.** Multi-turn context retained correctly across turns. Real confirmation summary shown before any tool call. Real `processPayment` approval gate triggered exactly as designed. Simulated the real "user clicks Approve" action → real execution. **Verified directly in Postgres**: `payment_schema.payments` count 28→29, new row `PAY4D0E0C248F00`, ₹500, status `paid`, correctly linked to a new `transaction_schema.transactions` row. This is the reference example of the whole system working exactly as the design intends. |

One infrastructure hiccup mid-testing: test #2's first attempt failed with a DB connection timeout — traced to the recurring Postgres firewall IP drift (your IP had changed to `27.6.178.207`, firewall rule still pointed at the old one). Fixed the same way as every prior occurrence this session; not an AI-integration bug.

## 6. Parity matrix (representative — full tool inventory above is the exhaustive version)

| UI Feature | Frontend mutation | MCP tool | Chat-reachable? |
|---|---|---|---|
| View balance | `getAccountDetails` | `getAccountDetails` | Yes — tested |
| Pay a bill/person | `submitPayment` | `processPayment` | Yes — tested, full trace verified |
| Retry/cancel payment | `retryPaymentAction`/`cancelPaymentAction` | `retryPayment`/`cancelPayment` | Yes (not live-tested this pass, tool exists + gated correctly per code) |
| Pay EMI / extra payment | `payLoanEmi`/`makeLoanExtraPayment` | `payEmi`/`makeExtraPayment` | Yes (tool exists, **not approval-gated** — flag below) |
| Apply for loan | `applyForLoan` | `applyLoan` | Yes (not approval-gated) |
| View credit score/history | `getCreditScore`/`getCreditHistory` | same | Yes |
| **Freeze/unfreeze/unblock/close card** | `freezeCard`/etc. | **none exist** | **No — confirmed broken, hallucinates a fake escalation** |
| **Recharge/pay card, security settings, limit request, issue card** | various | **none exist** | **No** |
| View/download statement | `getDocuments` | `generateStatement`/`getDocument` | Yes |
| **Buy/sell stock, view portfolio, get quote** | `buyStock`/`sellStock`/`getHoldings`/`getStockPrices` | tools exist, service running | **No — agent doesn't exist, not a routing gap, a missing agent** |
| Send email/notification | n/a (UI has no equivalent) | `sendEmail`/etc. | Yes, approval-gated |

## 7. Recommended next steps, in priority order

1. **Add MCP tools for account-service's card actions**, wrapping the existing `CardRepository` methods exactly the way loan/payment/investment already do (no new business logic — matches the task's explicit "add the MCP capability around the EXISTING business operation" principle). This directly fixes the hallucination bug in test #2, which is the most user-visible failure found.
2. **Build an `InvestmentAgent`** (both `azure_chat` and `foundry_v2` trees, matching the existing pattern) wired to investment-service's already-complete MCP tools, plus the `INVESTMENT_MCP_URL` setting and DI wiring. Decide whether `buyStock`/`sellStock` should join the approval-gated list (recommended: yes, matching `processPayment`'s treatment of real-money actions).
3. **Decide on approval-gating for `payEmi`/`makeExtraPayment`/`applyLoan`/`updateContactDetails`/`generateStatement` family** — currently ungated. Loan payments arguably don't need a gate (paying down your own debt is low-risk), but this should be a stated decision, not silence.

## 8. Implementation (2026-08-18, explicitly requested) — both priority gaps closed

### 1. Card MCP tools added (fixes the hallucination bug)
`app/business-api/python/account/mcp_tools.py` gained 10 new MCP tools wrapping the existing `CardRepository` methods (no new business logic - same pattern as every other service): `freezeCard`, `unfreezeCard`, `unblockCard`, `closeCard`, `payWithCard`, `rechargeCard`, `getCardSecuritySettings`, `updateCardSecuritySettings`, `requestCardLimitIncrease`, `issueCard`. Each resolves the card's owning account and enforces ownership before mutating, matching `getCardDetails`'s existing pattern.

`AccountAgent` (both `azure_chat` and `foundry_v2` trees) needed no tool-list changes - it already connects to the whole account MCP server, so the new tools were automatically discoverable. Updated its instructions to describe the new capabilities and explicitly forbid the failure mode found in testing ("never say you've escalated or forwarded a request... you either have the capability or you tell the user you can't"). Added `approval_mode` gating `closeCard`/`payWithCard`/`rechargeCard` (irreversible or money-moving), left freeze/unfreeze/unblock ungated (reversible, no money, meant to be fast - matches real banking UX for defensive card actions).

**Live-verified**: "Freeze my Primary Platinum card" → agent now asks which card to confirm, then calls the real `freezeCard` tool → DB confirmed `frozen: true` → restored to `false` after.

### 2. InvestmentAgent built and wired (fixes the missing-capability gap)
New `investment_agent.py` in both agent trees, connected to investment-service's already-complete MCP tools (`getHoldings`, `getStockPrices`, `buyStock`, `sellStock`, `refreshStockPrices` - no new business logic, matching the "wrap existing operations" principle). `buyStock`/`sellStock` are approval-gated, same policy as `processPayment`. Wired into: `settings.py` (`INVESTMENT_MCP_URL`), both `.env.dev` files, both DI containers, both `HandoffOrchestrator`s (constructor, handoff tool, triage routing rule, specialists list).

**Real bug found and fixed during this wiring**: `getStockPrices`/`refreshStockPrices` were the only 2 MCP tools in the entire system (out of 34) that didn't accept `callerCustomerId`/`callerRole` - every other tool does, by convention. `IdentityInjectingMCPTool` injects these into every outgoing call unconditionally, so calling either tool from chat failed with a Pydantic "unexpected keyword argument" validation error before it even ran. This never surfaced before because investment was never wired to an agent until now. Fixed by adding the two standard (unused) params to match the system-wide convention - not a workaround, brings the last 2 outlier tools in line with the other 32.

**Live-verified, full trace**: "How is my Reliance stock doing?" → correct routing, real holdings data (30 shares, avg ₹2381.60, current ₹1308.00), correct LLM-computed loss (-₹32,208). Then "Buy 3 shares of TCS" → real price fetched (₹2359.00, not fabricated) → correct order summary (3 × ₹2359 = ₹7,077) → approval gate fired on `buyStock` → confirmed → real execution. **Verified in Postgres**: TCS holding 37→40 shares, weighted average recalculated to exactly ₹3,068.12 (hand-checked, matches), new `buy` transaction row for 3 shares @ ₹2,359.00.

## 9. Final status

Both priority gaps from the audit are now closed and live-tested end-to-end with real DB verification - not just chat transcripts. 3 real bugs found and fixed in total this pass: the card-freeze hallucination (design gap, now closed), the `getStockPrices`/`refreshStockPrices` signature mismatch (only found because investment was actually exercised through the identity-injection layer for the first time), plus the account-service card actions being entirely unreachable from chat.

**Still open, not addressed this pass**: whether `payEmi`/`makeExtraPayment`/`applyLoan`/`updateContactDetails`/the 3 `document` generate-tools should also be approval-gated (currently they aren't - flagged as a decision, not fixed either way). `test_agent.py` left in `app/backend/` as a reusable direct-orchestrator test harness if you want to keep exercising this without the full ChatKit UI.
