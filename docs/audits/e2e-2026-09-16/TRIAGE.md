# E2E audit triage — decisions

Decisions on the nine findings in [REPORT.md](REPORT.md). **This file is the
scope of the follow-up work.** The report is evidence; this is the plan.

Every finding was independently confirmed against source before triage. All
nine are real. Nothing here is disputed, so unlike the Phase 2 triage there is
no "document instead of fix" column — the engine's deliberate limitations were
correctly excluded by the auditor and are not in scope.

## What this audit proved that unit tests could not

Every finding is an **integration** defect. The tax engine is correct; the
pieces around it drop, ignore or misreport its inputs and outputs. 184 passing
tests, a clean typecheck and a clean build said nothing about any of this.

Two also closed gaps in our favour: all five manual entry routes now have a
verified first-write bootstrap with no foreign-key error, which is the Phase 1
`requireUser` fallback doing its job on a real fresh account; and year
propagation through the chart was confirmed.

## Group A — the estimate is wrong (Fable 5.1, `src/lib/tax/**`)

Both change the audited engine's contract. Do these first; they are the only
findings where the number a user acts on is wrong.

| ID | Fix |
|---|---|
| **F1** | Mileage never reaches the calculation. `BuildInputArgs` has no mileage field, and the summary route runs `estimateFederalTax` *before* pricing miles, so a logged trip shows a deduction that cannot reduce tax. Add mileage to the adapter's input contract and to `ScheduleCInput`, then wire **both** the summary route and the chart route — the chart estimates without mileage too. Showing a deduction that does nothing is worse than not having the feature. |
| **F2** | Clearing "Mark as tax-deductible business expense" does nothing when the row has a valid category: the adapter takes an explicit category and only consults `taxDeductible` as a fallback, exactly as its README says. **The defect is two controls for one concept, not the adapter.** Resolve it by making category the single source of truth and removing the checkbox — a `personal` category already exists (`categories.ts:244`, "No deduction for personal, living, or family expenses"). Selecting it is how a user marks something non-deductible. Migrate existing rows where `taxDeductible = false` and the category implies a deduction. |

## Group B — wrong output handed to a third party (Gemini 3.8 Flash)

The CPA organizer and its CSV are the artifacts that leave the app. Everything
here makes them say something untrue.

| ID | Fix |
|---|---|
| **F3** | `GET /api/transactions` takes no request parameter and filters on `userId` alone, so a ledger and a CSV named `tax_ledger_export_2025.csv` contain 2026 rows. Accept and apply `taxYear`, using `resolveTaxYear` from `src/lib/taxYear.ts` as the other routes do. |
| **F5** | The CPA Schedule C detail reads only `sources.freelance` and `sources.delivery`, so business income with no assigned source is in the headline total but absent from the detail — $50,000 of receipts against $0 of "Gross Receipts / Sales". Add the other/unassigned bucket. |
| **F6** | Three unconditional claims sit above a manual, never-linked account: "Multi-Hustle OS Verified" (line 160), "Plaid-verified ledger integrity" (164) and "Verified against source bank and tax documents" (294). **Gate all three on actual provenance**, or delete them. This is the cheapest fix in the list and the one with the worst failure mode: a document handed to a tax preparer asserting a verification that never happened. |

## Group C — validation and robustness (Opus 5)

| ID | Fix |
|---|---|
| **F8** | The office POST checks only `Number.isNaN`, so an office area larger than the home persists; the engine rejects it later, and because the student and office pages load their own form data in a `Promise.all` alongside the office-dependent summary, one bad record blanks unrelated pages and disables their save buttons. Two fixes: validate the relationship before persisting, and decouple form loading from the summary so a failing estimate degrades one card rather than a whole page. The second pattern applies everywhere, not just here. |
| **F9** | `PATCH /api/transactions/[id]` applies `.abs()`, so editing an amount to `-9` silently saves `9`. Reject it like the create form does, rather than guessing what the user meant. |
| **P3** | An oversized amount returns "Failed to post transaction" with no field-level explanation. Give the range error its own message. |

## Group D — decisions made here, so nobody re-litigates them

| ID | Decision |
|---|---|
| **F4** | The tax year resets on every navigation because each page owns its own state initialised to `undefined`. **Put the year in the URL as `?taxYear=`.** It then survives navigation for free, is shareable and bookmarkable, matches what the API already accepts, and removes five independent copies of the same state. The transaction form's date should default to the selected year rather than today when that year is not the current one. Owner: Gemini, with the pages. |
| **F7** | The disclaimer points readers at a "not modeled" list the UI never renders. The API already returns `notModeled` and the client type already declares it; only `EstimateNotice` lacks the prop. **Add it, collapsed like assumptions.** The engine's limitations are deliberate — being unable to read them is not. Owner: Gemini, with `EstimateNotice` and the CPA export. |

## Still unverified — not findings, but not sign-off either

The auditor was explicit that this is a findings report, not end-to-end
sign-off. Three areas remain untested and should not be described as working:

- **Delete.** Never completed successfully; the browser confirmation could not
  be driven. Both the transaction and mileage delete paths are unproven.
- **Plaid link and bank-synced edit restrictions.** The Link iframe never
  exposed an institution chooser, so no bank was linked on the test account.
  The Plaid lock on amount and date — built in Phase 3 — has never been
  exercised by a person.
- **CPA print output.** The button works; the printed result was never
  inspected. Pagination, clipping and whether the disclosure survives printing
  are all unknown.

Re-linking on the populated account would duplicate its 27 legacy rows, which
have no `plaidTransactionId` (they predate Phase 1). Fix that backfill before
anyone tests Plaid Link against real data.

## Sequencing

Group A first and alone — it changes the engine's contract and everything else
reads from it. Groups B and C can then run in parallel; they touch different
files. Group D's decisions are already made above, so they fold into whoever
owns the page.
