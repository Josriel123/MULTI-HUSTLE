# Dashboard end-to-end audit

**Browser audit conducted September 10–16, 2026; coverage gaps are listed below.** Report only; no application fixes. Scope: the running Next.js app at localhost:3000, fresh-user behavior, cross-page data flow, editing, mileage, export, mobile and error states. The earlier federal-engine audit was not repeated.

**Release assessment: do not treat the passing unit suite as end-to-end sign-off.** Nine confirmed integration, validation or disclosure findings follow. Five are P1: incorrect deduction behavior, the wrong tax year's exported data, incomplete preparer detail, or a persisted invalid form that disables unrelated pages. P2 findings concern year continuity, misleading/missing disclosures and silent amount conversion.

P1 means high-priority incorrect financial output or a major workflow failure. P2 means a material workflow or disclosure defect. Screenshots are browser captures, not print/PDF previews. Some earlier full-page captures contain repeated bottom sections from screenshot stitching; those repetitions are not reported as application defects.

## Broken

### F1 — P1: Mileage is displayed as a deduction but never reaches the tax calculation

**What I did.** On a fresh test account, logged $50,000 of 2026 business income. The dashboard estimated $9,732 in federal tax. In Deductions → Business Mileage, saved a 1,000-mile business trip dated September 10, 2026, then revisited Dashboard and CPA Export.

**Expected.** The eligible mileage deduction should enter Schedule C expenses and change the profitable account's estimated tax. Dashboard and CPA figures should reflect the same deduction.

**Actual.** The trip saved and the app displayed 1,000 miles and a $760 deduction. The dashboard still estimated $9,732, with safe-to-spend unchanged at $40,268. CPA also displayed the $760 deduction while retaining the same tax. This is a dropped input between functioning pieces, not a mileage-rate claim.

**Evidence.** [Saved trip showing $760](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/03-mileage-760.png), [dashboard tax unchanged](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/04-mileage-tax-unchanged.png), [CPA detail and tax](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/05-export-omits-other-income.png).

**Source confirmation.** The summary route [runs the estimate first](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/dashboard/summary/route.ts:99), then [calculates mileage separately](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/dashboard/summary/route.ts:110), and [returns mileage only in display fields](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/dashboard/summary/route.ts:145). The adapter's [input contract contains no mileage](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/adapters/prismaRows.ts:74). The chart [also estimates without mileage](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/dashboard/chart/route.ts:93). These are manifestations of one integration defect. The documented limitation [requires miles to be logged](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:35); it does not disclose that logged miles are ignored.

### F2 — P1: An expense marked “Non-deductible” still reduces taxable business income

**What I did.** Added a $1,000 Supplies expense, which changed the 2026 dashboard tax from $9,732 to $9,502. Edited that manual expense to $123.45, June 15, 2025, Office expense, and cleared its tax-deductible checkbox. Saved, checked the ledger classification, and selected 2025 on Dashboard.

**Expected.** Clearing “Mark as tax-deductible business expense” should prevent a Schedule C deduction. With no 2025 income, the expense should affect cash spending but leave total income at $0.

**Actual.** The ledger persisted $123.45 and visibly labeled it “Non-deductible.” The 2025 dashboard nevertheless showed total income of -$123 and business-loss/QBI-loss notices. Tax was $0 because that year had no income; the failing assertion is the deduction and resulting loss, not a claimed reduction in tax below zero. Negative safe-to-spend alone is appropriate for a cash expense and is not the defect.

**Evidence.** [Non-deductible ledger row](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/09-nondeductible-ledger-row.png), [2025 income reduced below zero](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/08-nondeductible-expense-deducted.png).

**Source confirmation and important qualification.** The [edit checkbox promises a tax treatment](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/TransactionLedger.tsx:568), while the [ledger badge reads the flag](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/TransactionLedger.tsx:372). The adapter [uses any explicit expense category without consulting that flag](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/adapters/prismaRows.ts:212). This is a **UI/API contract defect**, not a claim that the adapter contradicts its README: the [README explicitly defines the flag as a fallback when category is null](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/README.md:130). The interface exposes an authoritative-looking control that cannot override a valid category. Both manual and bank-synced rows use this same contract; bank-synced reproduction remains a separate coverage gap.

