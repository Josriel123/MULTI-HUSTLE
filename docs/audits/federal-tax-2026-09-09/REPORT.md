# Federal tax engine correctness audit

Completed September 10, 2026; examination began September 9. Scope: `src/lib/tax/**`, its 112 existing tests, and README. Examined checkout: `2a52dd044b4247428b62179b1cddb79f8688d121`. **Report only: no production code, repository tests, or README changed.** Audit artifacts are outside the repository.

The audit found a partial-year home-office calculation error, an incorrect 2026 QBI deduction-line cap, false-negative kiddie-tax warnings, and several consequential cases that the input model cannot represent. The parameter values survived independent source comparison. The ordinary SE → AGI → QBI → taxable-income sequence also survived targeted probes. The 112 passing tests do not cover the failures described below.

Supporting artifacts:

- [Per-test provenance: all 112 cases](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/test-provenance.md).
- [Complete parameter tables and primary-source comparison](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/parameters.md).
- [Executable counterexamples and control cases](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs), with [captured assertion output](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples-output.txt).
- [Independent bracket-boundary probe](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/bracket-boundaries.cjs).

Severity: **P1/high** means a supported-looking scenario can produce a substantial tax error; **P2/medium** means an actionable correctness, applicability, or disclosure problem; **P3/low** means an audit-trail/form-line defect without a demonstrated total-tax change.

**How to interpret the failing tests:** there are 12 failing assertions, not 12 independent arithmetic defects. Two concern calculations/form amounts, two concern kiddie-warning logic, one checks the promised omission disclosure, and seven demonstrate missing-input scenarios. Tests marked **DOMAIN GAP** state necessary real-world facts in their comments because the API has no way to encode them. Their expected IRS result is correct under those stated facts; it is not uniquely determined by the encoded inputs alone. They demonstrate incomplete applicability and disclosure, rather than claiming the engine could infer unavailable information. These are audit reproductions, not a proposed ready-to-merge test patch.

## 1. Test provenance and assurance

**The literal tax fixtures are traceable calculations, but their historical independence is unproven.** All tax implementation, tests, and README were introduced in the same visible commit, `cd0dcdf1682995e26fcddbb052c31786e8dd147a`. The comments claim hand derivation and usually show reproducible arithmetic. There are no snapshot files or snapshot assertions, but absence of snapshot syntax cannot prove that nobody originally copied an output into a literal.

No test identifies an IRS published worked example by name/number and takes that example's complete inputs and answer. Most numeric fixtures are synthetic calculations from form rules, statutory constants, or Revenue Procedure tables. It would be unsupported to call them proven output snapshots. It would also be unsupported to call their authorship independently verified. The [inventory](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/test-provenance.md) classifies each case as a reproducible hand calculation, literal lookup, application/arithmetic fixture, internal consistency check, or structural check, and identifies its source chain and evidence limits.

**P2 — The claimed transcription safeguard is overstated.** [parameters.test.ts:48](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/__tests__/parameters.test.ts:48) computes tax from production brackets and compares it with another field in those same production tables, `taxAtLowerBoundAsPrinted`. A consistently wrong boundary/base pair can pass. [README.md:30](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/README.md:30) claims a mistranscribed boundary or base fails the build without that qualification. Year-specific literal checks are stronger, but their claimed “second source” is not accompanied by independently collected fixtures. This is an assurance defect, not itself a violation of an IRS computation rule.

Specific blind spots that mattered:

- [homeOffice.test.ts:60](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/__tests__/homeOffice.test.ts:60) tests six months only for the regular method, missing F1.
- [qbi.test.ts:56](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/__tests__/qbi.test.ts:56) positively asserts the incorrect minimum-deduction cap in F8. This is a legally wrong expected answer, even though its arithmetic is transparent.
- [engine.test.ts:113](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/__tests__/engine.test.ts:113) claims W-2 wage-base coordination, but its wages plus SE earnings never reach the wage cap. Omitting wages from that SE call would not fail this fixture.
- The only end-to-end student-loan fixture has a dependent's disallowed deduction of zero. The existing suite therefore does not establish ordering when the deduction is allowed.
- The three complete positive-tax end-to-end known-answer fixtures are all 2025 single. Other statuses and years have modular coverage, but no corresponding full expected-tax chain.
- Comparisons of QSS with another engine call, of 2024 tax with 2026 tax, and of serialized tax with the original computed tax are useful invariants/serialization tests; they are not independent liability oracles.

