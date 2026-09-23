# Decision log

Why this codebase is the way it is. Each entry records one decision, the
reason, and — where one was genuinely weighed — the alternative that lost.
Entries are never rewritten after the fact: a later decision that changes an
earlier one says so and links back.

**Adding an entry.** Append it at the bottom with the next number, and in the
same commit update `README.md` and `CLAUDE.md` / `AGENTS.md` wherever the
decision changes what they say. Link the commit, audit or file that holds the
evidence. If a decision replaces an earlier one, add *Superseded by Dn* to the
old entry and change nothing else in it.

## Index

| Area | Entries |
|---|---|
| Scope and process | [D1](#d1) · [D9](#d9) · [D12](#d12) · [D27](#d27) |
| Data and money | [D2](#d2) · [D3](#d3) · [D10](#d10) · [D15](#d15) · [D20](#d20) · [D22](#d22) |
| Tax engine | [D8](#d8) · [D11](#d11) · [D13](#d13) · [D14](#d14) · [D17](#d17) |
| Auth, Plaid and security | [D4](#d4) · [D5](#d5) · [D6](#d6) · [D7](#d7) · [D23](#d23) |
| UI | [D16](#d16) · [D18](#d18) · [D19](#d19) · [D21](#d21) · [D24](#d24) · [D25](#d25) · [D26](#d26) |

---

## 2026-09-09 — Rebuild begins

### <a id="d1"></a>D1 · A portfolio piece, built to product standards where that is free

**Decision.** Scope the app as a portfolio project, not a product people rely
on. Build to product standards wherever that costs nothing extra: a correct,
cited tax engine; exact money; encrypted bank tokens; a visible "estimate, not
tax advice" disclaimer. Leave out what is expensive and only matters for a real
launch: Plaid production access, audit logging, GDPR/CCPA flows, SOC2 posture.
Plaid stays in its sandbox.

**Why.** The expensive part of "real" is compliance and infrastructure, not
code quality. The cheap parts are exactly what makes a portfolio piece hold up
when someone pokes at it — and nothing here has to be rewritten to go real
later; the compliance layer would only be added.

### <a id="d2"></a>D2 · Postgres (Neon) everywhere; money is DECIMAL(12,2), never Float

**Decision.** One database engine for every environment — Postgres on Neon —
and every money column is `DECIMAL(12,2)`.

**Why.** Binary floats cannot hold `0.10` exactly, and summing a year of
transactions then multiplying by tax rates drifts by cents on a document
someone hands their accountant. Prisma's Decimal support on SQLite is
second-class, so the money fix and the database choice were the same decision.
Neon's copy-on-write branches were a bonus for parallel agents.

**Instead of.** SQLite for local development, which the original README
described. Two engines also meant two schemas to keep in step.

**Where.** `prisma/schema.prisma`; migration `20260909000100_money_decimal`.

### <a id="d3"></a>D3 · One `.env` file, two database URLs

**Decision.** Configuration lives in a single `.env` at the repo root — not
`.env.local` — with a pooled `DATABASE_URL` for the app and a direct
`DATABASE_URL_UNPOOLED` for migrations.

**Why.** The Prisma CLI reads only `.env`; Next.js reads both, so one file keeps
`prisma migrate` and `next dev` on the same values. Neon's pooler (hostnames
containing `-pooler`) suits serverless request bursts but cannot give
migrations the session-level control they need.

**Where.** `.env.example`, `prisma/schema.prisma` (`directUrl`).

### <a id="d4"></a>D4 · User rows are created two ways: the Clerk webhook, and on first write

**Decision.** Every table hangs off a `User` row whose id is the Clerk user id.
The Clerk webhook (`/api/webhooks/clerk`) creates and deletes it; independently,
`requireUser()` in `src/lib/user.ts` creates it on the first write if it is
missing, and every write route calls it.

**Why.** Only one route used to create the row, so a new account's first
1098-T, home office or bank link failed on a foreign key. The webhook cannot
fire in local development — Clerk has no public URL to call — so the fallback
is not optional.

**Evidence.** The first end-to-end audit confirmed that a fresh account's
first write succeeds on all five manual entry routes, with no foreign-key
error.

### <a id="d5"></a>D5 · Plaid access tokens are encrypted at rest

**Decision.** AES-256-GCM with a key from `ENCRYPTION_KEY`, stored as
`v1:<base64(iv | tag | ciphertext)>`. Values without the `v1:` prefix are
treated as legacy plaintext: still read, and re-encrypted on the next sync.

**Why.** A Plaid access token grants read access to a bank account. The
envelope prefix let an existing plaintext token keep working without a data
migration.

**Where.** `src/lib/crypto.ts`.

### <a id="d6"></a>D6 · Plaid sync is idempotent, and never decides what is deductible

**Decision.** Rows are keyed on Plaid's `transaction_id`
(`Transaction.plaidTransactionId`, unique); `modified` and `removed` events are
applied; the sync cursor is saved only after the writes succeed. Synced
expenses arrive with no deduction.

**Why.** The original sync re-inserted everything on every run, ignored edits
and reversals, and saved its cursor first — so a failure part-way through
skipped transactions permanently. It also marked "Food and Drink" and "Shops" as
tax-deductible, which treats groceries as a business expense. Understating tax
is the failure this app most needs to avoid; the user categorizes instead.

**Where.** `src/app/api/plaid/sync/route.ts`. *Amended by [D22](#d22).*

### <a id="d7"></a>D7 · Proxy is an optimistic gate for pages; route handlers authorize

**Decision.** `src/proxy.ts` (Next.js 16's renamed middleware) redirects
signed-out page navigations to sign-in. It lets `/api/*` through, and every
route handler checks `auth()` or `requireUser()` itself.

**Why.** The Next.js docs are explicit that Proxy is not a full authorization
layer. Gating `/api/*` there as well (2026-09-10) turned every handler's JSON
401 into a 307 to Clerk's HTML sign-in page, so a `fetch` whose session had
expired choked parsing HTML as JSON.

**Where.** `src/proxy.ts`; commit `f22014f`.

### <a id="d8"></a>D8 · The federal engine is pure, cited and tested — and runs high

**Decision.** All tax logic lives in `src/lib/tax/` as pure functions (no
database, network or auth) that follow Form 1040's order. Every rule cites its
source — Internal Revenue Code section, Revenue Procedure or form line — and
every function has known-answer tests. Federal only; filing
status and tax year are inputs; parameters for 2024–2026 are transcribed from
the IRS Revenue Procedures. Tax credits are not modeled, so the estimate runs
high, and the UI never presents it as an amount owed.

**Why.** The original calculation was invented: a flat 12%, self-employment tax
on the wrong base, no brackets, no standard deduction. For an app that tells
people what they may owe the IRS, invented numbers are the main risk — larger
than any code-quality problem.

**Where.** `src/lib/tax/README.md` (computation order, sources, omissions);
`NOT_MODELED` in `src/lib/tax/disclaimer.ts`.

### <a id="d9"></a>D9 · Code that matters is audited cold by a different model

**Decision.** The engine was written by one model (Claude Fable 5.1) and
audited by one from a different lineage (GPT-6 Astra), which was told nothing
about who wrote it. Findings are triaged before anyone fixes them. The
engine's fixes each started from a test ported from the audit that failed
first; the browser end-to-end passes followed the same audit-then-triage shape.

**Why.** A test written by the code's author cannot catch the author's
misreading of the underlying rule. The first audit found exactly that: the
§199A(i) minimum was capped at taxable income, and the engine's own test
asserted the cap. Triage before fixing keeps an audit's findings from turning
into an unrequested feature expansion.

**Where.** `docs/audits/` — each audit has its report and a triage.

### <a id="d10"></a>D10 · Schema changes ship as committed migrations; hand-written when rows exist

**Decision.** Every schema change is a SQL migration under `prisma/migrations/`
applied with `prisma migrate deploy`, never `db push`. When a change touches a
table that already holds rows, the SQL is written by hand. Migrations were
applied straight to the main Neon database rather than a branch.

**Why.** `db push` leaves `_prisma_migrations` behind. Prisma's generated SQL
for the tax-year change added a `NOT NULL` column in one statement, which fails
on any table with rows; the hand-written version adds it nullable, backfills,
then enforces it. Applying to main was the owner's call for small, verified
migrations, with Neon's point-in-time restore as the fallback.

**Where.** `prisma/migrations/README.md`.

---

## 2026-09-10 — Engine audit triage, real data, design

### <a id="d11"></a>D11 · Err high when a fact is unknowable and the error would be large

**Decision.** Where the engine cannot know a fact, it takes the conservative
reading when being wrong would understate tax by a lot, and otherwise makes the
most likely assumption and says so in a warning.

**Why.** A joint-return W-2 whose owner is unconfirmed is kept out of the
self-employment Social Security base: in the audit's scenario, wrongly
including it hid $11,451.40 of self-employment tax. A married-filing-separately filer who hasn't said
whether their spouse itemizes still gets the standard deduction, because most
can take it — defaulting to zero would make the estimate wrong for most such
filers. A blanket "always err high" rule gets the second case wrong.

**Where.** `docs/audits/federal-tax-2026-09-09/TRIAGE.md` (F2, F5).

### <a id="d12"></a>D12 · Audit findings become a fix, a small input, a guard, or a documented limit

**Decision.** For each finding: fix logic bugs outright; add an optional input
when the missing fact is one field (W-2 boxes 6 and 7, MFS spouse-itemizes,
restricted scholarships); guard rather than build when full support needs a
new model (joint returns get an ownership flag, not per-spouse Schedule SE);
document and warn when representing the fact needs new schema (per-business
home office limits, refunds netted against the purchase).

**Why.** The alternative to building a missing rule is not to stay silently
wrong; it is to refuse or warn, and disclose. That keeps the engine honest
without turning an audit into a rewrite.

**Where.** `docs/audits/federal-tax-2026-09-09/TRIAGE.md`.

### <a id="d13"></a>D13 · Forms belong to a tax year, and the year is resolved in one place

**Decision.** Form 1098-T, 1098-E and the home office record are unique per
`(userId, taxYear)`. Every route resolves the year through
`src/lib/taxYear.ts`: an explicit year if supported, otherwise the current
year, otherwise the latest supported year with a `tax_year_fallback` warning.

**Why.** Keyed on the user alone, whichever form existed applied to every year
— a 2025 estimate used the 2026 1098-T without a word. The fallback is never
silent because applying one year's rules to another's income is a real
difference.

### <a id="d14"></a>D14 · Mileage is logged, never inferred

**Decision.** A mileage deduction exists only for trips recorded in
`MileageLog`, each priced at the IRS standard rate in force on its date.

**Why.** The original dashboard multiplied income by 0.25 and displayed the
result as miles. The IRS requires contemporaneous records (IRC §274(d)), and
the rate can change mid-year — it did on 2026-07-01.

### <a id="d15"></a>D15 · Money and miles cross the wire as decimal strings

**Decision.** APIs serialize `Decimal` values as strings (`"18400.00"`), and
pages format them at the last moment with `Intl.NumberFormat`.

**Why.** A `Decimal` does not survive JSON as a number without risking
precision, and `parseFloat` scattered through components would reintroduce the
drift [D2](#d2) removed.

### <a id="d16"></a>D16 · The UI systematizes the existing look, and never does tax arithmetic

**Decision.** Tailwind 4 maps the app's existing dark palette to theme tokens;
the design was systematized, not redesigned. No `.tsx` file computes a tax
figure — pages read the estimate payload. Every screen showing a figure from
the estimate renders `EstimateNotice` with the disclaimer, warnings and
assumptions.

**Why.** The engine returns the qualifying text beside every number so that no
caller can show one without the other. A restyle that drops it, or a component
that recomputes a figure, silently undoes the engine's correctness.

**Where.** `src/components/README.md`. *Extended by [D26](#d26).*

---

## 2026-09-16 — End-to-end audit, first pass

### <a id="d17"></a>D17 · An expense's category is the only control for its tax treatment

**Decision.** The "tax-deductible" checkbox is gone. The category decides; the
`personal` category means not deductible; `taxDeductible` is derived from the
category on every write and never read by the engine.

**Why.** Two controls for one concept disagreed, and one silently lost:
clearing the box did nothing when a category was set. The data migration
treated an un-ticked box on a manual row as a deliberate choice and on a
bank-synced row as the sync's default.

**Where.** Migration `20260916000000_category_is_source_of_truth`;
`docs/audits/e2e-2026-09-16/TRIAGE.md` (F2).

### <a id="d18"></a>D18 · The selected tax year lives in the URL

**Decision.** `?taxYear=YYYY`, read and written by `useTaxYear`.

**Why.** Five pages each held their own year state, so navigating reset it and
a prior-year expense could be filed under the current year. The URL survives
navigation, can be shared, and matches what the API already accepted.

### <a id="d19"></a>D19 · The CPA organizer states provenance; it never asserts verification

**Decision.** The organizer counts how many rows came from a linked bank and
how many were typed in. The preparer's signature line is an attestation they
sign, not a claim the app makes.

**Why.** It carried three unconditional claims — "Plaid-verified ledger
integrity" among them — above accounts that had never linked a bank. This is
the document handed to a tax preparer.

### <a id="d20"></a>D20 · Input is refused, never silently corrected

**Decision.** `src/lib/validation.ts` rejects negative, non-numeric and
out-of-range money, and an office larger than the home, with a message naming
the field.

**Why.** Editing an amount to `-9` stored `9`; a negative office area became
`0`. In a tax app the user believes the value they typed is the value stored;
rewriting it without saying so is worse than refusing it.

### <a id="d21"></a>D21 · Independent requests load independently

**Decision.** A page that fetches several things uses `Promise.allSettled` and
applies each result on its own; a year shown on the page comes from a response
that answers for that page, not from the estimate.

**Why.** With `Promise.all`, one invalid home office record broke the estimate,
and the rejection blanked the student forms and disabled Save on the one page
that could repair the record.

---

## 2026-09-17 to 2026-09-23 — Hardening and the second pass

### <a id="d22"></a>D22 · Legacy bank rows are adopted on sync, not backfilled

**Decision.** Rows imported before `plaidTransactionId` existed are matched on
sync by owner, date, signed amount and description, and adopted rather than
duplicated. The amount is compared as a `Decimal` built from `toFixed(2)`,
never as Plaid's raw JavaScript number.

**Why.** A backfill would need live Plaid calls and fuzzy matching, and the
cursor had already moved past those rows. Comparing a JavaScript number with a
`DECIMAL` column matched 12 of 15 real legacy rows and missed every $89.40 —
found by a read-only check against real data after the mocked test had passed.

**Where.** `src/app/api/plaid/sync/route.ts`; commits `1832045`, `f83804c`.

### <a id="d23"></a>D23 · Never re-link the populated sandbox account

**Decision.** Fresh bank data means a fresh test user.

**Why.** Plaid's sandbox regenerates its fake history to end on the link date,
so a re-link returns the same merchants on different dates — the account's
April link has Uber rides from Jan 27 to Apr 14; a September link has the same
rides from Jun 26 to Aug 12. Adoption ([D22](#d22)) is for real banks and cannot
match these, so a re-link shows the fake history twice.

### <a id="d24"></a>D24 · No browser dialogs

**Decision.** `ui/ConfirmDialog` (`useConfirm`, a native `<dialog>` opened with
`showModal()`) replaces `window.confirm()`; `InlineStatus` replaces `alert()`.

**Why.** Browser dialogs freeze the page's JavaScript while open. That also
stalls the timer Clerk uses to refresh its short-lived session token, which is
the likely explanation — not proven — for the one unexplained auth error the
second pass recorded on a delete confirmed after a long pause. A native
`<dialog>` blocks the user but not JavaScript, and provides focus trapping and
Escape for free.

### <a id="d25"></a>D25 · Anything a paper reader needs prints expanded

**Decision.** Collapsible disclosures render twice: a `<details>` for the
screen, hidden in print, and an expanded copy that exists only in print.

**Why.** Browsers do not print the contents of a closed `<details>`, and paper
cannot open one. The CPA organizer printed the assumptions and "not modeled"
headings with nothing under them.

### <a id="d26"></a>D26 · Tax facts come from the engine's parameters, not the UI

**Decision.** Extends [D16](#d16): a page may not hold tax *facts* either —
rates, thresholds, citations. The mileage rate card reads the selected year's
rate periods from `GET /api/mileage`.

**Why.** The card copied the rate off the latest trip and, with none left, fell
back to `'0.725'` typed into the component: the January–June 2026 rate, wrong
from July 1 and for every other year. Its hard-coded citation was right for
2026 only.

### <a id="d27"></a>D27 · Decisions live here; rules for every agent live in AGENTS.md

**Decision.** This log is the durable record of why. The rules every
contributor must follow live in `AGENTS.md`, below the block Next.js manages;
`CLAUDE.md` imports it and adds notes specific to Claude Code.

**Why.** Four different agents worked on this repo and not all of them read
`CLAUDE.md`; `AGENTS.md` is the file they share. `next dev` rewrites only the
text between its `BEGIN`/`END` markers in `AGENTS.md` and leaves the rest alone
(checked in `node_modules/next/dist/server/lib/generate-agent-files.js`), so
content below the block is stable.
