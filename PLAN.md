# Multi-Hustle — Build Plan

Working agreement for the four agents on this repo, its history, and the items
still open. **Decisions and their reasons now live in
[`docs/decision-log.md`](docs/decision-log.md)**, and the rules every
contributor follows are in [`AGENTS.md`](AGENTS.md); this file keeps the build
history and the open list at the bottom.

## Scope

Portfolio project, built to product standards wherever that costs nothing extra.

**In scope:** correct tax engine with tests and IRS citations, `Decimal` money, encrypted Plaid tokens at rest, a visible "estimate, not tax advice" disclaimer, real error handling.

**Out of scope:** Plaid production access, audit logging, SOC2 posture. Plaid stays in **sandbox**. (GDPR/CCPA-style flows were out of scope until 2026-09-23; the privacy and consent layer is now built, [D50](docs/decision-log.md#d50).)

The app tells people what they may owe the IRS. Invented numbers are the main risk in this codebase — not code style. Any tax calculation must cite the rule it implements and have a test with a known answer.

## Ground rules

1. **One branch per agent.** Never two agents on `master`.
2. **Respect file ownership** (table below). If you need a file another agent owns this phase, say so — don't edit it.
3. **Phase 2 blocks Phases 3 and 4.** Phase 2 migrates `Transaction.amount` from `Float` to `Decimal`, and Prisma then returns `Decimal` objects instead of numbers — so every arithmetic expression touching it has to change at the same time. Phase 3 rewrites the chart aggregation over that exact column, and Phase 4 restyles pages whose data contract is about to move. Both wait.
4. **Verification happens after merge**, not against a branch three agents are mutating.
5. **No fabricated numbers.** If a value isn't derived from real data, it doesn't ship. See "Known fabrications" below.
6. This is **Next.js 16** — Middleware is renamed **Proxy** (`src/proxy.ts`). Read `node_modules/next/dist/docs/` before writing framework code; your training data is likely stale. See `AGENTS.md`.

## Environment

Single `.env` file at the repo root — **not** `.env.local`. The Prisma CLI reads only `.env`; Next.js reads both. One file keeps `prisma migrate` and `next dev` on the same values. Copy `.env.example` to start.

Schema changes ship as SQL under `prisma/migrations/` (see the README there). An existing database created with `prisma db push` is baselined once with `prisma migrate resolve --applied 20260909000000_init`, then `prisma migrate deploy`.

Neon needs **two** connection strings: `DATABASE_URL` (pooled, hostname has `-pooler`) for the app, and `DATABASE_URL_UNPOOLED` (direct) for migrations. Both are already wired in `prisma/schema.prisma`.

## Phases

| Phase | Owner | Scope | Status |
|---|---|---|---|
| 0 — Boot | Opus 5 | Install, security patches, green build, Neon connected | **Done** |
| 1 — Stop the bleeding | Opus 5 | User bootstrap, Plaid consolidation, idempotent sync, token encryption, auth gating | **Done** |
| 2 — Tax engine | Fable 5.1 wrote → Astra audited → Fable fixed | `src/lib/tax/`, plus `Float` → `Decimal` migration | **Done** — merged to `master`. Audited independently (11 findings, [triaged](docs/audits/federal-tax-2026-09-09/TRIAGE.md) and fixed); 161 tests, 270/270 boundary probes. Migrations applied to the main Neon DB 2026-09-09. |
| 3 — Real data | Gemini 3.8 Flash | Real chart aggregation, mileage as logged entry, transaction edit/delete | **Done** 2026-09-10; 3.5 (forms per tax year) by Opus 5 |
| 4 — Design | Fable 5.1 designs → Gemini converts | Enable Tailwind, component set, kill inline styles, responsive | **Done** 2026-09-10: no inline styles anywhere; `src/components/README.md` is the spec |
| 5 — E2E + ship | Astra drives → Opus 5 integrates | Browser-driven verification, PDF export, Vercel | **E2E done**: two browser passes ([first](docs/audits/e2e-2026-09-16/TRIAGE.md), [second](docs/audits/e2e-2026-09-18/REPORT.md)), every finding fixed. **Ship not started** — see the open list. |

### Note for Phases 3 and 4: the pages don't use the engine yet

*Resolved in Phases 3 and 4 — every page now reads the estimate payload.
Kept as the brief those phases worked from.*

Phase 2 delivered a correct engine. It did **not** change what the dashboard
displays. The pages still duplicate tax arithmetic locally, including the old
flat-12% assumption, so **the UI currently shows wrong numbers on top of
correct code**. Fixing that is the single highest-value item left.

Concretely, for whoever picks up Phase 3 or 4:

- Read the `estimate` payload from the engine instead of recomputing anything
  in a component. If a `.tsx` file does arithmetic on money, that's a bug.
- `GET /api/transactions` serialises amounts as decimal **strings** (Prisma
  `Decimal` → JSON). Phase 3 owns deciding that contract; don't paper over it
  with `parseFloat` in a component.
- Every liability figure must render the `disclaimer` string that comes back
  with the estimate, and the `warnings` array. The engine deliberately returns
  them alongside the number so a caller can't show one without the other —
  don't break that by dropping them.
- The estimate omits tax credits, so it runs **high**. Don't present it as a
  bill.

Five input fields added in Phase 2 have no database column or UI yet: W-2 box 7
tips, W-2 box 6 Medicare withholding, joint-return W-2 ownership, MFS
spouse-itemizes, and restricted scholarship amounts. They're optional, and the
engine warns when a missing one matters — so shipping without them is safe,
just less precise.

## File ownership

| Path | Owner | Phase |
|---|---|---|
| `prisma/**` | Opus 5 | 1, 2 |
| `src/lib/**` | Opus 5 | 1 |
| `src/lib/tax/**` | Fable 5.1 | 2 |
| `src/app/api/**` | Opus 5 | 1 |
| `src/app/**/*.tsx` | Gemini 3.8 Flash | 4 |
| `src/components/**` | Gemini 3.8 Flash | 4 |
| tests | whoever writes the code under test | — |

## Agent assignments and why

- **Opus 5** (Claude Code) — architecture, schema, risky refactors. Has repo context loaded.
- **Fable 5.1** (Claude Code, model toggle) — the tax engine only. Its edge over Opus is 3–4 points at 2× cost, so spend it on the one long-horizon, correctness-critical task.
- **Gemini 3.8 Flash** (Antigravity) — high-volume parallel work. ~305 tok/s, 1M context, 90.8% Terminal-Bench 2.1. Note: Antigravity's *Claude* models are 4.6-era, a generation behind — don't route Claude work there.
- **GPT-6 Astra** (Codex) — browser-driven E2E verification (computer use is its standout capability), plus a **cold adversarial audit** of the tax engine. Different lineage from whoever wrote it; same-family review is weak review.

## Known bugs and fabrications

Fixed in Phase 0:
- `t.description` null crash in `api/dashboard/summary` (was a loaded gun, not yet fired)
- Duplicate `style` attribute on `page.tsx` Source Breakdown — the grid layout was silently dropped
- `UserButton afterSignOutUrl` moved to `ClerkProvider` in current Clerk
- 16 npm vulnerabilities → 0, including a Clerk **authorization bypass** and a Next **Proxy bypass** (both directly exploitable in an auth'd financial app)

Fixed in Phase 1:
- User bootstrap (`src/lib/user.ts` + Clerk webhook) — every write route was failing on a `User` foreign key for accounts that hadn't first created a transaction
- Plaid client consolidated into `src/lib/plaid.ts` and now honours `PLAID_ENV`
- Sync made idempotent via `plaidTransactionId`; `modified`/`removed` events now handled
- **Sync cursor was saved before the writes** — a mid-loop failure advanced it past transactions that were never stored, losing them permanently. Now saved last.
- Plaid tokens encrypted at rest (AES-256-GCM, `src/lib/crypto.ts`); legacy plaintext rows still read and upgrade in place
- Connection state moved from `localStorage` to the database (`/api/plaid/status`)
- Auth gating in `proxy.ts` (optimistic; route handlers still check `auth()` themselves)
- **`prisma/seed.ts` called `deleteMany()` unfiltered on User, IncomeSource and Transaction** — running it wiped every account in the database, not just the demo one. Now requires `SEED_USER_ID`, refuses non-Clerk ids, and scopes deletes.
- Sync no longer auto-marks "Food and Drink" / "Shops" as `taxDeductible` — that flagged groceries as business expenses and understated tax owed. Defaults to false; real categorisation is Phase 2.

Fixed in Phase 2 (audited 2026-09-09, fixes merged 2026-09-10):
- **The tax calculation was invented.** Flat 12% with no brackets or standard deduction, 15.3% SE tax on the whole net profit, no QBI deduction. Replaced by `src/lib/tax/`: pure functions in Form 1040 order, every rule cited (IRC, Rev. Procs, form instructions), every function tested with hand-worked answers. Filing status and tax year are inputs; 2024–2026 parameters are transcribed from the Rev. Procs and self-checked by tests.
- **Deduction detection was string matching** on descriptions. Replaced by `Transaction.category` (nullable; vocabulary and tax treatment in `src/lib/tax/categories.ts`). Uncategorised income defaults to business income with a warning; uncategorised expenses followed the `taxDeductible` flag until the e2e audit (below) made the category the only input. Descriptions are never read.
- **Money was `Float`.** Eight columns across four tables are now `DECIMAL(12,2)`; the migration SQL is committed and was verified against Postgres 18 with float fixtures. `User.filingStatus` and `User.claimedAsDependent` added (defaults: `single`, `false`).
- **Mileage is no longer invented** in the summary (`0` until Phase 3 logs miles; `src/lib/tax/mileage.ts` prices logged miles at the year's rate).
- **Disclaimer** is part of every estimate (`disclaimer` in the summary response and in `FederalTaxEstimate`). Phase 4 must render it wherever a liability figure appears.
- The summary now covers only the tax year's transactions (default: current year, `?taxYear=` to override) and returns the full line-by-line `estimate` with `warnings`, `assumptions` and `notModeled`.
- **Cold audit (2026-09-09, `docs/audits/federal-tax-2026-09-09/`) addressed per its TRIAGE.md:** part-year simplified home office prorated; §199A(i) minimum no longer capped at taxable income; kiddie-tax warning no longer gated on dependency; W-2 boxes 6 and 7, joint-return W-2 ownership, MFS spouse-itemizes and restricted scholarships added to the engine input; per-business home office limits and refund netting documented and warned; 2025 Rev. Proc. section numbers corrected; brackets now also checked against the auditor's independent transcription.

Fixed after the end-to-end audit (2026-09-16, `docs/audits/e2e-2026-09-16/`, Group A, branch `e2e-group-a`):
- **Logged mileage never reached the calculation** (F1). Trips were priced after `estimateFederalTax` for display only, and the chart route never saw them. Mileage is now a Schedule C line 9 input (`ScheduleCInput.mileage`, priced per trip date; standard rate vs actual `car_and_truck` costs resolved as one method per Pub. 463 with a `vehicle_method_conflict` warning), and the summary and chart routes share one `estimateFromRows` so they cannot disagree.
- **The "tax-deductible" checkbox did nothing when a category was set** (F2). The category is now the only input: the checkbox is gone from the ledger, `personal` marks an expense non-deductible, an uncategorised expense is personal and warned, the API derives `taxDeductible` from the category and ignores it in request bodies, and migration `20260916000000_category_is_source_of_truth` moves manual un-ticked rows in deductible categories to `personal` and gives manual ticked uncategorised rows `other_business_expense` (Plaid rows untouched: their flag was a default or the removed heuristic, not a choice). Verified on PGlite; applied to main 2026-09-17, after which no row's flag disagrees with its category. The four rows it changed are listed in `prisma/migrations/README.md`.
- Adversarial review of the change (4 lenses, 2 skeptics per finding) confirmed and fixed: per-trip rounding on line 9 (now one product per rate period), only the first rate period cited, Plaid defaults misread as un-ticks by the migration, per-source deductions counting vehicle costs the engine excluded, the edit modal failing on legacy categories outside the vocabulary.

Fixed after the end-to-end audit, Groups B–D (2026-09-17, same TRIAGE):
- The ledger and its CSV now cover only the selected tax year (F3); the CPA Schedule C detail includes receipts with no assigned source (F5); the organizer states how many rows came from a bank instead of claiming "Plaid-verified" (F6); the tax year lives in the URL (F4); the not-modeled list is rendered under every estimate (F7).
- Input is refused rather than silently corrected — no more `.abs()` on edits or `Math.max(0, …)` on the home office (F8, F9, P3) — and one failing estimate no longer blanks the student and home office pages (F8).
- Sync adopts rows imported before `plaidTransactionId` existed instead of duplicating them on a re-link, comparing amounts as `Decimal` — a JavaScript number missed 3 of 15 real rows (D22).

Fixed after the second end-to-end pass (2026-09-23, `docs/audits/e2e-2026-09-18/`):
- The printed organizer drops no disclosure: the assumptions and not-modeled lists print expanded (S1, D25).
- The mileage rate card reads the year's rates from the engine instead of a `'0.725'` typed into the component (S2, D26); `GET /api/mileage` is scoped to the tax year even when the request omits it, which it previously was not.
- No browser dialogs remain (D24). The Deductions page loads independently like the others (D21).

Done in the redesign (2026-09-23, branch `ui-redesign`, D28–D38):
- **Every screen rebuilt for a first-time user**: light and dark themes, grouped navigation, a setup checklist, tax words that explain themselves, one tax-year picker in the header. Checked at `/preview` with sample data in light and dark, at 1280px and 375px.
- **The five optional inputs can be entered**, and more: W-2s (several per year, boxes 1–7, whose on a joint return), estimated payments, the tax profile (filing status, dependent, spouse itemizes), and grant money reserved for room and board.
- The mileage card shows what Schedule C took for the car, whichever method won.
- Per-source "deductible expenses" (entered, not allowed) are gone: the tax report shows Schedule C by line, entered and deducted.
- Account deletion no longer fails on `MileageLog` rows (D32).
- Plaid sync no longer creates a hustle per deposit description or resets the user's choice (D31).
- `dev.db` and `prisma/dev.db` are untracked (commit `c1ae8d2`).

Done in the policies, onboarding and phone change (2026-09-23, branch `legal-onboarding-mobile`, D39–D50):
- **Public pages outside sign-in**: a welcome page, About with the operator's details, and every policy under `/legal` (privacy, terms, cookies, refunds, delete or download your data, accessibility, licenses), linked from every footer; the app's own sign-in and sign-up pages. Signed-out visitors to `/` land on the welcome page.
- **A recorded agreement and an 18+ check** before the app opens, versioned and stamped by the server; a new version asks again; "I'm under 18" leads to deleting the account.
- **Data rights as buttons**: download everything as JSON, delete the account (every table, bank access revoked at Plaid, then the Clerk user), and "Disconnect" on the bank card. The Plaid consent line sits under "Connect a bank", and Link now shows the app's real name.
- **An informational cookie notice** (only essential storage, so no fake choice), security headers, `security.txt`, a written security program (`docs/security-program.md`), a legal changelog and third-party licence notices served at `/third-party-notices.txt` (`npm run notices`).
- **A guided tour** of every tab on the first visit, skippable and replayable, keyboard-driven, tested against the nav.
- **Phone**: bottom tab bar with quick add, slide-out menu, installable (manifest and icons), and the income chart no longer pushes a 375px screen sideways.
- **Accessibility**: contrast tested on the tokens (light faint, warning and danger darkened; text boxes outlined at 3:1), skip link, focus management, a text table behind the chart, a title on every page.
- Every estimate names the IRS figures it uses; claims on the welcome page were checked against the code; `User.plan` ("Pro Plan", for a plan that does not exist) is no longer read.

Done 2026-09-23 (branch `multiple-banks`, D52; migration `20260925000000_multiple_banks` applied to main first, counts unchanged): several banks per user, each listed with its own Disconnect, synced together (a failing bank does not stop the others); the same bank cannot be connected twice; deposits that look like money moved between the user's own accounts are flagged with a one-tap "Mark as transfer", and the estimate warns about them.

Still open (2026-09-23):
- **Bank re-authorisation.** When a bank's login expires, sync names it but cannot fix it: build Plaid Link update mode (a Link token with the connection's `access_token`) so the person signs in again on the same connection. Until then, disconnecting and reconnecting brings the bank's history in again (D52).
- **Once this release is live, drop `User.plan`** in its own migration (SQL in `prisma/migrations/README.md`, D47). Migration `20260924000000_consent_record` was applied to main on 2026-09-23, counts unchanged, and `legal-onboarding-mobile` was then pushed to `master` at the owner's request.
- **Shipping to real users** still needs a Clerk production instance (the app runs on Clerk development keys), a Neon production branch, the Clerk webhook secret, and hosting: the owner's call.
- **Operator details** (`src/lib/legal.ts`): Florida law and Miami-Dade County courts are set (2026-09-23, before anyone agreed). Still the owner's call: a postal address to publish (About says "on request"; a PO box or virtual mailbox keeps a home address off a public page and out of this public repository's history) and ideally a dedicated contact address instead of a personal mailbox. Changing any of them once users have agreed: bump `agreementVersion` and add a line to `docs/legal-changelog.md`.
- **The policies were written from the code, by no lawyer.** Have one review them before growth, and before Plaid production. Questions to put to them: whether the FTC Safeguards Rule (GLBA) covers a free estimator that reads bank transactions; whether to keep a de-identified record that a deleted account agreed to a version of the Terms (today deletion removes the only record); whether an 18+ checkbox is enough or a neutral birth-year question is needed.
- **Set `NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED=1`** in Vercel's environment (and your local `.env`), so Clerk's server SDK sends no telemetry either; the browser side is already off in code.
- **Accounts that never finish the agreement step** keep their name and email (from Clerk) until they are deleted. A periodic cleanup of accounts with no `agreementAcceptedAt` after 30 days, disclosed in the Privacy Policy's retention section, would close that; it needs a scheduled job, which the app does not have yet.
- **Owner safeguards** in `docs/security-program.md` §4: two-step sign-in on GitHub, Vercel, Neon, Clerk, Plaid and the mailbox; Neon history window at or below 30 days.
- **A full Content Security Policy** is deferred (D45): start one in report-only mode with Clerk's and Plaid's documented domains.
- **No signed-in click-through yet** of the agreement step, Account & privacy (download; delete on a throwaway account), "Disconnect" (on a fresh test user, never the populated sandbox account, D23), the tour on a real phone, and adding the app to a home screen. The redesign itself also still needs one.
- **Hustles made by the old sync** (one per deposit description, such as "Uber 063015 SF**POOL**") are still on the populated account. Tidy them under Income & expenses → Hustles: renaming one to another's name merges the two.
- **Re-link adoption has not run live.** The matching was verified read-only against the 15 real legacy rows (15 of 15); a same-item replay on a test account would test the rest. Never re-link the populated sandbox account (D23).
- **An orphaned demo user** (cuid id, 4 transactions) from the pre-rebuild seed script is invisible to the app and safe to delete.
