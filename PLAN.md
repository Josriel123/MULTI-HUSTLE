# Multi-Hustle — Build Plan

Working agreement for the four agents on this repo. **Read this before touching any file.**

## Scope

Portfolio project, built to product standards wherever that costs nothing extra.

**In scope:** correct tax engine with tests and IRS citations, `Decimal` money, encrypted Plaid tokens at rest, a visible "estimate, not tax advice" disclaimer, real error handling.

**Out of scope:** Plaid production access, audit logging, GDPR/CCPA flows, SOC2 posture. Plaid stays in **sandbox**.

The app tells people what they may owe the IRS. Invented numbers are the main risk in this codebase — not code style. Any tax calculation must cite the rule it implements and have a test with a known answer.

## Ground rules

1. **One branch per agent.** Never two agents on `master`.
2. **Respect file ownership** (table below). If you need a file another agent owns this phase, say so — don't edit it.
3. **Phase 2 blocks Phases 3 and 4.** Phase 2 migrates `Transaction.amount` from `Float` to `Decimal`, and Prisma then returns `Decimal` objects instead of numbers — so every arithmetic expression touching it has to change at the same time. Phase 3 rewrites the chart aggregation over that exact column, and Phase 4 restyles pages whose data contract is about to move. Both wait.
4. **Verification happens after merge**, not against a branch three agents are mutating.
5. **No fabricated numbers.** If a value isn't derived from real data, it doesn't ship. See "Known fabrications" below.
6. This is **Next.js 16** — Middleware is renamed **Proxy** (`src/proxy.ts`). Read `node_modules/next/dist/docs/` before writing framework code; your training data is likely stale. See `AGENTS.md`.

## Environment

Single `.env` file at the repo root — **not** `.env.local`. The Prisma CLI reads only `.env`; Next.js reads both. One file keeps `prisma db push` and `next dev` on the same values. Copy `.env.example` to start.

Schema changes ship as SQL under `prisma/migrations/` (see the README there). An existing database created with `prisma db push` is baselined once with `prisma migrate resolve --applied 20260909000000_init`, then `prisma migrate deploy`.

Neon needs **two** connection strings: `DATABASE_URL` (pooled, hostname has `-pooler`) for the app, and `DATABASE_URL_UNPOOLED` (direct) for migrations. Both are already wired in `prisma/schema.prisma`.

## Phases

| Phase | Owner | Scope | Status |
|---|---|---|---|
| 0 — Boot | Opus 5 | Install, security patches, green build, Neon connected | **Done** |
| 1 — Stop the bleeding | Opus 5 | User bootstrap, Plaid consolidation, idempotent sync, token encryption, auth gating | **Done** |
| 2 — Tax engine | Fable 5.1 wrote → Astra audited → Fable fixed | `src/lib/tax/`, plus `Float` → `Decimal` migration | **Done** — merged to `master`. Audited independently (11 findings, [triaged](docs/audits/federal-tax-2026-09-09/TRIAGE.md) and fixed); 161 tests, 270/270 boundary probes. Migrations applied to the main Neon DB 2026-09-09. |
| 3 — Real data | Gemini 3.8 Flash | Real chart aggregation, mileage as logged entry, transaction edit/delete | **Ready** |
| 4 — Design | Fable 5.1 designs → Gemini converts | Enable Tailwind, component set, kill inline styles, responsive | **Design done**: Tailwind on, tokens + component set in `src/components/` (spec in its README), responsive shell, dashboard and home office converted as the reference. Gemini converts deductions, student and export to the same pattern. |
| 5 — E2E + ship | Astra drives → Opus 5 integrates | Browser-driven verification, PDF export, Vercel | Blocked on all |

### Note for Phases 3 and 4: the pages don't use the engine yet

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