### F3 — P1: A 2025 ledger/CSV contains 2026 transactions

**What I did.** With the $50,000 transaction dated September 11, 2026, selected tax year 2025 in Deductions and CPA Export and downloaded the raw ledger.

**Expected.** A ledger scoped to 2025, and a file named tax_ledger_export_2025.csv, should contain only 2025 transactions. The selected-year summary and ledger should describe the same period.

**Actual.** The ledger still showed the 2026 transaction. The downloaded 2025 CSV included the $50,000 row dated 2026-09-11 even though the 2025 estimate excluded that income.

**Evidence.** [2025 selector with 2026 ledger row](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/06-2025-ledger-shows-2026.png), [actual downloaded CSV](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/tax_ledger_export_2025.csv). Its first data row is:

```csv
2026-09-11,Income,50000.00,"Business income (gig, freelance, contract)","E2E AUDIT income baseline 2026",NO,"Manual"
```

**Source confirmation.** The client [sends the selected year](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/api.ts:164). Transaction GET [ignores the request and filters only by user](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/transactions/route.ts:97). CPA [exports every returned row](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/export/page.tsx:74) and [labels the filename with the selected year](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/export/page.tsx:89). The summary [correctly filters by date](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/dashboard/summary/route.ts:87), explaining why the two outputs disagree. Ledger and CSV are one defect.

### F4 — P2: The selected tax year does not follow navigation, and transaction forms default to today's year

**What I did.** Selected 2025 and moved between the dashboard, deductions and export pages. Inspected the transaction form while viewing a prior year.

**Expected.** The user's tax-year selection should follow the cross-page workflow. A prior-year entry form should preserve that context or clearly require an explicit date/year decision.

**Actual.** Navigation reset the next page to 2026. The transaction form's date default remained today's date rather than following the selected prior year. A user can select a year to work on, follow “Log an expense,” and be working in a different year.

**Evidence.** [Prior-year ledger state](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/06-2025-ledger-shows-2026.png) and [deductions back on 2026](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/09-nondeductible-ledger-row.png). These are endpoint captures; the navigation reset was observed interactively.

**Source confirmation.** Each page owns a fresh state initialized to undefined: [Dashboard](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/page.tsx:26), [Deductions](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/deductions/page.tsx:29), [Student](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/student/page.tsx:32), [Office](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/office/page.tsx:32), [Export](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/export/page.tsx:28). The server [defaults an omitted year to the current year](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/dashboard/summary/route.ts:59). TransactionLedger [accepts but ignores its taxYear prop](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/TransactionLedger.tsx:55) and [defaults dates to today](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/TransactionLedger.tsx:67). This is separate from F3: preserving page state would not fix the server's unfiltered ledger query.

### F5 — P1: The CPA Schedule C detail omits all of this account's business receipts

**What I did.** Created $50,000 of manual business income, confirmed Dashboard's “Other income” card showed it, then opened CPA Export.

**Expected.** The organizer's Schedule C detail should account for that $50,000 of business receipts, even when no freelance/delivery source was assigned.

**Actual.** The headline showed $50,000 of income and $9,732 of tax, but both Schedule C “Gross Receipts / Sales” rows were $0. There was no Other/manual business column. The tax estimate does include the income; the preparer's detailed organizer omits it.

**Evidence.** [CPA organizer with $50,000 headline and zero receipt detail](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/05-export-omits-other-income.png).

**Source confirmation.** Transactions without a source [go into the Other display bucket](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/adapters/prismaRows.ts:119), while their business receipts [still enter the tax input](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/adapters/prismaRows.ts:189). Dashboard [renders Other](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/page.tsx:191). CPA [reads only freelance/delivery buckets](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/export/page.tsx:99), and its [entire Schedule C section contains only those two groups](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/export/page.tsx:204). This is an incomplete export, not a documented tax-engine omission.

### F6 — P2: The organizer claims Plaid verification for a manual-only account

