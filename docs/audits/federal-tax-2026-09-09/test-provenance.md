# Federal tax engine test provenance audit

Audit date: 2026-09-09. Scope: all 112 cases in `src/lib/tax/__tests__/`, including parameterized cases. No repository files were changed. The start line of each `it` identifies the case below; file paths are relative to the repository `C:/Users/joelb/OneDrive/Documents/Projects/MULTI-HUSTLE`.

## What the evidence establishes

The suite is **not made of Vitest snapshots**. There are no `toMatchSnapshot`, `toMatchInlineSnapshot`, or snapshot files. Most tax amount expectations are literal strings with arithmetic in comments. The three complete end-to-end known-answer scenarios show their calculation chains in Form 1040 order. These are reviewable mathematical fixtures, not mere unexplained totals.

That does **not** establish how the literals were originally obtained. All tax implementation, tests, and README were added in the same visible commit, `cd0dcdf1682995e26fcddbb052c31786e8dd147a`. Its commit message and test comments claim hand-worked answers; the history contains no earlier oracle, completed IRS worksheet, downloaded fixture, independently reviewed calculation, or generation record. A number copied from program output can subsequently receive a correct arithmetic comment. Therefore the honest finding is **traceable calculation, historical independence unproven**. There is no evidence sufficient to label any literal tax fixture a proven implementation-output snapshot.

**No test identifies an actual IRS worked example by example number/name and imports that example's inputs and answer.** Named authorities are rules, form lines, revenue-procedure tables, or statutory constants from which the author constructed scenarios.

The strongest circular check is `parameters.test.ts:48`: the expected base and the bracket thresholds both come from the production parameter object. It checks their mutual consistency, not their agreement with IRS publications. A consistently wrong threshold/base pair passes. The test at `parameters.test.ts:69` also derives its expected amount from `computeIncomeTax`, but that is appropriately a status-mapping invariant, not a known-answer amount oracle. `engine.test.ts:175` similarly compares serialized output with the same computed amount and tests serialization only.

## Classification

- **H — Hand calculation with an identifiable tax-rule/form/table chain.** Literal expected values; arithmetic shown or directly reproducible. This is evidence of mathematical traceability, not proof of independent authorship. No H case below is an identified IRS worked example.
- **L — Literal lookup.** Expected source figures are repeated as literals. A named primary authority provides a verification target; merely repeating them in tests is not a second independently sourced oracle.
- **M — Model or elementary arithmetic fixture.** The test checks chosen application assumptions, simple zero/subtraction behavior, or basic arithmetic. Its expected number is not presented as an externally certified tax answer.
- **I — Internal consistency or metamorphic comparison.** Expected behavior comes partly or wholly from production objects or another call to the implementation.
- **S — Structural, formatting, validation, or warning test.** It has no independent liability amount oracle. Literal counts and strings do not change that classification.

The classification is intentionally separate from legal correctness. A source-named H or L fixture can faithfully enforce a mistaken reading of the source. The parameter and engine findings in the accompanying audit decide correctness; a citation in a test title is not verification.

## Complete case inventory

