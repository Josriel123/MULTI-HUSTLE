# Federal tax estimate engine

Pure TypeScript, no database, no auth, no network. Every dollar is a
`decimal.js` `Decimal` (see `money.ts`), every rule cites the authority it
implements, and every function has tests with hand-worked answers in
`__tests__/`.

```
npm test          # vitest, 112 tests
npm run typecheck # tsc --noEmit
```

Entry point: `estimateFederalTax(input)` in `engine.ts`. The route handler at
`src/app/api/dashboard/summary/route.ts` loads rows, calls
`buildFederalTaxInput` (`adapters/prismaRows.ts`) and then the engine.

## Scope

Federal only, one tax year at a time, filing status is an input. Supported tax
years: 2024, 2025, 2026 (`parameters/`). No state tax, no credits (see "Not
modeled" below, and `disclaimer.ts`).

## How to audit this

Each number the engine produces comes from one of two places:

1. **A rule**, implemented in one module with the statute, form line or
   publication quoted in a `Citation` next to the code (`scheduleSE.ts`,
   `qbi.ts`, ...). The module's header comment states the rule in words.
2. **A year-specific amount**, transcribed into `parameters/2024.ts`,
   `2025.ts`, `2026.ts` as the exact digits printed in the cited Revenue
   Procedure. The rate tables also carry the "$B plus R% of the excess" base
   amounts as printed; `__tests__/parameters.test.ts` recomputes each one from
   the brackets, so a mistranscribed bracket boundary or base fails the build.

To check a figure: find its `Line` in the estimate's `lines` array (each has a
form-line `ref`), open the module named in the table below, read the citation,
and redo the arithmetic. The test files show the arithmetic long-hand.

## Computation order (Form 1040)