**What I did.** Opened CPA Export on the fresh account before any successful bank link, with income entered manually.

**Expected.** Verification language should reflect the actual provenance of the records.

**Actual.** The organizer showed “Multi-Hustle OS Verified” and “Plaid-verified ledger integrity” despite containing manual data from an unlinked account. This is misleading output intended to be handed to a preparer, not merely a preference about wording.

**Evidence.** [Verification claims above the manual account's organizer](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/05-export-omits-other-income.png).

**Source confirmation.** Both claims are [unconditional static text](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/export/page.tsx:158); no linked-bank or transaction-provenance condition surrounds them. This finding does not assert that Plaid itself produced an incorrect result.

### F7 — P2: The disclaimer refers to a “not modeled” list that the UI never shows

**What I did.** Read the estimate disclaimer and expanded “Assumptions this estimate makes,” including at phone width.

**Expected.** A limitation list explicitly referenced by the disclaimer and assumptions should be visible or linked, including on the organizer.

**Actual.** The disclaimer referred to “The 'not modeled' list,” and assumptions directed readers to it, but no such list or link was available. Expanded assumptions did not contain the full list.

**Evidence.** [Expanded mobile estimate disclosure](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/screenshots/13-mobile-expanded-disclaimer.png).

**Source confirmation.** The API [returns notModeled](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/dashboard/summary/route.ts:169), and the frontend [declares the field](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/api.ts:49). However, [EstimateNotice has no prop or renderer for it](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/EstimateNotice.tsx:6). CPA [passes only disclaimer, warnings and assumptions](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/export/page.tsx:198). The [disclaimer references the missing list](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:11).

**Scope qualification.** This reports missing disclosure plumbing, not the deliberate exclusion of credits, per-business home-office limits, or expense-refund reversal. Credits are separately mentioned in captions/assumptions; scenario-specific warnings do render. The missing general list still leaves other known limitations unavailable to the user.

### F8 — P1: An invalid home-office entry is saved, then disables the dashboard and unrelated student forms

**What I did.** Saved a valid home-office entry: 1,000 square feet total, 100 square feet office, $1,000 monthly rent and $100 monthly utilities. The app displayed a $1,320 deduction. Changed only office area to 1,001 square feet and submitted. Navigated to Student Forms and Dashboard, then returned to Home Office.

**Expected.** Reject office area greater than total home area before persisting it, retain the previous valid record, and keep unrelated pages usable.

**Actual.** A validation error appeared, but the invalid record had already been saved. Subsequent summary requests failed. Student Forms showed blank fields, disabled save controls and an unresolved year/loading state despite previously saved student data. Dashboard totals became dashes. Returning to Home Office also produced blank fields and a disabled save button, making the page that caused the problem difficult to use for recovery.

**Evidence.** [Student page broken by the office record](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/screenshots/16-invalid-office-breaks-student.png), [dashboard totals unavailable](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/screenshots/17-invalid-office-breaks-dashboard.png).

**Source confirmation.** The office POST [checks only for NaN](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/deductions/office/route.ts:34), then [persists the values](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/deductions/office/route.ts:45). The office-area relationship is [validated later by the engine](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/homeOffice.ts:122). The UI [saves first and requests an estimate second](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/office/page.tsx:81), so an estimate error looks like a rejected save after storage already succeeded. Student's [Promise.all couples its own form loading to the office-dependent summary](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/student/page.tsx:50), so the rejection prevents its form values being populated. [shownYear remains undefined](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/student/page.tsx:73). Home Office has the [same loading dependency](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/office/page.tsx:44).

**Recovery tested.** On Home Office, explicitly selecting 2026 enabled Save. Re-entering all four valid values and saving restored the $1,320 deduction and working estimates. The synthetic record was restored to those valid values. This workaround does not remove the defect.

### F9 — P2: Negative manual-edit amounts are silently converted to positive amounts

**What I did.** On `audit-e2e-20260916-forms+clerk_test@example.com`, created a $7 expense with memo `E2E AUDIT negative edit and delete`. Opened Edit Transaction, changed Amount to `-9`, and saved. Reloaded the page and reopened Edit.

**Expected.** Reject the negative amount with validation, consistently with the create form, or explicitly explain any supported signed-amount interpretation before saving.

**Actual.** Save succeeded without explanation. The reopened amount field contained positive `9.00`, and the ledger displayed a $9 expense. The minus sign on the ledger is its expense presentation; the reopened field proves the submitted negative amount was normalized to positive. This finding concerns silent input conversion, not the deliberately unmodeled handling of expense refunds.

**Evidence.** [Reopened editor after saving -9](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/screenshots/21-negative-edit-normalized.png).

**Source confirmation.** The edit amount input has no minimum at [TransactionLedger.tsx:516](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/components/TransactionLedger.tsx:516). PATCH applies `.abs()` at [transaction route:82](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/transactions/[id]/route.ts:82).

## Awkward, with no incorrect persistence demonstrated

**Very large transaction amounts produce an unhelpful generic error — P3.** Entering $10,000,000,000 and submitting returned “Failed to post transaction.” Expected a field-level range explanation. The attempted row was not added, so this is validation/error-message quality rather than evidence of overflow corrupting a stored amount. [Screenshot](C:/Users/joelb/.codex/visualizations/2026/09/10/01a0894b-68fb-7492-a737-8526b9cc3284/dashboard-e2e-audit/prior-screenshots/10-overflow-generic-error.png). Source: [decimal conversion](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/transactions/route.ts:39), [generic catch response](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/app/api/transactions/route.ts:91). No arbitrary acceptable financial cap is prescribed by this finding.

## Coverage and data handling

Reviewed checkout: `d657effb5a2683584194ecf19d891e3c6cd8761c`. No application code was changed. This is a findings report, not complete end-to-end sign-off.

| Area | Verified result / remaining limit |
|---|---|
| Fresh Clerk signup | A new test user reached the empty app through the normal signup UI. |
| First transaction | First manual write succeeded without a foreign-key error. This proves that route's bootstrap path for that user. |
| Other routes as a user's first-ever write | Completed separate fresh-account first-write checks for Home Office, mileage, 1098-T and 1098-E. All saved successfully without foreign-key errors. Together with the earlier transaction-first check, all five manual entry routes passed. Plaid exchange/sync bootstrap remains dependent on completing Link. |
| Empty states | Fresh zero-income dashboard, empty transaction ledger and zero-mileage state were exercised. |
| Transactions | Creation and manual edits to amount/date/category/description persisted. A deductible expense changed the dashboard estimate and CPA matched. Checkbox persistence succeeded but its tax effect failed as F2 describes. |
| Delete | Delete was attempted only on a synthetic expense. The browser confirmation could not be controlled reliably; no completed deletion was observed, and the row was still present on a later ledger visit. Delete success/failure remains unverified. |
| Mileage | First trip saved with the displayed date, distance and priced amount. Its deduction-to-estimate integration failed as F1 describes. |
| Student → Dashboard / CPA | A 2026 1098-T with Box 1 = $10,000 and Box 5 = $15,000 produced $5,000 taxable scholarship income on Dashboard. A 2026 1098-E with $2,500 interest saved and appeared as a $2,500 deduction in CPA. Selecting 2025 showed blank student forms and a 2025 Save control. |
| Home office | Valid record saved and affected the deduction. Invalid-area persistence and recovery were reproduced as F8 describes. |
| Year selection / chart | Summary changes by selected year, but navigation/form continuity and ledger/CSV fail as F3/F4 describe. On the tuition-only fresh account, the 2026 December chart tooltip showed total income $500 and net $0, matching Dashboard. Switching to 2025 changed both tooltip values and summary figures to $0. This confirms year/form propagation; it is not an exhaustive reconciliation of every monthly mixed-income scenario. |
| Amount / date validation | Empty and negative transaction amounts were blocked by browser validation. Oversized amount produced the generic error described above. A $1 personal expense dated December 31, 2026 was accepted without a future-date warning. No stated rule forbids future entries, so acceptance is recorded as behavior, not a defect. |
| Phone | At a configured 375 × 812 viewport, exercised Dashboard, mobile navigation, transaction ledger, mileage, Student, Home Office and CPA Export. No horizontal overflow was observed. Some captures have 360px content width because the scrollbar occupies 15px; the configured viewport was 375px. This does not establish print quality. |
| Bank link / synced edit restrictions | Link attempted only on the fresh user. A Plaid iframe appeared, but no usable institution chooser was exposed. No bank was linked or credentials submitted. The evidence cannot distinguish a browser/environment issue from an integration defect; bank-synced editing restrictions and explanatory UI remain unverified. |
| CPA print | Print button was exercised, but browser controls did not expose a preview/PDF for inspection. Printed pagination, clipping and disclosure visibility remain unverified. |
| Session mid-action | Prepared an unsaved transaction, then signed out through another tab. The original form redirected to Clerk sign-in before submission. This checks explicit sign-out/session revocation, not natural expiration or expiry during an in-flight write. |

### Live-data handling and retained fixtures

The populated original account was not relinked and its records were not modified or deleted. All application writes were through the UI on a fresh synthetic account; no direct database mutation was used. No successful deletion was observed, including on synthetic data.

The primary synthetic account, `audit-e2e-20260910+clerk_test@example.com`, retains these audit records:

| Record | Last verified saved state |
|---|---|
| Manual business income | $50,000; September 11, 2026; memo `E2E AUDIT income baseline 2026`. |
| Manual office expense | $123.45; June 15, 2025; taxDeductible = false; memo `E2E AUDIT edited prior-year expense`. |
| Manual personal expense | $1; December 31, 2026; taxDeductible = false; memo `E2E AUDIT future date`. |
| Mileage | 1,000 miles; September 10, 2026; purpose `E2E AUDIT delivery mileage 2026`. |
| 1098-T | 2026; Box 1 = $10,000; Box 5 = $15,000. |
| 1098-E | 2026; interest = $2,500. |
| Home office | 2026; total area 1,000 sq ft; office area 100 sq ft; monthly rent $1,000; monthly utilities $100. Restored to these valid values after F8. |

The $2 transaction labeled `E2E AUDIT UNSAVED session boundary` was never submitted. The second signup completed successfully. Further synthetic fixtures from the completion pass are listed below.

The final CPA figures observed before adding the $1 future personal expense were total income $53,680, estimated tax $9,668 and safe-to-spend $40,332. Those figures describe that later fixture state, not the earlier isolated reproductions in F1–F6. The updated dashboard after the $1 entry was not checked.

**Environment note, not a release finding.** Initial September 10/11 captures showed missing Tailwind utility styling and an invisible chart. Styling recovered after the September 11 server restart and did not recur during subsequent checks. This transient state is excluded from the primary findings; it is not evidence that the current served app still lacks styling.

The deliberate limitations in [disclaimer.ts](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts) and [tax-audit TRIAGE](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/docs/audits/federal-tax-2026-09-09/TRIAGE.md) were treated as accepted scope. This audit reports contradictions in integration and disclosure, not those deliberate omissions.



### Completion-pass fixture inventory (September 16)

| Account | First application write and retained data |
|---|---|
| `audit-e2e-20260916-forms+clerk_test@example.com` | Home Office first: 2026 total 1,000 sq ft, office 100 sq ft, monthly rent $1,000, utilities $100. Later $7 manual expense edited to $9 by entering -9; memo `E2E AUDIT negative edit and delete`. |
| `audit-e2e-20260916-mileage+clerk_test@example.com` | Mileage first: September 16, 2026, 12.5 miles, purpose `E2E AUDIT first write mileage`; displayed deduction $9.50. |
| `audit-e2e-20260916-tuition+clerk_test@example.com` | 1098-T first: 2026 Box 1 $1,000, Box 5 $1,500; displayed taxable scholarship $500. |
| `audit-e2e-20260916-loan+clerk_test@example.com` | 1098-E first: 2026 interest $250; displayed deduction $250. |

No fixes or direct database mutations were made during this completion pass.
