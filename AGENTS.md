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

1. **No arithmetic on money and no tax facts in a `.tsx` file.** Pages read
   the estimate payload; rates, thresholds and citations come from the
   engine's parameters or constants. Even display ratios (bar widths, the
   share already paid) and totals are computed on the server, in
   `src/lib/dashboard.ts` or the route. (D16, D26, D34)
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
11. **Colours are tokens.** Components use the utilities backed by
    `src/app/globals.css`, never a typed colour; a new colour goes into the
    light block, the dark block and `@theme` together. (D33)
12. **Tax words on screen explain themselves.** Wrap one in `<Term>`; its
    definition lives in `src/lib/glossary.ts` and quotes rates only from
    engine constants. (D33)
13. **Paychecks are never wages.** Wages come from W-2s; a spouse's W-2
    counts only on a joint return; Social Security boxes are per person.
    (D28)
14. **The policies say what the code does.** A change to what is collected,
    who receives it (`SERVICE_PROVIDERS` in `src/lib/legal.ts`), the cookies
    and browser-storage keys, or how long data is kept updates the Privacy or
    Cookie Policy in the same commit; if it matters to users, bump
    `LEGAL.agreementVersion` and add a line to `docs/legal-changelog.md`, and
    everyone is asked to agree again. `legal-version.test.ts` fails on any
    edit to the Terms or Privacy Policy until that choice is made. (D39, D40,
    D42, D51)
15. **Nothing non-essential without an opt-in.** No analytics, ads, trackers
    or third-party widgets that set cookies or read storage until the person
    has said yes; then the Cookie Policy and the notice change first. That
    includes what an SDK does by itself (Clerk's telemetry is off). Nothing
    loads a third party before the person asks for it (Plaid waits for
    "Connect a bank"). No marketing email without consent, an unsubscribe link
    and a postal address (CAN-SPAM). (D41, D42)
16. **Claim only what the code does.** No testimonials, ratings, user
    counts, urgency, "bank-level" or "guaranteed"; state limits as plainly as
    features; never imply IRS affiliation or that the estimate is advice or a
    return. (D49)
17. **Public pages stay public.** A page a signed-out visitor needs (a policy,
    sign-in) lives in `src/app/(public)/` and is listed in the proxy's
    `isPublicRoute`; everything else sits behind sign-in and the agreement
    step in `src/app/(app)/`. (D39, D40)

## Data safety

- Schema changes are committed SQL in `prisma/migrations/`, applied with
  `npx prisma migrate deploy` — never `db push`. Write the SQL by hand when the
  table already holds rows. (D10)
- Never re-link the populated sandbox bank account: Plaid's sandbox
  regenerates its history on every link, so the account would show it twice.
  Use a fresh test user. (D23)
- `prisma/seed.ts` requires `SEED_USER_ID` and touches only that user.
- A new model with a `userId` must be added to `deleteUserData` and
  `exportUserData` in `src/lib/userData.ts` (the in-app deletion, the export
  and the Clerk `user.deleted` webhook all use them);
  `src/lib/__tests__/user-data.test.ts` reads the schema and fails until it
  is. (D32, D41)
- A migration that ships with code only adds (columns nullable or with a
  default). Drop or rename in a later migration, once no running release
  reads the old column: migrations are applied by hand and deploys happen on
  push, so both releases meet the same schema for a while. (D47)

## Process

- One branch per change. The owner pushes: `master` may deploy.
- A bug fix starts with a test that fails against the code it replaces.
- Record a decision in `docs/decision-log.md`, and update `README.md` and this
  file in the same commit wherever the decision changes what they say. (D27)
- Check a UI change at `/preview/<page>` (dev only, sample data through the
  real engine) in light and dark, at 1280px and 375px. It shows what the code
  renders; a signed-in click-through is still the final check. (D36) A new
  tab needs a `data-tour` and a tour step; a new colour pair needs a line in
  `contrast.test.ts`. (D43, D46)
- On Windows, stop `next dev` before `prisma generate` (and restart it after):
  the dev server holds the query engine open. `next build` has failed the
  same way.
