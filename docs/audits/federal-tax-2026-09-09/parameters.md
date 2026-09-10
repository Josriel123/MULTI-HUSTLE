# Federal tax audit: independent parameter verification

Audit date: September 9, 2026. Scope: `src/lib/tax/parameters/**`, related rule consumers and README claims. This annex is outside the repository. No engine, test, or README file was changed.

All **12 individual rate tables, 72 finite bracket tops, 72 cumulative base amounts, and the requested year-specific parameters** agree with the primary IRS/SSA sources checked below. This is a source comparison, not an inference from the passing tests. The issues found here concern an unsupported QBI minimum cap, an undocumented omitted deduction, and incorrect 2025 citation section numbers.

## Source ledger

| Source | Independently checked provisions |
|---|---|
| [Rev. Proc. 2023-34](https://www.irs.gov/pub/irs-drop/rp-23-34.pdf) | 2024: §3.01 Tables 1–4 (PDF pp. 5–7); §3.02 kiddie amount; §3.15 standard deduction; §3.27 QBI; §3.30 student loan interest. |
| [Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf) | 2025: **§2.01**, Tables 1–4 (PDF pp. 5–6); §2.02 kiddie amount; §2.15(2) dependent deduction; §2.27 QBI; §2.30 student loan interest. Original §2.15(1) basic deductions were superseded. |
| [Rev. Proc. 2025-32](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf) | §3.01 replaces the 2025 basic deduction; 2026: §4.01 Tables 1–4 (PDF pp. 10–12), §4.02 kiddie amount, §4.14 standard deduction, §4.26 QBI, §4.29 student loan interest. |
| [SSA contribution and benefit bases](https://www.ssa.gov/oact/cola/cbb.html) | All three Social Security wage bases; also confirms 12.4% self-employment Social Security and 2.9% Medicare rates. |
| [Public Law 119-21](https://www.govinfo.gov/content/pkg/PLAW-119publ21/pdf/PLAW-119publ21.pdf) | §70102: 2025 deduction increase; §70105: 2026 QBI range/minimum and effective date; §70424: 2026 charitable deduction for nonitemizers. |
| [Notice 2024-08](https://www.irs.gov/pub/irs-drop/n-24-08.pdf), [Notice 2025-5](https://www.irs.gov/pub/irs-drop/n-25-05.pdf), [Notice 2026-10](https://www.irs.gov/pub/irs-drop/n-26-10.pdf), [Announcement 2026-11](https://www.irs.gov/irb/2026-29_irb) | Business mileage rates and effective dates, including the July 1, 2026 increase. |

## Complete bracket comparison

Every table uses rates **10%, 12%, 22%, 24%, 32%, 35%, 37%**. Each `tops` list contains the six finite upper boundaries; the seventh bracket has no upper limit. Each `bases` list contains the cumulative dollar tax at the six lower boundaries of brackets 2–7. Bracket 1 starts at zero with a zero base. These source values match the implementation exactly.

| Year | Table | Tops in ascending order ($) | Bases in corresponding order ($) |
|---|---|---|---|
| 2024 | Joint / qualifying surviving spouse | 23,200; 94,300; 201,050; 383,900; 487,450; 731,200 | 2,320; 10,852; 34,337; 78,221; 111,357; 196,669.50 |
| 2024 | Head of household | 16,550; 63,100; 100,500; 191,950; 243,700; 609,350 | 1,655; 7,241; 15,469; 37,417; 53,977; 181,954.50 |
| 2024 | Single | 11,600; 47,150; 100,525; 191,950; 243,725; 609,350 | 1,160; 5,426; 17,168.50; 39,110.50; 55,678.50; 183,647.25 |
| 2024 | Married filing separately | 11,600; 47,150; 100,525; 191,950; 243,725; 365,600 | 1,160; 5,426; 17,168.50; 39,110.50; 55,678.50; 98,334.75 |
| 2025 | Joint / qualifying surviving spouse | 23,850; 96,950; 206,700; 394,600; 501,050; 751,600 | 2,385; 11,157; 35,302; 80,398; 114,462; 202,154.50 |
| 2025 | Head of household | 17,000; 64,850; 103,350; 197,300; 250,500; 626,350 | 1,700; 7,442; 15,912; 38,460; 55,484; 187,031.50 |
| 2025 | Single | 11,925; 48,475; 103,350; 197,300; 250,525; 626,350 | 1,192.50; 5,578.50; 17,651; 40,199; 57,231; 188,769.75 |
| 2025 | Married filing separately | 11,925; 48,475; 103,350; 197,300; 250,525; 375,800 | 1,192.50; 5,578.50; 17,651; 40,199; 57,231; 101,077.25 |
| 2026 | Joint / qualifying surviving spouse | 24,800; 100,800; 211,400; 403,550; 512,450; 768,700 | 2,480; 11,600; 35,932; 82,048; 116,896; 206,583.50 |
| 2026 | Head of household | 17,700; 67,450; 105,700; 201,750; 256,200; 640,600 | 1,770; 7,740; 16,155; 39,207; 56,631; 191,171 |
| 2026 | Single | 12,400; 50,400; 105,700; 201,775; 256,225; 640,600 | 1,240; 5,800; 17,966; 41,024; 58,448; 192,979.25 |
| 2026 | Married filing separately | 12,400; 50,400; 105,700; 201,775; 256,225; 384,350 | 1,240; 5,800; 17,966; 41,024; 58,448; 103,291.75 |

Source-document caution: Rev. Proc. 2023-34's PDF prints an inconsistent $191,150 in the descriptive excess expression for some 32% rows, while the bracket boundary and cumulative base correspond to $191,950. The implementation uses the consistent $191,950 boundary; this source typo is not an engine finding.

## Other parameter comparison and filing-status mapping

All amounts below are dollars unless marked as cents per mile. “Other” in QBI and student-interest tables includes qualifying surviving spouse; receiving the joint income-tax table does not itself make that return a joint return. `bracketTableFor`, `isJointReturn`, and `qbiAmountFor` preserve that distinction.

| Parameter | 2024 | 2025 | 2026 | Result |
|---|---:|---:|---:|---|
| Basic deduction: single / married separately | 14,600 | 15,750 | 16,100 | Match |
| Basic deduction: joint / qualifying surviving spouse | 29,200 | 31,500 | 32,200 | Match |
| Basic deduction: head of household | 21,900 | 23,625 | 24,150 | Match |
| Dependent floor | 1,300 | 1,350 | 1,350 | Match |
| Dependent earned-income add-on | 450 | 450 | 450 | Match |
| Social Security wage base | 168,600 | 176,100 | 184,500 | Match |
| QBI threshold: joint | 383,900 | 394,600 | 403,500 | Match |
| QBI threshold: married separately | 191,950 | 197,300 | 201,775 | Match |
| QBI threshold: other | 191,950 | 197,300 | 201,750 | Match |
| QBI phase-in width: joint | 100,000 | 100,000 | 150,000 | Match |
| QBI phase-in width: married separately / other | 50,000 | 50,000 | 75,000 | Match |
| QBI minimum / active-QBI floor | None | None | 400 / 1,000 | Match as parameter values; consumer issue below |
| Student-interest MAGI phase-out: joint | 165,000–195,000 | 170,000–200,000 | 175,000–205,000 | Match |
| Student-interest MAGI phase-out: other eligible status | 80,000–95,000 | 85,000–100,000 | 85,000–100,000 | Match |
| Kiddie-tax base; warning threshold is twice this | 1,300 | 1,350 | 1,350 | Match |
| Business mileage, cents/mile | 67 all year | 70 all year | 72.5 January–June; 76 July–December | Match |

The 2025 engine correctly uses the post-enactment standard deduction, rather than the superseded $15,000/$22,500/$30,000 figures. The 2026 QBI joint threshold really is $403,500, although the corresponding ordinary-income bracket is $403,550; the $25 difference between the separate-return and other-return QBI thresholds is also in the IRS source. These were specifically challenged and verified, rather than “corrected” to superficially more symmetric numbers.

Age/blindness additions are not present in these tables, but [disclaimer.ts:34](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:34) expressly excludes them. Other statutory constants should be assessed with their rule modules; this annex is not a substitute for the order-of-operations audit.

## Finding P3: QBI minimum is capped by an unstated rule

Location: [qbi.ts:126](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/qbi.ts:126), particularly line 130. The test at [qbi.test.ts:65](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/__tests__/qbi.test.ts:65) preserves the same error by expecting $300 instead of $400.

For a taxpayer who materially participates in a qualifying trade or business and has at least $1,000 aggregate active QBI, IRC §199A(i)(1), added by Pub. L. 119-21 §70105, sets the deduction at the greater of its ordinary amount or $400. The law uses “shall be equal to the greater of” and expressly excepts subsection (i) from subsection (a). It does not add a cap equal to taxable income before QBI. [Enacted law, PDF pp. 91–92](https://www.govinfo.gov/content/pkg/PLAW-119publ21/pdf/PLAW-119publ21.pdf).

The [2026 draft Form 8995](https://www.irs.gov/pub/irs-dft/f8995--dft.pdf), lines 15–17, corroborates separate ordinary/minimum computations followed by the greater amount. This is a draft, not a form for filing; the finding rests on the enacted statute. The available draft instructions URL still serves 2025 instructions and was not treated as 2026 authority.

Failing test to place in a separate audit test file, without changing production code:

```ts
import { expect, it } from 'vitest';
import { computeQbiDeduction } from '../qbi';
import { getTaxYearParameters } from '../parameters';

it('2026 statutory minimum remains $400 with only $100 of pre-QBI taxable income', () => {
  // Sole proprietor materially participates; no prior QBI losses.
  // Profit 1,500; deductible half SE tax 105.97; active QBI 1,394.03.
  // Other wages can make taxable income before QBI equal to 100.
  // Ordinary deduction is min(278.81, 20.00) = 20.00.
  // Section 199A(i): greater of 20.00 or 400.00 = 400.00.
  const result = computeQbiDeduction({
    netProfit: '1500',
    deductibleHalfSelfEmploymentTax: '105.97',
    taxableIncomeBeforeQbi: '100',
    filingStatus: 'single',
  }, getTaxYearParameters(2026));
  expect(result.deduction.toFixed(2)).toBe('400.00');
  // Current implementation: '100.00'.
});
```

A read-only module probe reproduced deductions of $0/$100/$300/$400 when pre-QBI taxable income was $0/$100/$300/$400 with active QBI above $1,000. **No total-tax difference results from this cap alone:** [engine.ts:249](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:249) floors taxable income at zero in both versions. The defect is in the reported deduction/form amount and the claimed statutory implementation. The module has no material-participation input; the fixture expressly assumes participation, so this is not a claim about passive income.

## Finding P2: the 2026 nonitemizer charitable deduction is an undocumented omission

Locations: [disclaimer.ts:25](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:25), [disclaimer.ts:34](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:34), and the exhaustive-list claim at [README.md:130](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/README.md:130).

IRC §170(p), as amended by Pub. L. 119-21 §70424, allows qualifying cash charitable contributions of up to $1,000 ($2,000 on a joint return) beginning in 2026 for taxpayers who take the standard deduction. [IRS Topic 506](https://www.irs.gov/taxtopics/tc506) and [2026 Publication 505](https://www.irs.gov/pub/irs-prior/p505--2026.pdf) expressly describe this benefit for nonitemizers.

The engine has no input/computation for this deduction and `NOT_MODELED` does not identify it. Omitting itemized deductions does not disclose an omitted deduction available to people using the standard deduction. Listing four other new deductions at line 34 does not cover this one. This is a scope/disclosure finding, not a request to expand the engine. A filer otherwise in a 22% marginal bracket can have a $220 difference for $1,000 of eligible contributions; the QBI taxable-income limitation may alter that effect for a gig worker.

There is no honest current-interface numerical test that represents eligible charitable contributions as such: that input is absent. A test inventing a property or misclassifying a donation as a Schedule C expense would test unsupported input. The relevant executable check is that an estimate's omission list fails to disclose the benefit, and the direct code/README discrepancy suffices for this documentation finding.

## Finding P3: 2025 citations point to nonexistent subsections

Locations: [2025.ts:58](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/parameters/2025.ts:58), lines 70, 82, 94, 118, 139, 151 and 160; [README.md:65](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/README.md:65).

The cited [Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf) puts 2025 adjusted items in **Section 2**; Section 3 is its effective-date provision. References to §3.01/§3.02/§3.15/§3.27/§3.30 should therefore identify §2.01/§2.02/§2.15/§2.27/§2.30. This contradicts the README's audit trail but does not change computed dollars. No IRS computation rule is violated by the citation typo itself; it is a traceability defect, not a math finding.

## Parameter-test independence assessment

The bracket-base tests use the implementation's bracket tops and its `taxAtLowerBoundAsPrinted` fields. They check the internal consistency of two values in the same parameter table, not the accuracy of either transcription against IRS material. Their expected bases nevertheless have a real external source: the independently checked IRS printed bases above. Calling those tests mere output snapshots would be too strong, but calling them independent source verification would also be wrong.

The three year-specific tests at [parameters.test.ts:94](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/__tests__/parameters.test.ts:94) repeat literal values that were independently confirmed here. Their title says “second source,” but the cited Revenue Procedure is generally the same primary document as the production table, and the source-reading procedure is not encoded. The surviving-spouse test at line 69 compares two calls to `computeIncomeTax`; that particular assertion is an implementation-consistency check, not a known numerical answer. Citation-label truthiness/regex tests do not validate an authority's existence, section number, or substance, which is why the §3-versus-§2 defect passes.