### `engine.test.ts` — 9 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 11 | Gig worker, 2025 single, $50,000 receipts, $5,000 expenses, 200 sq ft office | **H.** Comments derive Schedule C $44,000; SE $6,217.01 and half $3,108.51; AGI $40,891.49; QBI $5,028.30; taxable income $20,113.19; bracket tax $2,175.08; total $8,392.09. Named Schedule C/SE/1040 lines and QBI arithmetic make the chain reproducible; standard deduction and brackets are literal source figures. $0.1907 effective rate is $8,392.09/$44,000 rounded. No IRS published scenario identified. The inequality against the former $12,012 bug is only a regression guard. Citation labels, disclaimer text, counts, and deduplication are S assertions. |
| 66 | Single dependent student, gig income plus scholarship and loan interest | **H, under the scholarship assumptions.** Comments derive $7,500 taxable scholarship, $1,695.55 SE tax, $847.78 deduction, $18,652.22 AGI, $15,750 standard deduction, $580.44 QBI, and $1,927.73 total. Cites §221(c) for dependent disallowance and Schedule 1 line 8r. The expected total is an estimated bracket-formula total, not a filed IRS worksheet result; kiddie tax is only warned about. No IRS published example. |
| 113 | Gig income alongside W-2 income and withholding | **H.** Comments derive $2,825.91 SE, $78,587.04 AGI, $3,717.41 QBI, $59,119.63 taxable income, $7,920.32 income tax, and $4,746.23 balance. The source chain is Schedule SE, Form 8995, 2025 single rate table, and 1040 payment subtraction. The title's claim that wages shrink the SE base is not exercised: $60,000 wages + $18,470 SE earnings is below $176,100. |
| 137 | Business loss with no other income | **M/H.** Literal -$4,000 profit is $1,000-$5,000; zero SE, QBI, and taxable income follow floors and loss treatment. No worked authority or full loss limitation worksheet; assumptions explicitly omit loss limits. |
| 152 | No income, 2026 HOH | **M/S.** Expected zero tax, null effective rate, and warning. Does not validate HOH's deduction or brackets because zero passes for any status table. |
| 159 | Unsupported year and unknown filing status | **S.** Input validation only. |
| 164 | Same income taxed differently in 2024 and 2026 | **I.** Asserts `tax2024 > tax2026`, both produced by the engine. No expected monetary amount; many incorrect tables/orderings satisfy it. |
| 171 | `toPlain()` conversion | **I/S.** `plain.totalTax` is compared with `Number(e.totalTax.toFixed(2))`; this intentionally tests representation, not liability correctness. $50,000 line value is input passthrough. |
| 188 | Zero must not cause positive-amount warnings | **S.** Warning/citation presence regression only; despite the title it does not statically prohibit calling `isPositive()`. |

### `incomeTax.test.ts` — 9 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 12 | 2024 single, $50,000 taxable income | **H.** Rev. Proc. 2023-34 Table 3 explicitly named; arithmetic $1,160+$4,266+$627=$6,053 shown. The test itself distinguishes the $6,058 Tax Table value. This is a rate-schedule oracle, not a filed-return Tax Table oracle. |
| 24 | 2024 MFJ, $100,000 | **H.** Table 1: $10,852 + 22% × ($100,000-$94,300) = $12,106. Direct table formula is quoted and recomputable. |
| 29 | 2025 single, $20,113.19 | **H.** Table 3: $1,192.50 + 12% × ($20,113.19-$11,925) = $2,175.08. Same taxable-income/result pair as the end-to-end gig fixture, so this is overlapping evidence, not a second scenario or second source. |
| 34 | 2025 HOH at $64,850, one cent over, $10 over | **H.** Table 2 base $7,442 and 22% next rate give $7,442/$7,442/$7,444.20. One-cent-over tax rounds to the same cent and is consequently a weak marginal-rate discriminator; $10-over assertion is effective. |
| 42 | 2025 MFS vs single at $400,000 | **H.** Table 4 $101,077.25 + 37% of $24,200 = $110,031.25; Table 3 $57,231 + 35% of $149,475 = $109,547.25. Both formula bases and thresholds are shown. |
| 52 | 2026 single, $1 million | **H.** Rev. Proc. 2025-32 Table 3 explicitly named; $192,979.25 + 37% × $359,400 = $325,957.25. Seven-slice/open-ended assertions are structural. |
| 60 | Qualifying surviving spouse uses joint table | **H.** 2025 Table 1 formula $2,385+12%×$26,150=$5,523. Literal total makes this stronger than the implementation-to-implementation mapping test in `parameters.test.ts`. |
| 67 | Zero and negative taxable income | **M.** Literal zero for zero/negative inputs, including MFJ zero. Elementary boundary test, no external worked example. |
| 74 | Per-bracket slices add to total | **H/I.** Sums implementation-produced slices, but compares to literal $6,053 and literal widths $11,600/$35,550/$2,850 from the same 2024 Table 3 example at line 12. Not fully tautological; also not a separate external answer. |

