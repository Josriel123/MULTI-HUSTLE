# Focused E2E second pass — September 18–22, 2026

**Status: completed for the three requested areas; two confirmed bugs.** Finalized September 23 against revision `1832045c27eefb26c36bb441635e465d00378da4`. Scope is limited to deletion, Plaid Link/bank edit restrictions, and CPA print output. No application fixes. The September 10–16 findings and deliberate federal-engine omissions were not re-audited. The optional populated-account relink/adoption scenario was not exercised.

## Confirmed findings

### S1 — P2, broken: default printed organizer loses the assumptions and not-modeled lists

**What I did.** Opened CPA Export on the populated account for 2026 in Microsoft Edge and clicked Print Organizer (PDF), leaving both disclosure sections in their default collapsed state. Inspected the actual browser print preview, which reported three pages.

**Expected.** The organizer handed to a preparer should include the known limitations referenced by its disclaimer. Paper/PDF readers cannot expand web disclosure controls.

**Actual.** Page 1 prints the full general disclaimer and six estimate notices. It then prints only “Assumptions this estimate makes (10)” and “Tax items not modeled by this engine (20)” with collapsed triangles. The underlying list contents are absent from those sections. The print button directly invokes `window.print()`; the component uses closed `<details>` elements and the print CSS does not expand them or supply a print-only version.

**Severity.** P2: material disclosure is lost in the artifact intended to leave the app. This reports disclosure loss, not the deliberate tax omissions themselves.

**Evidence.** [Actual print preview](evidence/print-preview-collapsed.png). Source: `src/components/EstimateNotice.tsx`, `src/app/export/page.tsx`, and the print block in `src/app/globals.css`.

**September 20 completion.** Saved the actual Microsoft Print to PDF output as [cpa-default.pdf](evidence/cpa-default.pdf), rendered and visually inspected all three pages ([page 1](evidence/cpa-default-1.png), [page 2](evidence/cpa-default-2.png), [page 3](evidence/cpa-default-3.png)). The general disclaimer and six notices survive. Both collapsed lists' contents are absent throughout the PDF. Schedule C figures, education figures and signature lines are readable; no clipped financial figures or missing financial sections were observed in this sample. The disclaimer card's bottom border spills onto page 2, a minor layout blemish. The result after manually expanding both lists has not been tested.

### S2 — P3, broken: deleting the last mileage entry changes the displayed rate

**What I did.** On the forms test account with tax year 2026 selected, deleted its sole 10-mile September 20 trip through Edge, with the user accepting the native confirmation.

**Expected.** The trip count, miles, and deduction should become zero; removing a trip should not change the rate displayed for the selected year.

**Actual.** Deletion succeeded and the empty history appeared. Miles changed from 10 to 0 and the deduction from $7.60 to $0.00, but “Current IRS Rate” changed from **$0.7600/mi to $0.725/mi** with 2026 still selected. `src/components/MileageSection.tsx:85` takes the rate from the latest row, then falls back to the hard-coded string `0.725` when no rows remain. This is a UI inconsistency with the app's selected-year pricing, not a re-audit of statutory rates.

**Severity.** P3: incorrect information in the empty state. The tested zero-dollar deduction is correct; no incorrect stored deduction was established.

**Evidence.** [Before deletion](evidence/20260922-mileage-before-delete.png), [after deletion / incorrect rate](evidence/20260922-mileage-empty-rate.png), [empty history](evidence/20260922-mileage-empty-history.png), [authenticated readback](evidence/20260922-mileage-delete-success.json).

## Verification results

