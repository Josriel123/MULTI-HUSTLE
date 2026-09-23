<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on Multi-Hustle

Rules for anyone changing this code, person or AI agent. The reasons are in
[`docs/decision-log.md`](docs/decision-log.md) — the D-numbers below point
there. Before changing a directory, read its README: `src/lib/tax/`,
`src/components/`, `prisma/migrations/`. Open items are in `PLAN.md`.

This section sits below the block above, which `next dev` rewrites; it leaves
everything outside its markers alone.

## Invariants

1. **No tax arithmetic or tax facts in a `.tsx` file.** Pages read the
   estimate payload; rates, thresholds and citations come from the engine's
   parameters through the API. (D16, D26)
2. **Money is `Decimal` end to end.** Never compare money as a JavaScript
   number — build a `Prisma.Decimal` from `toFixed(2)`. Over the wire it is a
   decimal string, formatted at the render edge. (D2, D15, D22)
3. **Every figure from the estimate renders `EstimateNotice`** with its
   disclaimer, warnings, assumptions and not-modeled list. (D16)
4. **The year is resolved by `resolveTaxYear`** (`src/lib/taxYear.ts`) on the
   server and carried in the URL as `?taxYear=` on the client. A route that
   reads year-scoped data without it is a bug. (D13, D18)
5. **An expense's category is its only tax control.** Do not reintroduce a
   deductible checkbox; `personal` means not deductible. (D17)
6. **Refuse bad input; never correct it silently** — no `.abs()`, no clamping.
   Use `src/lib/validation.ts`. (D20)
7. **Independent requests load with `Promise.allSettled`.** A failing estimate
   must not blank data that loaded. (D21)
8. **No browser dialogs.** `useConfirm` from `ui/ConfirmDialog`, and
   `InlineStatus`, instead of `confirm()` and `alert()`. (D24)
9. **Anything a paper reader needs prints expanded.** A closed `<details>`
   does not print. (D25)
10. **Proxy is optimistic; every route handler authenticates itself.** (D7)

## Data safety

- Schema changes are committed SQL in `prisma/migrations/`, applied with
  `npx prisma migrate deploy` — never `db push`. Write the SQL by hand when the
  table already holds rows. (D10)
- Never re-link the populated sandbox bank account: Plaid's sandbox
  regenerates its history on every link, so the account would show it twice.
  Use a fresh test user. (D23)
- `prisma/seed.ts` requires `SEED_USER_ID` and touches only that user.

## Process

- One branch per change. The owner pushes: `master` may deploy.
- A bug fix starts with a test that fails against the code it replaces.
- Record a decision in `docs/decision-log.md`, and update `README.md` and this
  file in the same commit wherever the decision changes what they say. (D27)
- On Windows, stop `next dev` before `next build` or `prisma generate`; both
  need files the dev server holds open.