### `scheduleSE.test.ts` — 10 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 9 | $50,000 profit in 2025 | **H.** Schedule SE lines 4a, 10–13 arithmetic: $46,175; $5,725.70; $1,339.08; $7,064.78; $3,532.39. Explicit line-by-line derivation. |
| 24 | Tax is not 15.3% of gross profit | **M.** Only rejects the known wrong $7,650; it does not establish any correct total. |
| 29 | $400 threshold after 92.35% step | **H/M.** §1402(b)(2), Schedule SE line 4c named. $433→$399.88 below threshold and $434→$400.80→$61.32 tax/$30.66 half are derived in comments. The below-threshold `netEarnings = 0` assertion is an output/model convention, not the actual multiplication result; the tax-zero assertion has the statutory chain. Does not hit the exact cent-rounding transition. |
| 46 | 2025 wage base cap | **H.** Schedule SE lines 7–10 named; $176,100×12.4%=$21,836.40, Medicare $5,356.30, total $27,192.70, half $13,596.35. |
| 60 | 2024 wage base | **H/L.** $168,600×12.4%=$20,906.40. The wage-base figure is named but this test does not name an independent second document; year-specific source chain is in parameter metadata. |
| 66 | W-2 Social Security wages reduce available base | **H.** Schedule SE lines 8a–9 named; $176,100-$100,000=$76,100, Social Security $9,436.40, total $14,792.70. This standalone test really reaches the wage cap. |
| 74 | Additional Medicare, single/joint/separate | **H/L.** Form 8959 Part II named. $250,000×.9235=$230,875; excess $30,875×.009=$277.88; joint tax $0 and MFS threshold $125,000 are hardcoded status checks. |
| 86 | Medicare wages consume Additional Medicare threshold | **H.** Form 8959 lines 10–11 named. $200,000-$150,000=$50,000; ($230,875-$50,000)×.009=$1,627.88. |
| 93 | Business loss | **M/H.** $0 SE tax and deductible half under the nonpositive/threshold rule; `netEarnings=0` is the module's normalized output. |
| 102 | Form lines and statutory citations | **S.** Asserts presence of a line and citation labels, not their accuracy or the tax amount. |

### `qbi.test.ts` — 7 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 10 | Profit less half-SE deduction and taxable-income limit | **H.** Comments reproduce $44,000-$3,108.51=$40,891.49, 20%=$8,178.30, limited to 20% of $25,141.49=$5,028.30. The test has no own named form, but this chain traces through module citations to Form 8995/§199A. Same figures as `engine.test.ts:11`, so it is not a second independent worked scenario. |
| 22 | Full 20% when taxable-income limit does not bind | **H.** ($50,000-$3,532.39)×20%=$9,293.52, under module's Form 8995/§199A rule. No official worked example identified. |
| 28 | Phase-in with no wages/property | **H.** §199A(b)(3)(B) named; 2025 $197,300 threshold/$50,000 range gives ratio .5 and $30,000 deduction; upper/exceeded range $0 and threshold ratio $0. This is a constructed no-wage/no-UBIA case, not a general high-income QBI oracle. |
| 43 | MFJ threshold/range | **H/L.** $394,600/$100,000 source parameters repeated; ($400,000-$394,600)/$100,000=.054, $60,000×.946=$56,760. Explicit arithmetic; no independent second source named here. |
| 50 | Negative QBI | **H/S.** §199A(c)(2) named for zero deduction/carryforward warning. No subsequent-year carryforward calculation is tested. |
| 56 | 2026 $400 minimum and $1,000 QBI floor | **H/L.** §199A(i) named; hardcoded $400 at $1,000 QBI, $200 below floor, $300 when taxable income is $300, $200 in 2025. These expectations encode the author's reading of the minimum, including the taxable-income cap; no completed IRS worksheet is provided. |
| 71 | 2026 MFS $201,775 vs single $201,750; $75,000 range | **L/M.** Repeats source thresholds and checks behavior at $201,760. Metadata gives Rev. Proc. 2025-32; no independent second source in this test. The positive single phase ratio is a directional assertion, not a numeric oracle. |