| Check | Evidence and result |
|---|---|
| Transaction delete authorization | Real HTTP requests to the running app using Clerk-issued sessions for two existing synthetic users. Foreign-user DELETE returned **403 Forbidden**; anonymous DELETE returned **401 Unauthorized**; owner GET confirmed the fixture survived both. Owner DELETE returned **200 success**, and a repeat returned **404**. |
| Mileage delete authorization | Same sequence and results as transactions: **403**, **401**, row preserved, owner **200**, then **404**. |
| Transaction delete UI | Completed September 22 in Edge with the user accepting the native confirmation. The marked $13.37 expense disappeared and the ledger/tab counts changed from two to one without a manual reload. The original $9 expense remained. Fresh authenticated GET confirmed the deleted row was absent. [Screenshot](evidence/20260922-transaction-deleted.png), [readback](evidence/20260922-transaction-delete-success.json). |
| Mileage delete UI | Completed September 22 in Edge with the user accepting the native confirmation. Trip count changed from one to zero, miles from 10 to 0, deduction from $7.60 to $0.00, and the empty-history message appeared. Independent GET confirmed no logs and zero totals. After reload, transaction/mileage tab counts remained one/zero. The rate card has the display defect in S2. |
| Plaid Link UI | **Completed September 22 in regular Edge** on the unlinked forms test account. Clicked Connect a bank, continued without a phone number, searched First Platypus Bank, selected its non-OAuth option, entered `user_good` / `pass_good`, continued with the sandbox accounts, and finished without saving an optional Plaid profile. The app showed “Bank account connected” and “Bank linked. Sync to import transactions.” API status changed from `linked: false` to `linked: true`. [Chooser](evidence/20260922-plaid-chooser.png), [linked UI](evidence/20260922-plaid-linked.png), [before](evidence/20260922-plaid-before-link.json), [after](evidence/20260922-plaid-after-link.json). The earlier in-app-browser blank iframe was not reproduced in Edge and is not asserted as an app defect. |
| Browser sync after Link | Clicked Sync transactions on the forms account. The app reloaded, retained the connected state, and refreshed dashboard figures. Readback showed `hasSynced: true`, **49 total rows = 48 bank rows with 48 distinct Plaid IDs + the original $9 manual expense**. The deleted $13.37 fixture remained absent. [Readback](evidence/20260922-plaid-ui-sync-readback.json). This verifies import from the browser-linked account; it does not establish relink adoption or repeated-sync idempotency. |
| Sandbox import | To independently exercise bank rows, used Plaid's sandbox API to create a First Platypus Bank fixture with `user_good` / `pass_good`, then called the app's exchange and sync endpoints. Exchange **200**, first sync **200 / count 16 / adopted 0**. **This does not verify the Link UI.** |
| Bank amount/date lock, API | Attempted to change a synced $25 expense to $26 and its date to January 1. Each returned **400** with a specific bank-lock explanation; owner GET confirmed both fields unchanged. |
| Bank amount/date lock, UI | Opened that row's editor. Amount and Date were disabled and accompanied by “Locked (Bank synced)” plus an explanatory notice. No silent reversion. [Screenshot](evidence/bank-edit-lock.png). |
| Bank category / derived flag | Through the browser editor, selected Office expense and saved: API readback showed `office_expense`, `taxDeductible: true`. Reopened, selected Personal, saved: `personal`, `taxDeductible: false`. The ledger displayed Not deductible; amount/date stayed fixed. [Screenshot](evidence/bank-personal-saved.png). |
| Category persistence through sync | Subsequent sandbox sync returned **200 / count 48 / adopted 0**; the tested row remained personal/non-deductible. There were 49 total rows afterward, including the one manual fixture. This was the sandbox history's subsequent delivery, not a zero-change idempotency test. |
| Populated-account legacy adoption | **Not exercised.** The populated account was not relinked or synced in this pass, so no claim is made about the expected 31 adoptions. |
| CPA print | Completed September 20: saved and visually inspected all three PDF pages. General disclaimer and scenario notices survive; assumptions and NOT_MODELED contents fail as S1 describes. Financial sections and signatures are readable. |

**Cosmetic observation, non-blocking:** the bottom border of the disclaimer card spills onto page 2 in the printed sample. No financial content was clipped. This is separate from the two functional/display defects above; see [printed page 2](evidence/cpa-default-2.png).

## Reproducibility and retained data

The HTTP authorization checks use the real local server and database with valid Clerk JWTs, not mocked route handlers. Only test identities were used for these requests. Tokens and secrets were not written into evidence files.

- [Ownership HTTP results](evidence/ownership-http.json): two disposable fixtures on `audit-e2e-20260916-forms+clerk_test@example.com` were created and successfully deleted by their owner. `audit-e2e-20260916-mileage+clerk_test@example.com` supplied the foreign identity. Existing records were not deleted.
- [UI fixtures](evidence/ui-fixtures.json): `audit-e2e-20260916-loan+clerk_test@example.com` received a $12.34 personal expense and a 12.5-mile trip, both marked `E2E SECOND PASS 20260918 disposable delete test`. These earlier fixtures were retained; the completed UI delete checks used the separate forms-account fixtures listed below.
- [Sandbox import](evidence/sandbox-sync.json) and [bank lock/category evidence](evidence/bank-lock-http.json): the loan test account now has a First Platypus Bank sandbox connection and imported sandbox rows. The $25 `CREDIT CARD 3333 PAYMENT *//` row is categorized personal after the edit test.
- The forms test account now also has a browser-linked First Platypus Bank sandbox connection and 48 imported bank rows. Its original $9 expense remains. Its September 20 $13.37 transaction and 10-mile trip were deleted through the UI with manual confirmation assistance.
- The original populated account's data was not edited, deleted, relinked, or synced. Its print view was inspected read-only.

## Delete recovery observation and coverage limits

**September 22 delete follow-up.** After manually accepting a transaction confirmation that had been left open for an extended period, the user reported an authorization error (exact wording/status not captured). Authenticated owner readback confirmed the $13.37 fixture still existed, with two transactions total and the synthetic Clerk session active; see [readback](evidence/20260922-delete-after-manual-confirm.json). Edge likewise still showed both rows. After reloading, the user repeated the delete and promptly accepted confirmation: deletion succeeded, the UI refreshed to one row, and independent GET confirmed persistence. Stale browser authentication is a hypothesis for the initial error, not an established cause. The initial error is retained as an observation, not a confirmed application defect.

Both September 20 forms-account fixtures ($13.37 expense and 10-mile trip) have now been deleted through the UI; the original $9 expense was retained. See [fixture evidence](evidence/20260920-ui-fixtures.json). User assistance was limited to native confirmations because Computer Use repeatedly failed on those dialogs.

All three requested areas now have direct verification: successful UI deletion plus live ownership requests, actual browser Plaid Link plus bank-row editing, and the actual three-page printed PDF. No further UI assistance is pending. Populated-account adoption of 31 legacy rows, other bank institutions, and the print variant with manually expanded disclosures were not tested.

The tool limitations above are explicitly excluded from application findings.
