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

Neon needs **two** connection strings: `DATABASE_URL` (pooled, hostname has `-pooler`) for the app, and `DATABASE_URL_UNPOOLED` (direct) for migrations. Both are already wired in `prisma/schema.prisma`.

## Phases

| Phase | Owner | Scope | Status |
|---|---|---|---|
| 0 — Boot | Opus 5 | Install, security patches, green build, Neon connected | **Done** |
| 1 — Stop the bleeding | Opus 5 | User bootstrap, Plaid consolidation, idempotent sync, token encryption, auth gating | **Done** |
| 2 — Tax engine | Fable 5.1 writes → Astra audits | `src/lib/tax/`, plus `Float` → `Decimal` migration | Ready |
| 3 — Real data | Gemini 3.8 Flash | Real chart aggregation, mileage as logged entry, transaction edit/delete | Blocked on 2 |
| 4 — Design | Fable 5.1 designs → Gemini converts | Enable Tailwind, component set, kill inline styles, responsive | Blocked on 2 |
| 5 — E2E + ship | Astra drives → Opus 5 integrates | Browser-driven verification, PDF export, Vercel | Blocked on all |

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

Still open:
- **The chart is hardcoded.** `api/dashboard/chart` returns seven literal month objects. It claims $36,000 gross against $47,500 of real data. (Phase 3)
- **Mileage is invented** — `amount * 0.25`, labeled "mock computation" in the source, rendered as a real number. (Phase 3)
- **Deduction detection is string matching** on `description.includes('amazon')`. (Phase 2)
- **Money is stored as `Float`.** Needs `Decimal(12,2)`. Migration verified as a plain `ALTER COLUMN ... SET DATA TYPE` — safe against existing rows. (Phase 2)
- **Tailwind 4 is installed but dead** — `globals.css` never imports it; everything is inline styles. (Phase 4)
- Two component directories: `src/app/components/` and `src/components/`. (Phase 4)
- An orphaned demo user (cuid id, 4 transactions) left over from the old seed script — invisible to the app, safe to delete.
- Stale `dev.db` / `prisma/dev.db` still tracked in git.