### `standardDeduction.test.ts` — 5 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 9 | Nondependent 2025 amounts for all five statuses | **L.** Pub. L. 119-21 named; literals $15,750 single/MFS, $31,500 MFJ/QSS, $23,625 HOH. Valid verification target, no evidence that lookup was independent of production transcriptions. |
| 18 | Dependent floor, add-on, cap | **H/L.** §63(c)(5) named; $3,000+$450=$3,450, no earnings/$900 earnings→$1,350, $20,000 earnings→$15,750 cap. Exercises both floor and cap at standalone function level. |
| 31 | 2024 dependent floor and regular single deduction | **L.** $1,300/$14,600 repeated literals; source is year metadata, not separately identified in this test. |
| 36 | 2026 single and HOH deductions | **L.** $16,100/$24,150 repeated literals; source is year metadata. |
| 41 | Dependent citation only when applicable | **S.** Citation routing, not deduction amount or source verification. |

### `studentLoanInterest.test.ts` — 6 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 10 | $2,500 cap | **H/L.** §221(b)(1) named; $3,000 paid→$2,500 and $800 paid→$800 at low MAGI. |
| 17 | 2025 single linear phaseout | **H.** Rev. Proc. 2024-40 §3.30 named for $85,000–$100,000; arithmetic derives midpoint deduction $1,250 and .2 phaseout on $1,000 giving $800. Also checks exact lower/upper endpoints and far above. Fractions .5/.2 terminate, so this test cannot distinguish IRS worksheet ratio rounding behavior from full-precision division. |
| 33 | 2024/2026 joint ranges | **H/L.** Midpoints $180,000 and $190,000 produce $1,250 under stated $165,000–$195,000/$175,000–$205,000 ranges. Range figures come from metadata; no separately named primary document in this case. |
| 40 | Qualifying surviving spouse uses all-other range | **H/L.** At $92,500 expected $1,250; statutory status interpretation plus 2025 midpoint. No exact source reference in the test title/comment, though module cites §221. |
| 45 | MFS and dependent disallowance | **H/S.** §221(e)(2) and §221(c) explicitly named, $0 deduction and appropriate disallowance reasons/warning. |
| 55 | Negative MAGI allows full deduction | **M/H.** Literal $900 retained; phaseout is inapplicable below threshold. No external worked example. |

### `homeOffice.test.ts` — 9 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 9 | Both methods and selection | **H.** Form 8829 and Rev. Proc. 2013-13 named; 150/1,000×($1,500+$200)×12=$3,060 regular, 150×$5=$750 simplified. Larger-allowable automatic selection is application policy. |
| 24 | Gross-income cap and carryover/lost deduction | **H/M.** §280A(c)(5) named; caps regular at $1,000 with $2,060 carryover; $500 case caps both and leaves $250 simplified unused. Preferring simplified on a tie is policy, not an externally verified liability result. |
| 43 | Zero/negative tentative profit | **H/M.** Zero deduction and $3,060 regular carryover under the modeled income limit. No external worksheet. |
| 52 | Simplified cap 300 sq ft/$1,500 | **H/L.** Literal statutory-method limits (Rev. Proc. 2013-13 via module); 400 input sq ft→300×$5=$1,500. |
| 60 | Partial year, six months | **H, limited to regular method.** ($1,500+$200)×6×15%=$1,530. Test title suggests office proration generally, but it only asserts regular annual expense/before-limit results. No simplified-method amount or partial-month eligibility tested. |
| 67 | Exact one-third ratio | **M.** 300/900×$250×12=$1,000. Precision fixture; no separate IRS source required to establish arithmetic. |
| 73 | Zero-size office | **M/S.** Zero deduction, method none, no warning. |
| 80 | Impossible inputs | **S.** Square feet, negative rent, and months validation. |
| 86 | Citation labels | **S.** Asserts §280A(c)(5)/Rev. Proc. labels exist; does not verify what the sources actually say. |

