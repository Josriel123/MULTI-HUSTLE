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
| Scope and process | [D1](#d1) · [D9](#d9) · [D12](#d12) · [D27](#d27) · [D36](#d36) · [D47](#d47) · [D50](#d50) |
| Data and money | [D2](#d2) · [D3](#d3) · [D10](#d10) · [D15](#d15) · [D20](#d20) · [D22](#d22) · [D32](#d32) · [D37](#d37) |
| Tax engine | [D8](#d8) · [D11](#d11) · [D13](#d13) · [D14](#d14) · [D17](#d17) · [D28](#d28) · [D29](#d29) · [D30](#d30) · [D48](#d48) |
| Auth, Plaid and security | [D4](#d4) · [D5](#d5) · [D6](#d6) · [D7](#d7) · [D23](#d23) · [D31](#d31) · [D45](#d45) · [D52](#d52) |
| Privacy, consent and policies | [D39](#d39) · [D40](#d40) · [D41](#d41) · [D42](#d42) · [D49](#d49) · [D51](#d51) |
| UI | [D16](#d16) · [D18](#d18) · [D19](#d19) · [D21](#d21) · [D24](#d24) · [D25](#d25) · [D26](#d26) · [D33](#d33) · [D34](#d34) · [D35](#d35) · [D38](#d38) · [D43](#d43) · [D44](#d44) · [D46](#d46) |

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

*Partly superseded by [D50](#d50): the privacy and consent layer is now built.*

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

**Where.** `src/components/README.md`. *Extended by [D26](#d26) and [D34](#d34). Look superseded by [D33](#d33); the rule on tax arithmetic stands.*

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

---

## 2026-09-23 — The missing inputs, and a redesign for new users

### <a id="d28"></a>D28 · W-2s and estimated payments are entered as forms; a paycheck is never wages

**Decision.** W-2s (`W2Form`, several per year) and estimated payments
(`EstimatedTaxPayment`, filed under the tax year paid *for*) are entered on
their own pages. The adapter merges several W-2s into the engine's one:
boxes 1, 2, 5 and 6 are summed across the return (Form 1040 lines 1a and 25a;
Form 8959 lines 1 and 19, "if you have more than one Form W-2, enter the
total"), boxes 3 and 7 only across the self-employed person's own W-2s
(Schedule SE line 8a is per person). A spouse's W-2 counts only on a joint
return, and is left out with a warning on any other status. A bank deposit
categorised as a paycheck is still excluded from income: once a W-2 is on
file that is an assumption, and without one it is a warning that wages and
withholding are missing.

**Why.** The engine accepted these inputs from Phase 2, but nothing stored
them, so every estimate assumed zero wages, zero withholding and zero
payments. A net paycheck understates wages and loses the withholding, which is
why deposits never stand in for the form.

**Alternative.** Summing every box across every W-2 would have let a spouse's
wages erase the self-employed spouse's Social Security base; the test for
that case shows the difference (`w2-payments-adapter.test.ts`). Excess Social
Security withheld by two employers (Schedule 3 line 11) is warned about with
its approximate amount, not subtracted.

**Where.** `src/lib/tax/adapters/prismaRows.ts` (`mergeW2Forms`), migration
`20260923000000_w2_payments_profile`, `/api/w2`, `/api/payments`.

### <a id="d29"></a>D29 · "Safe to spend" subtracts what is still owed, not the whole tax

**Decision.** Safe to spend is deposits counted as income, less every expense,
less estimated payments already sent, less the balance still due (never a
refund). With no W-2 and no payments it equals the old figure.

**Why.** The old formula (income − expenses − total tax) charged the tax on a
W-2 job's wages to the hustle money even though the employer had already
withheld it from wages that never reached these deposits. Recording a payment
now leaves the figure unchanged, as it should: cash and the balance due fall by
the same amount. A refund is not spendable until it arrives.

**Where.** `src/lib/tax/adapters/estimateFromRows.ts`.

### <a id="d30"></a>D30 · A tax profile nobody saved is an assumption, not a choice

**Decision.** `User.taxProfileSavedAt` is null until the Tax profile page is
saved. Until then the adapter treats the stored filing status as the column
default and the estimate says it assumed single.

**Why.** Every row has `filingStatus = 'single'` from the column default, so
the estimate reported "filing as single (from your profile)" for people who
had never been asked. The setup checklist uses the same flag.

**Where.** `src/lib/tax/adapters/prismaRows.ts`, `/api/profile`.

### <a id="d31"></a>D31 · Hustles are labels the user names; bank sync no longer invents them

**Decision.** A hustle (`IncomeSource`) groups income on the overview and
nothing else; the category still decides the tax (D17). Plaid sync no longer
creates one per deposit description. A new deposit joins a hustle only when its
description names one the user created ("Uber" matches "Uber 072515
SF**POOL**", as whole words, longest name first), and the sync never changes a
row's hustle after that. Renaming a hustle to another's name merges the two;
deleting one leaves its transactions unassigned.

**Why.** The old sync created a hustle for every distinct deposit string and
reset it on every sync, so the list filled with bank descriptions and the
user's corrections were undone. Existing rows keep those hustles; the rename
merge is how they are tidied.

**Where.** `src/lib/hustles.ts`, `/api/sources`, `src/app/api/plaid/sync/route.ts`.

### <a id="d32"></a>D32 · Account deletion covers every table with a user id, enforced by a test

**Decision.** The Clerk `user.deleted` webhook deletes from every model with a
`userId`, rows that reference an income source first.
`clerk-webhook-delete.test.ts` reads `schema.prisma` and fails when a model
with a `userId` is missing from the list.

**Why.** `MileageLog` was never added to it, and every relation is `ON DELETE
RESTRICT`, so deleting any account with a logged trip failed.

### <a id="d33"></a>D33 · The UI is redesigned around a person, light by default

**Decision.** Supersedes the look in [D16](#d16) (its rule on tax arithmetic
stands). Light by default and dark when the system asks, from one token set in
`globals.css`; components never type a colour. Navigation is grouped by what a
person is doing (Your money, Tax breaks, Your estimate), with one tax-year
picker in the header. Pages are named in plain English and old URLs redirect.
Tax words on screen explain themselves (`<Term>`), with definitions in
`src/lib/glossary.ts` that quote rates only from engine constants
([D26](#d26)). A new account sees a three-step setup checklist.

**Why.** The owner's judgement after using it: a new user would have no idea
what the app was for or what to do first. The dashboard led with developer
status, the navigation named tax forms, and the pages assumed the reader knew
what Schedule C was.

**Where.** `src/components/README.md`.

### <a id="d34"></a>D34 · Display ratios come from the server too

**Decision.** Extends [D16](#d16): shares for bars and progress (each hustle's
share of income, the share of tax already paid) and the split of the balance
into "left to pay" and "refund" are computed in `src/lib/dashboard.ts`, with
`Decimal`, and sent with the summary.

**Why.** A page that divides money to size a bar is one small step from a page
that computes a tax figure. Keeping every operation on money server-side keeps
the rule simple to check: no arithmetic on money in a `.tsx` file, at all.

### <a id="d35"></a>D35 · The chart stops at the current month for the current year

**Decision.** For the current year the chart ends at the current month, and a
W-2's amounts are spread evenly over the months shown. Its last point takes
everything, so it still equals the summary.

**Why.** A W-2 entered mid-year holds year-to-date figures. Spread over twelve
months, it drew wages rising through months that had not happened.

### <a id="d36"></a>D36 · A dev-only preview renders every page with sample data

**Decision.** `/preview/<page>` renders the real pages behind a fetch
interceptor that answers `/api/` calls from fixture rows, run through the real
adapter and engine in the browser. It 404s in production, and the proxy lets
it past sign-in only outside production.

**Why.** Pages behind sign-in could not be checked or screenshotted without an
account, and an agent must not sign in (see `CLAUDE.md`). The preview shows
what the code renders; it cannot show what real data looks like, so a
click-through on a real account is still needed.

**Where.** `src/app/preview/[[...page]]/`.

### <a id="d37"></a>D37 · A third decimal place is refused

**Decision.** Extends [D20](#d20): `parseMoneyInput` refuses an amount with
more than two decimal places, and the mileage route refuses miles the
`DECIMAL(10,2)` column cannot hold and dates that do not exist.

**Why.** Postgres rounds a third decimal away without a word, and
`new Date('2025-02-30')` is March 2: the same silent rewrite D20 removed
elsewhere.

### <a id="d38"></a>D38 · The tax report replaces the CPA organizer

**Decision.** `/report` prints Schedule C by form line with the amount
entered and the amount deducted, the W-2s, payments, education forms, every
engine line with its unit (square feet, percentages and miles are no longer
shown as dollars), the disclosures expanded ([D25](#d25)) and the provenance
count ([D19](#d19)). The CSV is built from a `Blob`.

**Why.** The organizer grouped Schedule C by income-source type and labelled
the amounts entered as "deductible operating expenses", which overstated them
wherever a limit applied (meals at 50%, the vehicle method). Its CSV was a
`data:` URI, which a `#` in any description cut short.

## 2026-09-23 — Policies, consent, the tour and the phone

### <a id="d39"></a>D39 · Public pages live outside sign-in, in their own route group

**Decision.** The app is split into route groups: `(public)` for the welcome
page, About, every policy under `/legal`, and the app's own sign-in and
sign-up pages; `(app)` for the signed-in app; `(preview)` for the dev-only
preview. The proxy lets `(public)` through, and a signed-out visit to `/`
goes to `/welcome` instead of a bare sign-in form. Every page's footer links
the policies.

**Why.** Policies have to be readable before anyone signs up: California's
CalOPPA wants the privacy policy conspicuously linked from the home page, and
a clickwrap agreement is only enforceable if the terms were available before
the person agreed. A first-time visitor should learn what the app is, and what
it is not, before being asked for an email address.

The preview ([D36](#d36)) moved to `src/app/(preview)/preview/[[...page]]/`,
where its layout is the app frame without the agreement step.

**Where.** `src/app/(public)/`, `src/proxy.ts`, `src/lib/legal.ts`
(`LEGAL_PAGES`, operator details), `src/components/legal/`.

### <a id="d40"></a>D40 · A versioned clickwrap agreement and an 18+ check come before the app

**Decision.** After signing up, nothing in the app renders until the person
ticks two unticked boxes, "I am 18 or older" and "I have read and agree to the
Terms of Service and the Privacy Policy" (both linked), and presses "Agree and
continue". The server records the version on screen and its own time
(`User.agreementVersion`, `agreementAcceptedAt`, `adultConfirmedAt`), refuses a
stale version with 409, and a new `LEGAL.agreementVersion` asks everyone again.
"I'm under 18" (offered to new accounts) deletes the account on the server at
once, and the device then shows a notice instead of the sign-up form. The
sign-in and sign-up pages say only where the account details go and that the
agreement comes next; they do not answer the age question for anyone.

**Why.** Courts enforce clickwrap when the person took an affirmative action
next to visible terms; a pre-ticked box or a "by using this site" line is
weaker. The record (version and server time) is the evidence. The app is not
meant for children: COPPA forbids collecting from under-13s without verified
parental consent, and financial data about minors is a risk with no upside
here, so the line is 18 and an under-18 answer ends in deletion rather than a
back button or a second button to press (the FTC's guidance is that an age
screen should not invite a second try). An independent review found the first
version only offered deletion and kept the answer in the browser alone.

**Where.** `src/components/legal/AgreementGate.tsx`, `src/lib/agreement.ts`,
`/api/account` and `/api/account/agreement`, migration
`20260924000000_consent_record`.

### <a id="d41"></a>D41 · Download, delete and disconnect are buttons, not requests

**Decision.** Account & privacy has "Download my data" (a JSON file of every
row the app holds, the Plaid token left out) and "Delete my account" (every
row, then the Clerk user). Deleting and the Clerk `user.deleted` webhook call
the same `deleteUserData`, which first asks Plaid to revoke each bank
connection (`/item/remove`). The bank card gains "Disconnect", which revokes
at Plaid and deletes the token but keeps the transactions. When Plaid does not
confirm a revocation, the page the person lands on says so and points to
my.plaid.com. Nothing reaches Plaid (no Link token, no script) until "Connect
a bank" is pressed. Email requests still work, with a 30-day answer.

**Why.** The rights the Privacy Policy describes (to know, to delete) are only
real if they are easy; the FTC treats obstructed cancellation and deletion as
a dark pattern. Plaid's policies expect an app to stop accessing an account
when the user leaves. Revocation is best effort: an unreachable Plaid never
keeps data or a token on file, and the response says when Plaid did not
confirm.

**Where.** `src/lib/userData.ts`, `src/app/(app)/account/page.tsx`,
`/api/account`, `/api/account/export`, `/api/plaid/disconnect`,
`src/components/transactions/BankCard.tsx`.

### <a id="d42"></a>D42 · The cookie notice informs; it does not ask

**Decision.** The app sets only the cookies Clerk needs for sign-in and keeps
four small preferences in `localStorage`, so the notice says exactly that,
with one "OK" and a link to the Cookie Policy. There is no accept/reject
choice, because there is nothing optional to choose.

**Why.** Essential storage needs no consent under the laws that ask for it
(the ePrivacy rule's "strictly necessary" exemption; US state laws regulate
selling, sharing and targeted advertising, none of which happens). A consent
banner offering a choice that changes nothing would itself be misleading.
Anything non-essential added later (analytics, ads, a chat widget) must be
off until the person opts in, and goes into the Cookie Policy and
`SERVICE_PROVIDERS` first. The same goes for what SDKs do on their own:
Clerk's development instances send usage telemetry from the browser, so
`ClerkProvider` sets `telemetry={false}` (and `.env.example` sets
`NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED` for the server SDK).

**Where.** `src/components/legal/CookieNotice.tsx`,
`src/app/(public)/legal/cookies/page.tsx`.

### <a id="d43"></a>D43 · A guided tour explains every tab once, and can always be skipped

**Decision.** On a first visit a speech-bubble tour ("Sprout") points at each
tab in turn, fourteen short steps in the order a newcomer meets them. It can
be skipped at every step, is driven by keyboard (arrows, Escape) as well as
buttons, keeps focus inside the bubble, and can be replayed from the sidebar
and from Account & privacy. On a phone it opens the menu for the tabs that
live there. `tour-steps.test.ts` fails if a step points at a tab that no
longer exists, or a tab has no step.

**Why.** The owner asked for game-style onboarding for people who have never
done their own taxes. It is skippable because a tour that cannot be dismissed
is an obstacle, and it measures its targets at runtime (re-measuring when the
menu's slide-in ends), because a fixed delay once caught the menu mid-slide
and lit a spot off the screen. The phone menu stays a custom modal rather
than a native `<dialog>`: the top layer would draw it above the tour.

**Where.** `src/components/tour/`, `src/components/AppShell.tsx`.

### <a id="d44"></a>D44 · On a phone: bottom tabs, a quick-add button, and an installable app

**Decision.** Below 1024px the sidebar becomes a bottom tab bar (Overview,
Money, Report, More) with a "+" that adds money in, money out, a trip or a tax
payment. The app ships a web manifest and icons, generated from the brand
constants, so it can be added to a home screen; it does not lock orientation.
Floating things sit above the tab bar and the safe-area inset.

**Why.** Gig workers record a payout or a trip where it happens. Locking
orientation would fail WCAG 1.3.4. The income chart used to render 720px wide
before measuring its box, which pushed a 375px screen sideways; it now starts
phone-sized and cannot widen its card.

**Where.** `src/components/AppShell.tsx`, `src/app/manifest.ts`,
`src/app/icon.svg`, `src/app/apple-icon.png`, `public/icons/`,
`src/lib/brand.ts`.

### <a id="d45"></a>D45 · Security headers now; a full Content Security Policy later

**Decision.** Every response carries `X-Frame-Options: DENY`, a CSP of
`frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `nosniff`,
`strict-origin-when-cross-origin`, HSTS, `same-origin-allow-popups` and a
restrictive `Permissions-Policy`; `X-Powered-By` is off. `security.txt`
names the security contact.

**Why.** These stop clickjacking and a few injection tricks at no risk. A full
script policy is deferred: Clerk and Plaid load scripts, frames and workers
from their own domains, and a policy that missed one would break sign-in or
bank linking in production, where development would not show it.

**Where.** `next.config.ts`, `public/.well-known/security.txt`,
`docs/security-program.md`.

### <a id="d46"></a>D46 · Contrast is tested on the tokens

**Decision.** `contrast.test.ts` reads `globals.css` and fails unless every
text token is 4.5:1 on every surface in both themes (and on its own 10% tint),
filled-button text is 4.5:1, and control outlines and the focus ring are 3:1.
To pass, the light theme's faint text, warning and danger colours were
darkened, and a new `field-border` token outlines text boxes and the chosen
segment of a segmented control. The test also checks that the brand constants
equal the tokens.

**Why.** The light faint text was 4.2:1 on grey surfaces and text boxes were
outlined at about 1.3:1, both below WCAG 2.2 AA. Checking tokens, not pages,
means no future page can reintroduce a failing pair.

**Where.** `src/app/__tests__/contrast.test.ts`, `src/app/globals.css`.

### <a id="d47"></a>D47 · Schema changes that ship with code are additive first

**Decision.** The consent migration only adds nullable columns, so it can be
applied while the previous release is still serving. Dropping `User.plan`
(a "Pro Plan" string nothing reads, on every row) waits for a follow-up
migration once this release is live; until then the code simply stops
mentioning it and the column's default fills it on insert.

**Why.** Migrations are applied by hand and deploys happen on push, so there
is always a window where one has happened and not the other. A migration that
added the new columns and dropped the old one would break whichever release
was running during that window: the old code still selects `plan`, the new
code needs the consent columns.

**Where.** `prisma/migrations/20260924000000_consent_record/`,
`prisma/migrations/README.md`, `PLAN.md`.

### <a id="d48"></a>D48 · Every estimate names the IRS figures it uses

**Decision.** The summary response carries `rules` (tax year, the revenue
procedure with that year's figures, its link), and `EstimateNotice` prints
"Uses the IRS's figures for tax year 2026 (Rev. Proc. 2025-32)" under the
disclaimer on every page.

**Why.** The Terms of Service promise it, and a reader comparing the estimate
with a return should know which year's brackets and limits produced it.

**Where.** `src/lib/dashboard.ts` (`rulesFor`), `src/components/EstimateNotice.tsx`.

### <a id="d49"></a>D49 · Product copy states only what the code does

**Decision.** No testimonials, ratings, user counts, countdowns or urgency; no
"bank-level" or "guaranteed" language; limits are stated as plainly as
features (federal only, no credits, may be higher or lower, not affiliated
with the IRS, Plaid in test mode while it is). "Share" is used only in the
advertising sense California law gives it, never as "we share nothing",
because service providers do receive data. The app is free and never asks for
payment details, and says so.

**Why.** The FTC's rule on reviews (16 CFR Part 465) and section 5 of the FTC
Act make fake reviews and unsupported claims actionable; an honest limit costs
less than a complaint. Each claim on the welcome page was checked against the
code when it was written.

**Where.** `src/app/(public)/welcome/page.tsx`, the policies,
`src/components/transactions/BankCard.tsx`.

### <a id="d50"></a>D50 · The compliance layer D1 deferred is built now; Plaid production still waits

**Decision.** Extends and partly supersedes [D1](#d1). The app now has what a
public sign-up needs: the policies (D39), a recorded agreement and age check
(D40), download, deletion and disconnect in the app (D41), an honest cookie
notice (D42), an accessibility statement backed by tests (D46), a written
security program, and third-party notices. Still out of scope: Plaid
production access, audit logging, SOC 2. Plaid stays in its sandbox until the
owner completes Plaid's production review (`docs/security-program.md`).

**Why.** The owner asked for the app to be safe to offer to real people. A
public page that takes sign-ups is a product whether or not it is called one:
a privacy policy (CalOPPA), truthful claims (FTC Act section 5) and the age
line (COPPA) apply as soon as strangers can sign up. The policies were written
for this app, from its code, but by no lawyer; `LEGAL.governingState` and the
postal address are the owner's to fill in, and a lawyer's review before
growth is the recommendation that stands.

**Where.** `src/lib/legal.ts`, `docs/security-program.md`,
`docs/legal-changelog.md`, `public/third-party-notices.txt` (served with the
site, generated by `npm run notices`).

### <a id="d51"></a>D51 · Changing what people agreed to is a decision a test forces

**Decision.** `legal-version.test.ts` fingerprints the Terms and Privacy Policy
source and the details they print from `src/lib/legal.ts`, per
`agreementVersion`. Any edit fails the test until someone either bumps the
version (with `effectiveDate` and a `docs/legal-changelog.md` entry), which asks
everyone to agree again, or records the new fingerprint under the same version
as a change that does not matter to users.

**Why.** Both policies promise a new agreement when something material
changes; without a check, an edit to the text would silently leave everyone on
an agreement to words that no longer exist. Two independent reviews, one of
the policies against the code and one of accessibility, ran before this
release; their findings were fixed or are listed in `PLAN.md`.

**Where.** `src/lib/__tests__/legal-version.test.ts`.

## 2026-09-23 — More than one bank

### <a id="d52"></a>D52 · Several banks per user; transfers between them are flagged, never assumed

**Decision.** A user can connect several banks: "Connect another bank", a
list of connected banks with a Disconnect each, and one "Sync now" that syncs
every connection in turn, where a bank that fails is named and does not stop
the others (its cursor stays put, so nothing is skipped). Each connection
records its bank from Plaid's `/item/get` (never from the browser), and the
same bank cannot be connected twice: the second Item is removed at Plaid and
the person is told to sync the first. Accounts at one bank all come in
through that bank's one connection, as before.

Each bank row now keeps which account it is in and Plaid's primary category.
A deposit Plaid labels a transfer, matched by an outflow of exactly the same
amount (as a decimal) that Plaid also labels a transfer, in a different one
of the user's accounts within three days, is flagged "Looks like a transfer"
in the list, with a one-tap "Mark as transfer", and the estimate warns with
the count and the amount. Plaid's label never sets a category.

**Why.** With money split across accounts, moving it between them looks like
income, and an uncategorised deposit counts as business income: every
transfer between the user's own accounts would raise the estimate. Plaid's
label alone cannot decide it, because gig and freelance payments by Zelle or
Venmo are often labelled transfers too, and treating real income as a
transfer would understate the tax; so both legs have to sit in the user's own
connected accounts, and the person confirms. The same bank twice would
replay its history as new rows (the problem [D23](#d23) describes for the
sandbox), counting that income twice.

**Not done.** A bank whose login expires (Plaid's `ITEM_LOGIN_REQUIRED`) is
reported by name, but re-authorising it through Link's update mode is not
built; disconnecting and connecting it again brings its history in again, and
the Disconnect confirmation says so.

**Where.** `src/lib/plaidSync.ts`, `src/lib/transfers.ts`,
`src/app/api/plaid/`, `src/components/transactions/BankCard.tsx`,
`TransactionList.tsx`, migration `20260925000000_multiple_banks`.