| Step | Form line | Module | Authority |
|---|---|---|---|
| Gross receipts, expenses by category, meals at 50% | Schedule C 1-28 | `scheduleC.ts`, `categories.ts` | IRC §162(a); §274(n)(1); Schedule C instructions |
| Home office: simplified vs. Form 8829, capped at tentative profit | Schedule C 29-30 | `homeOffice.ts` | IRC §280A(c)(1), (c)(5); Rev. Proc. 2013-13 §4.01, §4.08; Form 8829 |
| Net profit or loss | Schedule C 31 | `scheduleC.ts` | Schedule C instructions (to Schedule 1 line 3, Schedule SE line 2) |
| Net earnings = 92.35% of profit; $400 floor; 12.4% to the wage base + 2.9%; half deductible | Schedule SE 2-13 | `scheduleSE.ts` | IRC §1402(a)(12), (b)(1), (b)(2); §1401(a), (b)(1); §164(f) |
| Additional Medicare Tax 0.9% over $200k/$250k/$125k | Form 8959 | `scheduleSE.ts`, `engine.ts` | IRC §1401(b)(2); §3101(b)(2) |
| Taxable scholarships = Box 5 - Box 1 - required course materials | Schedule 1 8r | `scholarships.ts` | IRC §117(a)-(c); Pub. 970 ch. 1 |
| Total income | 1040 line 9 | `engine.ts` | Form 1040 instructions |
| Student loan interest: $2,500 cap, MAGI phaseout, not MFS, not dependents | Schedule 1 21 | `studentLoanInterest.ts` | IRC §221(b), (c), (e)(2); Pub. 970 ch. 4 |
| Adjusted gross income | 1040 line 11 | `engine.ts` | |
| Standard deduction, with the dependent limit | 1040 line 12 | `standardDeduction.ts` | IRC §63(c)(2), (c)(5), (c)(7); Pub. 501; 1040 instructions worksheet |
| QBI deduction: 20% of (profit - half SE tax), TI limit, phase-in, 2026 minimum | 1040 line 13 | `qbi.ts` | IRC §199A(a), (b)(2)-(3), (c)(2), (e)(2), (i); Form 8995 |
| Taxable income | 1040 line 15 | `engine.ts` | |
| Tax from the rate tables | 1040 line 16 | `incomeTax.ts` | IRC §1(j)(2); Rev. Proc. tables |
| Total tax = income tax + SE tax + Additional Medicare | 1040 line 24 | `engine.ts` | |
| Standard mileage (for Phase 3's logged miles) | Schedule C 9 | `mileage.ts` | Notice 2024-08, 2025-5, 2026-10; Announcement 2026-11; Rev. Proc. 2019-46 |

## Year parameters and their sources

| Year | Brackets, standard deduction, §199A, §221, kiddie | Wage base | Mileage |
|---|---|---|---|
| 2024 | Rev. Proc. 2023-34 (§3.01, 3.02, 3.15, 3.27, 3.30) | $168,600 (2024 Schedule SE instructions) | 67c (Notice 2024-08) |
| 2025 | Rev. Proc. 2024-40 (§3.01, 3.02, 3.15, 3.27, 3.30), **except** the standard deduction, which Pub. L. 119-21 §70102 raised to $15,750 / $23,625 / $31,500 after the Rev. Proc. was issued (2025 Form 1040 instructions; IRC §63(c)(7)) | $176,100 (2025 Schedule SE instructions) | 70c (Notice 2025-5) |
| 2026 | Rev. Proc. 2025-32 (§4.01, 4.02, 4.14, 4.26, 4.29); first year of the $75,000 / $150,000 §199A phase-in range and the §199A(i) $400 minimum | $184,500 (IRS Tax Topic 751) | 72.5c to June 30 (Notice 2026-10), 76c from July 1 (Announcement 2026-11) |

Statutory constants that do not change year to year live next to the rule that
uses them: 92.35%, 12.4%, 2.9%, 0.9%, the $400 SE floor, the Additional
Medicare thresholds, the $2,500 student-loan-interest cap, 20% for QBI, $5 and
300 sq ft for the simplified home office, 50% for meals, $2,500 de minimis.

## What the previous code got wrong, and the rule now applied

| Before (`summary/route.ts`, Phase 1) | Now |
|---|---|
| Flat 12% income tax on everything above zero | §1(j)(2) brackets by filing status, after the standard deduction and the QBI deduction |
| 15.3% SE tax on the whole net profit | 15.3% on 92.35% of net profit (§1402(a)(12)); nothing under $400 (§1402(b)(2)); Social Security part capped at the wage base (§1402(b)(1)); half deductible (§164(f)) |
| No QBI deduction | §199A: 20% of QBI, limited to 20% of taxable income, phased out above the threshold |
| No standard deduction | §63(c), including the dependent limitation |
| Student loan interest: `min(2500, box1)` regardless of income or status | §221 phaseout by MAGI; disallowed for married filing separately and for dependents |
| Deductions found by `description.includes('amazon')`, loans by `includes('loan')` | `Transaction.category` set by the user; descriptions are never read (`categories.ts`) |
| Business net clamped at zero | A Schedule C loss flows through (with a warning about the loss-limitation rules that are not modeled) |
| Mileage = income x 0.25 | Zero until miles are logged; `mileage.ts` prices logged miles |
| Money as JavaScript floats | `Decimal` end to end; DECIMAL(12,2) in Postgres |
| Filing status: implicit single | `User.filingStatus` (default single, reported as an assumption when defaulted) |

The 1098-T handling (taxable = Box 5 - Box 1 - required books/supplies) was
roughly right in shape and is kept, now with its assumptions stated
(`scholarships.ts`): Box 1 is treated as the tuition the scholarship covered,
the student is a degree candidate with no service requirement, and only
materials tagged as required for courses count. The excess is Schedule 1 line
8r income, never self-employment income, and it counts as earned income for a
dependent's standard deduction (Pub. 501; 1040 instructions footnote).

## Rounding

Amounts are rounded to whole cents, half up, at the points where a form line
would be written (`cents()` in `money.ts`). Schedule SE lines 10 and 11 are
rounded separately and then added, as on the form. The IRS allows whole-dollar
rounding on a filed return ("Rounding Off to Whole Dollars", Form 1040
instructions), so a real return can differ by cents. Income tax uses the exact
bracket formula; the Tax Table used under $100,000 of taxable income is built
on $50 bands and can differ by up to about $5. Both points are listed in the
estimate's `assumptions`.

## Categories

`categories.ts` defines the vocabulary for `Transaction.category` and the tax
treatment of each entry, with its authority. Income categories decide whether
a deposit is business income (Schedule C), other income (Schedule 1 line 8z),
or not income at all (loan proceeds, transfers, refunds, gifts, scholarship
refunds already covered by the 1098-T). Two income categories are "excluded,
not modeled" and raise a warning: investment proceeds (capital gains need
basis; Schedule D) and W-2 paychecks (wages must come from the W-2 itself).

Expense categories map to Schedule C lines. `meals` is deductible at 50%.
`equipment` is deductible per item up to the $2,500 de minimis safe harbor
(Treas. Reg. §1.263(a)-1(f), Notice 2015-82); larger items are not deducted
and a warning says a Form 4562 depreciation computation is required.
`education_required_materials` offsets scholarship income under §117(b)(2)(B)
and is not a Schedule C expense.

Defaults when `category` is null: income is business income (and the total is
reported in an `uncategorised_income` warning so the UI can ask); an expense
is deductible only if the user marked it `taxDeductible`.

## Not modeled

`disclaimer.ts` lists every rule the engine leaves out; the list is returned in
every estimate as `notModeled`. The largest for this app's users: tax credits
(EITC, child tax credit, education credits), which can reduce the real
liability well below the estimate; W-2 wages unless supplied; depreciation;
the self-employed health insurance deduction; the kiddie tax (a warning is
raised when it may apply); state tax.

## Output

`FederalTaxEstimate` carries every intermediate result, a `lines` array in
form order, `warnings` (things that changed or limited the number), `assumptions`
(things taken as given), `notModeled`, deduplicated `citations`, and the
`disclaimer` string. `toPlain()` converts it to JSON-safe numbers. The
disclaimer is part of the output on purpose: nothing can display a liability
figure from this engine without also receiving the text that qualifies it.
Phase 4 must render `disclaimer` next to every liability figure.

## Adding a tax year

Add `parameters/YYYY.ts` with the Rev. Proc. figures and their citations,
register it in `parameters/index.ts`, and add the year's expected values to
`__tests__/parameters.test.ts`. Nothing else changes.