### `scheduleC.test.ts` — 6 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 7 | Category aggregation and treatment | **H/M.** Comments cite §274(n)(1) for 50% of $200 meals, invoke the $2,500 equipment rule, and §117 for materials. Hand addition gives deductible $1,000+$100+$2,200=$3,300, net $6,700. This enforces chosen de-minimis/equipment assumptions and explicitly unmodeled health insurance; it is not a completed Schedule C/4562 oracle. |
| 46 | Tentative profit into home-office limit | **H.** $50,000-$5,000=$45,000; 200×$5=$1,000 office; net $44,000, mapped to Schedule C lines 29–31. Same arithmetic as end-to-end gig fixture. |
| 58 | Negative profit passed through | **M/H.** $1,000-$5,000=-$4,000 plus loss warning. No loss limitation computation. |
| 64 | Ignore tagged home-office expense | **M/S.** $0 deductible follows application's source-of-truth convention; no IRS rule says a transaction with this application tag must be ignored. |
| 70 | Unknown categories and negative amounts | **S.** Validation only. |
| 76 | Ordered Schedule C line references | **S.** Strings in expected order, no amount oracle. |

### `scholarships.test.ts` — 5 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 7 | Box 5 less Box 1 and required materials | **H, conditional on model assumptions.** §117(b)/Pub. 970 chapter 1 named; $40,000-($30,000+$1,200)=$8,800. Box 1 qualification/allocation assumptions must be true before this arithmetic answers the tax question. It is not an IRS 1098-T worked example. |
| 16 | Expenses meet or exceed scholarship | **M/H.** $0 under the same assumed subtraction/floor, at both excess-expense and exact-equality cases. |
| 23 | Missing materials defaults to zero | **M.** $9,000-$5,000=$4,000; tests an input default. |
| 27 | Negative boxes rejected | **S.** Validation only. |
| 31 | Assumptions and citation labels present | **S.** Minimum assumptions count and §117 labels; neither validates actual source content or adequacy of assumptions. |

### `mileage.test.ts` — 3 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 7 | 2024/2025 rates | **H/L.** Notice 2024-08 and Notice 2025-5 named; 1,000×$0.67=$670 and 1,000×$0.70=$700. Independent authenticity of notices/rates must come from source verification, not this repetition. |
| 12 | 2026 midyear rate change | **H/L.** Notice 2026-10 and Announcement 2026-11 named; 1,000 miles→$725 before July 1/$760 afterward. This test will affirm whatever accuracy the repeated date/rate transcription has; citation-label expectations are S checks. |
| 20 | Decimal miles and invalid inputs | **M/H/S.** 12.5×$0.70=$8.75 arithmetic plus date format/year and negative-mile validation. Does not test syntactically valid impossible calendar dates. |

### `parameters.test.ts` — 28 expanded cases

The parameterized templates below account for all three years (2024, 2025, 2026) and all four bracket tables (joint, head_of_household, single, married_filing_separately). No status/year expansion is omitted.