Fixed in Phase 2 (branch `phase-2-tax-engine`, pending audit):
- **The tax calculation was invented.** Flat 12% with no brackets or standard deduction, 15.3% SE tax on the whole net profit, no QBI deduction. Replaced by `src/lib/tax/`: pure functions in Form 1040 order, every rule cited (IRC, Rev. Procs, form instructions), every function tested with hand-worked answers. Filing status and tax year are inputs; 2024–2026 parameters are transcribed from the Rev. Procs and self-checked by tests.
- **Deduction detection was string matching** on descriptions. Replaced by `Transaction.category` (nullable; vocabulary and tax treatment in `src/lib/tax/categories.ts`). Uncategorised income defaults to business income with a warning; uncategorised expenses followed the `taxDeductible` flag until the e2e audit (below) made the category the only input. Descriptions are never read.
- **Money was `Float`.** Eight columns across four tables are now `DECIMAL(12,2)`; the migration SQL is committed and was verified against Postgres 18 with float fixtures. `User.filingStatus` and `User.claimedAsDependent` added (defaults: `single`, `false`).
- **Mileage is no longer invented** in the summary (`0` until Phase 3 logs miles; `src/lib/tax/mileage.ts` prices logged miles at the year's rate).
- **Disclaimer** is part of every estimate (`disclaimer` in the summary response and in `FederalTaxEstimate`). Phase 4 must render it wherever a liability figure appears.
- The summary now covers only the tax year's transactions (default: current year, `?taxYear=` to override) and returns the full line-by-line `estimate` with `warnings`, `assumptions` and `notModeled`.
- **Cold audit (2026-09-09, `docs/audits/federal-tax-2026-09-09/`) addressed per its TRIAGE.md:** part-year simplified home office prorated; §199A(i) minimum no longer capped at taxable income; kiddie-tax warning no longer gated on dependency; W-2 boxes 6 and 7, joint-return W-2 ownership, MFS spouse-itemizes and restricted scholarships added to the engine input; per-business home office limits and refund netting documented and warned; 2025 Rev. Proc. section numbers corrected; brackets now also checked against the auditor's independent transcription.

Fixed after the end-to-end audit (2026-09-16, `docs/audits/e2e-2026-09-16/`, Group A, branch `e2e-group-a`):
- **Logged mileage never reached the calculation** (F1). Trips were priced after `estimateFederalTax` for display only, and the chart route never saw them. Mileage is now a Schedule C line 9 input (`ScheduleCInput.mileage`, priced per trip date; standard rate vs actual `car_and_truck` costs resolved as one method per Pub. 463 with a `vehicle_method_conflict` warning), and the summary and chart routes share one `estimateFromRows` so they cannot disagree.
- **The "tax-deductible" checkbox did nothing when a category was set** (F2). The category is now the only input: the checkbox is gone from the ledger, `personal` marks an expense non-deductible, an uncategorised expense is personal and warned, the API derives `taxDeductible` from the category and ignores it in request bodies, and migration `20260916000000_category_is_source_of_truth` moves manual un-ticked rows in deductible categories to `personal` and gives manual ticked uncategorised rows `other_business_expense` (Plaid rows untouched: their flag was a default or the removed heuristic, not a choice). Verified on PGlite; **not yet applied to main**, see `prisma/migrations/README.md` for the command and the four rows it touches.
- Adversarial review of the change (4 lenses, 2 skeptics per finding) confirmed and fixed: per-trip rounding on line 9 (now one product per rate period), only the first rate period cited, Plaid defaults misread as un-ticks by the migration, per-source deductions counting vehicle costs the engine excluded, the edit modal failing on legacy categories outside the vocabulary.

Still open:
- **Mileage tab total vs the estimate.** `GET /api/mileage` prices each trip at the standard rate for the list; when actual `car_and_truck` costs are larger, the estimate applies those instead and deducts $0 of standard mileage, so the tab's total differs from what Schedule C took. The summary now exposes `sources.delivery.vehicleMethod`, `mileage` and `mileageDeduction` read back from the estimate; the tab should show those. (Owner of `MileageSection.tsx` / `api/mileage`.)
- **Per-source "deductions" are amounts entered**, not allowed: the 50% meals limit and the de minimis equipment cap are applied per category by the engine, so the per-source figure can exceed what Schedule C took. Excluded vehicle costs are now removed; the rest needs per-source attribution in the engine or a relabel on the dashboard and organizer.
- **The chart is hardcoded.** `api/dashboard/chart` returns seven literal month objects. It claims $36,000 gross against $47,500 of real data. (Phase 3)
- ~~**Mileage has no data source yet.**~~ Logged in Phase 3; wired into the estimate itself by the e2e audit fixes above.
- ~~**Tailwind 4 is installed but dead**~~ **Fixed in Phase 4.** `globals.css` imports Tailwind and aliases the existing palette as theme tokens; the dashboard and home office pages have zero inline styles. Deductions, student and export still carry theirs until Gemini converts them (`src/components/README.md` is the spec).
- ~~Two component directories~~ **Fixed in Phase 4.** `src/components/` only.
- **Phase 4 follow-ups for the remaining conversions:** `student/page.tsx` still computes `box5 - box1` locally and posts without a tax year; `deductions/page.tsx` and `export/page.tsx` still use the legacy `.card`/`.text-secondary` classes and lose list bullets under Tailwind's reset until converted. The student copy was rewritten in Phase 4 (no more "bypass the 15.3% penalty"); the layout was not.
- An orphaned demo user (cuid id, 4 transactions) left over from the old seed script — invisible to the app, safe to delete.
- Stale `dev.db` / `prisma/dev.db` still tracked in git.
- ~~**Form1098T, Form1098E and HomeOfficeDeduction have no tax year.**~~ **Fixed in Phase 3.5.** All three now carry `taxYear` under `@@unique([userId, taxYear])`, so a 2025 request no longer sees the 2026 statement. Year resolution is shared in `src/lib/taxYear.ts` rather than copied per route, and the fallback past the end of the parameter tables raises `tax_year_fallback` rather than applying the wrong year silently.
  - **Still open for Phase 4:** the student and office pages post without a year, so they always write the current one. There is no year picker anywhere in the UI, which means a user cannot enter or review a prior year's 1098-T even though the data model now supports it.
- `GET /api/transactions` now serialises `amount` as a decimal string (Prisma.Decimal → JSON). The pages coerce it fine via `Intl.NumberFormat`; Phase 3 should decide whether the API returns numbers. Pages still duplicate engine arithmetic locally (`student/page.tsx` assumes 12%, `office/page.tsx` assumes 27.3%); Phase 4 should read `estimate` instead. (Phases 3–4)