## 2. Parameter verification

The [parameter annex](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/parameters.md) records every checked number and source. **All 12 bracket tables match**, including 72 finite thresholds, 72 printed cumulative bases, and all seven rates. Basic/dependent standard deductions, Social Security wage bases, QBI thresholds/ranges/minimum, student-interest phaseouts, kiddie amounts, and mileage periods/rates also match.

The controlling sources were [Rev. Proc. 2023-34](https://www.irs.gov/pub/irs-drop/rp-23-34.pdf), [Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf), [Rev. Proc. 2025-32](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf), and [SSA's contribution-and-benefit-base history](https://www.ssa.gov/oact/cola/cbb.html), with enacted changes and mileage notices checked separately in the annex.

In particular, 2025 correctly uses the increased $15,750/$23,625/$31,500 deductions. The asymmetric 2026 QBI thresholds are real: $403,500 joint, $201,775 MFS, $201,750 other. The $75,000/$150,000 phase-in widths and $400/$1,000 minimum parameters are also correct. The minimum's application is a separate code defect, F8.

**P3 — Incorrect 2025 source sections.** [2025.ts:58](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/parameters/2025.ts:58) and other citations throughout that file, plus [README.md:65](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/README.md:65), identify §3.01/3.02/3.15/3.27/3.30 of Rev. Proc. 2024-40. The relevant sections are **2.01/2.02/2.15/2.27/2.30**; Section 3 concerns the effective date. The dollars are correct, but citation-label tests do not detect this traceability failure. [Actual Revenue Procedure](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf).

## 3. Order of operations and boundary attacks

The relevant sequence in [engine.ts:176](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:176), continuing through lines 249, is correct within the modeled inputs: compute SE tax and its deductible half; subtract that half before student-loan MAGI; subtract allowed interest in AGI; apply the dependent/regular standard deduction; compute QBI and its pre-QBI taxable-income limit; subtract QBI; calculate tax. Student-loan interest reduces the taxable-income limit, but does not reduce business QBI itself. Business-attributable half-SE tax reduces both. [Schedule SE](https://www.irs.gov/pub/irs-pdf/f1040sse.pdf), [Form 8995 instructions](https://www.irs.gov/instructions/i8995), [Pub. 970](https://www.irs.gov/publications/p970).

An independently calculated [positive-interest control](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:158) used 2025 single, $95,000 Schedule C profit, and $2,500 interest paid. It passed these literal expected amounts:

| Stage | Independently calculated dollars |
|---|---:|
| SE earnings | 87,732.50 |
| SE tax / deductible half | 13,423.07 / 6,711.54 |
| MAGI before student-loan interest | 88,288.46 |
| Interest deduction after phaseout | 1,951.92 |
| AGI | 86,336.54 |
| Business QBI | 88,288.46 |
| Pre-QBI taxable income | 70,586.54 |
| QBI deduction, constrained by taxable income | 14,117.31 |
| Final taxable income | 56,469.23 |

Additional controls passed: a $4,000 Schedule C loss offsets $50,000 of wages while SE/QBI deductions remain zero; taxable scholarships count toward the dependent standard deduction but not SE income; under-$400 SE earnings do not acquire Additional Medicare tax merely because wages are high; and zero-income tax/balance remain zero in all three years and five statuses. These controls establish those cases, not universal correctness.

The separate [boundary probe](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/bracket-boundaries.cjs) uses the independently transcribed IRS bases in the annex, not production table values, as its oracle. **270 checks passed**: every finite boundary, $1 below, and $1 above, for all years and statuses, including QSS. This exercises the exact rate formula promised by the README. The code deliberately does not use the IRS Tax Table below $100,000; that approximation is disclosed and is not reported here as a newly discovered formula defect.

## 4. Reproduced findings

### F1 — P2: partial-year simplified home-office deduction is overstated

**Location:** [homeOffice.ts:129](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/homeOffice.ts:129). `monthsUsed` affects regular costs, but the simplified calculation always multiplies the unprorated area by $5. This directly contradicts the input contract that the office is used for the given months.

**Rule:** part-year simplified use requires average monthly allowable area; sum the qualifying monthly areas and divide by 12. [Pub. 587, Part-year use or area changes](https://www.irs.gov/publications/p587).

**Failing test:** [F1](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:31): 300 square feet for six full qualifying months, no actual costs, $10,000 tentative profit. Expected `(300 × 6 / 12) × $5 = $750`; actual **$1,500**. This excess deduction flows into Schedule C, SE tax, AGI, and QBI. No omitted-information qualification is needed to demonstrate this bug.

### F2 — P1: joint-return wages cannot be attributed to the correct spouse

**Location:** [engine.ts:35](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:35), [engine.ts:181](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:181), and [scheduleSE.ts:149](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/scheduleSE.ts:149). One W-2 input feeds both household income and the sole proprietor's remaining Social Security base. It has no owner/spouse distinction; two spouses' businesses likewise cannot have separate SE computations.

**Rule:** SE computation belongs to the individual; joint filing does not merge spouses' Social Security bases. Each self-employed spouse files a separate Schedule SE. [Schedule SE instructions, Joint Returns](https://www.irs.gov/instructions/i1040sse).

**Failing scenario test:** [F2](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:39). Spouse A has $100,000 profit and no wages; spouse B alone has $176,100 wages. Correct A earnings are $92,350: Social Security $11,451.40 plus Medicare $2,678.15 gives **$14,129.55 SE tax**. Entering the joint-return wages produces **$2,678.15**, omitting $11,451.40 of SE tax. The total-tax delta is different because the deductible half also changes.

This is an input-domain defect: identical numeric inputs could correctly produce the engine's amount if A owned the W-2. The engine neither distinguishes nor warns about that prerequisite. The general “one Schedule C” assumption does not explain this joint-return consequence.

### F3 — P2: W-2 Social Security tips are missing from wage-base coordination

**Location:** [engine.ts:38](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:38) specifies box 3 only; [scheduleSE.ts:137](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/scheduleSE.ts:137) has no separate tip amount.

**Rule:** Schedule SE line 8a includes W-2 **boxes 3 and 7**, not box 3 alone. [2025 Schedule SE, line 8a](https://www.irs.gov/pub/irs-pdf/f1040sse.pdf).

**Failing scenario test:** [F3](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:50). W-2 box 3 $160,000, box 7 $16,100, boxes 1/5 $176,100; gig profit $20,000. The Social Security base is exhausted. Correct SE tax is Medicare alone, **$535.63**; actual **$2,532.03**, $1,996.40 excess SE tax. Box 7 is an unrepresentable fact in this API. Supplying boxes 3+7 in a field explicitly documented as box 3 would require callers to violate its stated contract. This omission is not covered by the disclaimer's exclusion of the new tips deduction; these are different rules.

### F4 — P2: Additional Medicare liability is charged, but its withholding cannot be credited

**Location:** [engine.ts:35](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:35), [engine.ts:255](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:255), [engine.ts:265](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:265). The W-2 interface includes box 2 withholding, but not box 6. The engine computes Additional Medicare tax without the withholding reconciliation.

**Rule:** Form 8959 Part V reconciles box 6 against regular Medicare tax; Additional Medicare withholding is credited on Form 1040 line 25c. [Form 8959, lines 19–24](https://www.irs.gov/pub/irs-pdf/f8959.pdf).

**Failing scenario test:** [F4](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:60). Single filer, one employer, $250,000 wages, box 2 $25,000, box 6 $4,075. Additional withholding is `$4,075 − $250,000 × 1.45% = $450`. Correct payments **$25,450**; actual **$25,000**. Balance due is overstated by $450. The interface cannot encode box 6, and the omission list implies supplied withholding is supported without explaining this exception.

### F5 — P2: MFS standard-deduction ineligibility is unrepresented and insufficiently explained

**Location:** [standardDeduction.ts:63](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/standardDeduction.ts:63), [disclaimer.ts:25](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:25). Every nondependent MFS taxpayer receives the regular deduction. There is no spouse-itemizes input.

**Rule:** an MFS taxpayer cannot take the standard deduction when their spouse itemizes. [Pub. 501, MFS Special Rules, item 11](https://www.irs.gov/publications/p501).

**Failing scenario test:** [F5](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:70). 2025 MFS, $50,000 wages, no business, spouse itemizes, own itemized deductions zero. Expected standard deduction **$0**; actual **$15,750**. Using the engine's disclosed rate-formula convention, income tax is $3,871.50 instead of $5,914: **$2,042.50 understated**.

The statement that the standard deduction is always used partially discloses the behavior. It does not explain that some supported MFS users are legally ineligible. This is a domain/eligibility limitation, not a claim that the MFS dollar table is incorrect.

### F6 — P2: kiddie-tax warnings miss eligible taxpayers and income

**Location:** [engine.ts:270](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:270), [disclaimer.ts:32](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:32). The warning requires `claimedAsDependent` and scholarships alone exceeding the threshold. The README/disclaimer promise a warning when kiddie tax may apply.

**Rule:** Form 8615 eligibility does not require dependency, and unearned income includes more than scholarships. Age, support, a living parent, and filing conditions matter; the missing ages justify a conditional warning, not the present false-negative dependency gate. [Form 8615 instructions, Who Must File and Unearned Income](https://www.irs.gov/instructions/i8615).

**Failing tests:** [F6a](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:80) uses a nondependent full-time 20-year-old, living parent, little current earned income, self-support from savings, and $20,000 taxable scholarship. [F6b](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:91) uses a dependent 17-year-old with a living parent and $5,000 non-service prize income. Both satisfy the relevant scenario conditions; both return **no `kiddie_tax_may_apply` warning**. This finding is about the promised warning and inaccurate dependency limitation, not a demand to implement the expressly excluded kiddie tax calculation.

### F7 — P2: combining businesses can change the home-office income cap

**Location:** [scheduleC.ts:175](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/scheduleC.ts:175), and the assertion that totals are the same in [engine.ts:159](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/engine.ts:159). The cap is applied after aggregating all activities.

**Rule:** home-office qualification and income limitation depend on the relevant business use. Unrelated business profit cannot be treated as income from that qualifying use. [Pub. 587, More Than One Trade or Business; Deduction Limit](https://www.irs.gov/publications/p587).

**Failing scenario test:** [F7](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:99). Consulting has $0 receipts/$5,000 supplies and is the only business qualifying for the office. Delivery has $20,000 profit and no qualified home office. Annual allowable regular office costs before the income cap are $3,000. Consulting cannot deduct them this year: correct combined net **$15,000**. Aggregated code deducts $3,000 and returns **$12,000**.

The lost per-business association is unrepresentable. The finding challenges the claim that aggregation preserves tax totals, not the valid rule that already-correct Schedule C net amounts can be summed for one individual's Schedule SE.

### F8 — P3: 2026 QBI minimum is improperly capped at pre-QBI taxable income

**Location:** [qbi.ts:126](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/qbi.ts:126), especially line 130; preserved by [qbi.test.ts:56](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/__tests__/qbi.test.ts:56).

**Rule:** for an eligible actively participating taxpayer, §199A(i) sets the deduction at the greater of the otherwise computed amount or $400. It does not add the code's cap at pre-QBI taxable income. [Pub. L. 119-21 §70105](https://www.govinfo.gov/content/pkg/PLAW-119publ21/pdf/PLAW-119publ21.pdf). The greater-of structure is also present in [draft 2026 Form 8995, lines 15–17](https://www.irs.gov/pub/irs-dft/f8995--dft.pdf); the draft is corroboration, not filing authority.

**Failing test:** [F8](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:112). Profit $1,500, deductible half-SE $105.97, active QBI $1,394.03, pre-QBI taxable income $100. Ordinary deduction $20; statutory minimum **$400**; actual **$100**. The existing test's expected $300 when taxable income is $300 enforces the same mistaken reading.

**No total-tax change from this cap alone:** final taxable income is zero either way. Severity is low because the defect is the deduction/form amount. The reproducer expressly assumes material participation.

### F9 — P2: the exhaustive omission-list claim is false, especially for prior-year amounts

**Location:** [README.md:130](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/README.md:130), [disclaimer.ts:23](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/disclaimer.ts:23), [qbi.ts:138](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/qbi.ts:138). A current-year loss generates a QBI carryforward warning, but a subsequent profitable year's estimate has neither a prior-loss input nor an evergreen disclosure that it is ignoring prior QBI losses. Form 8995 requires the previous-year QBI loss carryforward in the calculation. [Form 8995, line 3](https://www.irs.gov/pub/irs-pdf/f8995.pdf).

**Failing disclosure test:** [F9](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:122) checks the allegedly exhaustive `NOT_MODELED` list for this omission. It is absent. The loss warning/module comment is real disclosure for a current loss; it does not protect a later profitable estimate. This is a documentation/interface gap, not a fabricated numeric fixture containing an unsupported carryforward property.

The same list omits prior home-office carryovers, although [homeOffice.ts:56](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/homeOffice.ts:56) admits they are not tracked; prior allowed carryovers affect Form 8829. [Form 8829 instructions](https://www.irs.gov/instructions/i8829).

It also omits the **2026 deduction for qualifying cash charitable contributions by nonitemizers**, up to $1,000/$2,000 joint. Saying itemized deductions are excluded does not cover this standard-deduction benefit. [IRS Topic 506](https://www.irs.gov/taxtopics/tc506). This P2 scope/disclosure issue is documented in more detail in the parameter annex. No current-interface numerical test can honestly supply a charitable-contribution input that does not exist.

### F10 — P2: expense refunds can leave deductions for costs that were fully recovered

**Location:** [categories.ts:97](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/categories.ts:97), [prismaRows.ts:204](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/adapters/prismaRows.ts:204). The adapter excludes a refund without reducing an earlier deducted expense. The category's citation note acknowledges this omission, but there is no returned warning or `NOT_MODELED` entry.

**Rule:** a recovery in the same year reduces that year's deduction. [Pub. 525, Recovery and expense in same year](https://www.irs.gov/publications/p525).

**Failing scenario test:** [F10](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:129). $10,000 receipts, $1,000 supplies purchase, then a $1,000 refund of that exact purchase. Correct net **$10,000**; actual **$9,000**. Corresponding SE tax is $1,412.96 versus $1,271.66. Both adapter and engine warnings are empty.

The purchase/refund association exists in the scenario but not in the API. An unrelated personal refund could produce identical encoded rows and correctly leave the $1,000 business deduction. Thus automatic matching cannot be assumed; this is an unsupported business-recovery case with a silent downstream consequence, not a claim that every refund should be taxed as business income.

### F11 — P2: scholarship allocation assumes away binding award restrictions

**Location:** [scholarships.ts:90](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/scholarships.ts:90), its returned assumption at line 117, and [README.md:88](C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE/src/lib/tax/README.md:88). The input cannot represent a grant earmarked for living costs. The source commentary presents tuition-first allocation as permitted without this condition.

**Rule:** scholarship funds restricted to nonqualified expenses such as room/board cannot be made tax-free by allocating them to separately paid tuition. [Pub. 970, Tax-Free Scholarships and Fellowship Grants](https://www.irs.gov/publications/p970).

**Failing scenario test:** [F11](C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs:149). Box 1 $20,000 tuition paid separately; box 5 $10,000 grant restricted exclusively to housing. Correct taxable scholarship **$10,000**; actual **$0**. This scenario is outside the output's stated tuition-allocation assumption. The finding is that the restriction is unsupported and the permissibility of allocation is overbroadly described, not that subtraction is wrong for an unrestricted qualifying grant.

## 5. Disclaimer coverage and practical limits

The disclaimer does clearly identify planning-only output, federal-only scope, omitted credits, itemized deductions, investment income, major loss limits, health-insurance/retirement deductions, age/blindness and several new deductions, AMT/NIIT, and payment penalties. The README also discloses cents rounding and using rate formulas instead of the under-$100,000 Tax Table. Those exclusions were not relabeled as undisclosed bugs.

The weaknesses are specific: the missing/inadequately described cases in F2–F7 and F9–F11; a false claim that every omitted rule is in `NOT_MODELED`; and a kiddie-tax warning promise that is not fulfilled. A broad statement that actual tax may vary does not make the narrower audit claims accurate. Scholarship degree/service assumptions are returned, and MFS's always-standard-deduction behavior is partly disclosed; the qualifications above preserve that distinction.

The receipt of disclaimer text in an output object does not guarantee a UI renders it. The README makes rendering a future caller requirement. UI compliance is outside the requested directory scope and was not assessed.

## Reproduction and verification record

Run from `C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE`:

```powershell
npm test
node C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/counterexamples.cjs
node C:/Users/joelb/.codex/audits/federal-tax-2026-09-09/bracket-boundaries.cjs
```

Observed: existing Vitest suite **112 passed / 13 files**; audit counterexamples **12 failed / 5 controls passed** (exit 1 is expected); independent bracket checks **270 passed**. The audit scripts load the unchanged TypeScript with an in-memory compiler hook; they do not write compiled files or add tests to the repository. All expected numeric amounts come from the cited rules and explicit arithmetic or independently checked printed tables. No source code fixes were applied.