| Start line | Case/template | Expanded cases | Classification and provenance |
|---:|---|---:|---|
| 22 | Supported years in order | 1 | **S.** Supported-year API contract and input validation; no tax facts verified. |
| 35 | Seven ascending rates and open-ended row, per year | 3 | **L/I.** Rates `[.10,.12,.22,.24,.32,.35,.37]` are literal §1(j)(2) values; increasing boundaries/open-ended checks are structural comparisons of production data. No boundary accuracy oracle. |
| 48 | Printed base equals computed bracket arithmetic, per year/table | 12 | **I.** All 2024/2025/2026 × joint/HOH/single/MFS cases load `rows` from production parameters; `computeIncomeTax(lower, status, p)` is compared with the same row object's `taxAtLowerBoundAsPrinted`. Six cumulative bases per table are checked. Useful error-detection redundancy only if the two production transcriptions are independently correct; not an independent source. |
| 64 | QSS joint mapping and standard-deduction status equivalence, per year | 3 | **I.** Compares production deduction fields and two calls to production `computeIncomeTax`. Valid equivalence test; cannot establish either amount. MFS/single deduction equivalence is checked under model assumptions. |
| 72 | Source metadata exists, per year | 3 | **S.** Nonempty sources, regex labels, and `irs.gov` URL substring. Does not fetch links, match figures, verify section numbers, or establish authority's authenticity/currentness. |
| 82 | Mileage periods cover full year, per year | 3 | **I/S.** Production period starts/ends checked for complete nonoverlapping day coverage. Does not establish rates or whether a period change was authorized. |
| 95 | 2024 figures “checked against a second source” | 1 | **L.** Rev. Proc. 2023-34 and 2024 Schedule SE instructions named. Literals cover deductions, dependent floor, wage base, QBI thresholds/ranges/no minimum, loan ranges, first mileage rate. No per-literal second-source record; citation and literals are contemporaneous with production. No full 2024 bracket boundary array hardcoded here. |
| 107 | 2025 figures “checked against a second source” | 1 | **L.** Rev. Proc. 2024-40, Pub. L. 119-21, 2025 Schedule SE instructions, Form 8995 named. Literals cover standard/dependent deduction, wage base, QBI thresholds/ranges, loan ranges, kiddie amount, mileage, and single bracket boundaries. These have named verification targets, but are not shown to be independently collected. |
| 123 | 2026 figures “checked against a second source” | 1 | **L.** Rev. Proc. 2025-32, Tax Topic 751, and midyear mileage change named. Literals cover deductions, wage base, QBI thresholds/ranges/minimum, loan ranges, mileage periods, and HOH bracket boundaries. No independent acquisition evidence. |

Expansion count: 1 + 3 + 12 + 3 + 3 + 3 + 1 + 1 + 1 = **28**.

### `prismaRows.test.ts` — 5 cases

| Start line | Case | Classification and provenance |
|---:|---|---|
| 14 | Map rows using categories | **M.** Explicit row addition/subtraction yields $24,050 receipts, $2,580 cash expense total, and $21,550 Schedule C profit. Tests application classification, year filtering, and bookkeeping; no IRS worked-answer assertion for total liability. |
| 63 | Missing profile defaults | **S.** Single/not-dependent/default-source assumptions. |
| 71 | Invalid stored status defaults to single with warning | **S.** Application fallback policy. |
| 77 | Pass through 1098-T/1098-E/home-office rows | **S/M.** Input values $800/$1,500 preserved; monthly semantics assertion. No tax arithmetic. |
| 93 | Category from wrong side ignored | **S.** Application category-mismatch/fallback behavior. |

### `money.test.ts` — 10 cases

These are ordinary numeric utility tests, not IRS known-answer fixtures. Their literals can be checked with decimal arithmetic; historical origin is not important to validating the helper contracts.

| Start line | Case | Classification and provenance |
|---:|---|---|
| 8 | Exact cents vs binary floating point | **M.** 0.1+0.2=0.30 in decimal. |
| 14 | Input types | **M/S.** $1,234.5→$1,234.50 and Prisma $18,400 passthrough/type conversion. |
| 25 | Reject nonfinite/unparseable | **S.** Validation only. |
| 33 | Reject negatives | **M/S.** Zero accepted, negative rejected. |
| 40 | Cents half-up | **M.** Literal rounding examples, including 1,339.075→1,339.08. Tests engine's cents convention, not the IRS whole-dollar election. |
| 48 | Dollars half-up | **M.** 12.50→13; 12.49→12. |
| 53 | Clamp negative to zero | **M.** -5→0, +5→5. |
| 58 | Exact multiplication | **M.** 44,000×.9235=40,634; 46,175×.029=1,339.075→1,339.08. Tax-like operands do not make this a separate Schedule SE oracle. |
| 63 | Sum | **M.** .1+.2+.3=.60, empty sum=0. |
| 68 | Serialize only after rounding | **M/S.** 1,234.565→1,234.57 and 7→7.00. |

Total expanded cases: engine 9 + income tax 9 + Schedule SE 10 + QBI 7 + standard deduction 5 + student-loan interest 6 + home office 9 + Schedule C 6 + scholarships 5 + mileage 3 + parameters 28 + Prisma adapter 5 + money 10 = **112**.

## Material assurance gaps

1. **The “second source” claim is stronger than the evidence.** `parameters.test.ts:8–11,94` calls these independent figures, but the check at lines 48–62 reads both sides from production and the year-specific literals show no second-source acquisition evidence. The README's statement that a mistranscribed bracket boundary/base fails the build is conditional: a coordinated wrong boundary/base passes. Source metadata tests establish text presence only.
2. **No separately validated filed-return oracle.** No completed IRS worksheet/example is used. The three full numeric engine fixtures all use 2025 single. They test the documented exact-bracket estimate, not IRS Tax Table liability below $100,000; their comments correctly expose this in the standalone income-tax fixture.
3. **Order coverage has a major hole.** The only end-to-end student-loan-interest scenario is a dependent for whom the deduction is zero. Nothing proves positive loan interest reduces AGI and the QBI taxable-income limit correctly or that MAGI excludes the interest deduction itself. Standalone phaseout midpoints cannot verify engine ordering.
4. **The W-2 end-to-end title overclaims coverage.** At `engine.test.ts:113`, the worker remains below the Social Security base even with wages, so omitting W-2 wages from the SE call would still produce the expected SE tax. The standalone SE cap test covers the formula, but not this engine wiring under a binding cap. No W-2-only Additional Medicare case is present.
5. **Boundary tests favor easy values.** SE uses profits $433/$434, not the cent-level transition; student loan phaseout uses exactly terminating ratios .5/.2, not a recurring ratio; the home-office six-month test omits the simplified result; QBI checks threshold/endpoint but not positive cross-rule E2E interactions. The 12 production-base checks cover exact bracket boundaries but remain internally sourced.
6. **Non-single and year support is chiefly modular.** All statuses have some parameter/unit coverage, but no positive-tax MFJ/MFS/HOH/QSS end-to-end expected total exists. 2026 HOH end-to-end zero tells nothing about status parameters. The 2024/2026 engine comparison is only directional.
7. **Documentation adequacy is not tested.** Warning/citation length and regex checks cannot detect omitted limitations, a source saying something different, inaccurate form-line labels, or a disclaimer failing to describe a particular modeled assumption.

These are test-quality findings, not standalone assertions that an IRS rule has been violated. A missing test is not itself evidence of a wrong tax result. Confirmed numeric findings and failing reproductions belong in the main audit.

## Primary-source reading performed for this provenance subaudit

This subaudit independently opened IRS material to establish the SE and QBI calculation chains, while the accompanying parameter audit verifies year tables and the main engine audit verifies legal correctness. It did not treat the code's citation strings as authenticated source content.

- [2025 Schedule SE, actual form](https://www.irs.gov/pub/irs-prior/f1040sse--2025.pdf): identifies the 92.35% step and $400 test in sequence, and the 2025 wage base.
- [2025 Schedule SE instructions](https://www.irs.gov/instructions/i1040sse): confirms the $176,100 maximum and filing trigger; also identifies optional/special cases outside the elementary test scenarios.
- [2025 Form 8995 instructions](https://www.irs.gov/instructions/i8995): QBI includes business-attributable deductions such as the deductible part of SE tax; taxable-income limitation and use of Form 8995-A above thresholds are stated.
- [2025 Form 8995-A instructions](https://www.irs.gov/instructions/i8995a): distinguishes the phase-in and specified-service-business rules. A test title saying “phase-in” does not by itself cover all those rules.

The named revenue procedures, notices, statutes, and publications in the inventory identify the fixtures' claimed source chain; that inventory alone should not be read as attesting to every parameter or every source interpretation.
