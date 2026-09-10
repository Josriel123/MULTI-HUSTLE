# Audit triage — decisions

Decisions on the 11 findings in [REPORT.md](REPORT.md). **This file is the scope
of the follow-up work.** The report is evidence; this is the plan. Do not
implement a finding that this file marks *document*, and do not skip one it
marks *fix*.

Independently confirmed before triage: F1 (`homeOffice.ts` simplified branch
never reads `monthsUsed`, while the regular branch does) and F8 (`qbi.ts:130`
caps the §199A(i) minimum at `tiBefore`, and the test title asserts the same
reading). The parameter tables were checked and are clean — 12 bracket tables,
270 boundary probes, no errors. Don't re-litigate the parameters.

## Scope principle

This project is portfolio-scoped, built to product standards where that is free
(see [PLAN.md](../../../PLAN.md)). For a missing tax rule there are two honest
answers:

1. **Implement it** — when it is a small, bounded addition to the input contract.
2. **Refuse or warn, and disclose it** — when representing the fact needed would
   require new schema, new UI, or per-entity modeling.

What is *not* acceptable is the current state for several findings: silently
returning a confident number that is wrong because the engine could not know
better. Every item below moves to one of the two honest answers.

Where a number could go either way, the estimate should err **high**. An
overstated liability is a planning inconvenience; an understated one is a
surprise bill.

## Fix — logic bugs, input model already sufficient

| ID | Fix |
|---|---|
| **F1** | Prorate the simplified method by `monthsUsed`: average monthly allowable area, i.e. `min(officeSqFt, 300) × monthsUsed / 12 × $5`. Pub. 587, part-year use. Delete or correct `homeOffice.test.ts:60`'s coverage gap. |
| **F6** | Widen the kiddie-tax warning. Drop the `claimedAsDependent` gate — Form 8615 does not require dependency — and trigger on total unearned income, not scholarships alone. The engine has no age input, so the warning must be explicitly conditional ("if you are under 24 and ..."). Do not implement the kiddie tax itself; it stays in `NOT_MODELED`. |
| **F8** | Remove the `min(minimumRule.amount, tiBefore)` cap at `qbi.ts:130`. §199A(i) is a greater-of, with no taxable-income cap. Fix `qbi.test.ts:56`, which asserts the incorrect reading. **See the dispute note below before changing this.** |

## Fix — small additions to the input contract

Each of these is roughly one optional field plus a branch. They are listed as
domain gaps in the report, but the report was describing the current interface,
not the cost of extending it.

| ID | Fix |
|---|---|
| **F3** | Add `W2Input.socialSecurityTips` (box 7). Schedule SE line 8a is boxes 3 **+** 7. Currently box 3 alone, which overstates SE tax by up to the full Social Security rate on the tip amount. |
| **F4** | Add `W2Input.medicareTaxWithheld` (box 6) and credit the Additional Medicare withholding: `max(0, box6 − medicareWages × 1.45%)` into payments, per Form 8959 Part V. The engine already charges the liability; not crediting the withholding overstates the balance due. |
| **F5** | Add `spouseItemizes?: boolean`. When `filingStatus === 'married_separate'` and it is true, the standard deduction is zero (Pub. 501, MFS special rules item 11). |
| **F11** | Add an optional "amount restricted to non-qualified expenses" to `ScholarshipInput`. That amount is taxable regardless of the tuition-first allocation. Pub. 970 — a housing-restricted grant cannot be made tax-free by allocating it against separately paid tuition. |

## Fix as a guard — do not build the full feature

| ID | Fix |
|---|---|
| **F2** | Add `W2Input.ownedByTaxpayer?: boolean`. When filing status is `married_joint` and it is not explicitly `true`, do **not** apply those wages against this taxpayer's Social Security base, and warn that a spouse's wages do not reduce it. For single/HoH/MFS there is no other filer, so the W-2 is the taxpayer's and current behaviour is right. **Do not implement per-spouse Schedule SE or dual-business support** — one self-employed individual remains the model. This turns a silent five-figure understatement into a conservative estimate plus a warning. |

## Document and warn — structural, out of scope

Representing these needs schema or per-entity modelling. Add a `NOT_MODELED`
entry **and** an engine warning when the situation is detectable.

| ID | Decision |
|---|---|
| **F7** | The home-office income cap is applied to aggregated business net, not per qualifying business. Correct per-business handling needs the office associated with one business — a schema change. Document the aggregation assumption, and warn when a home office is present alongside more than one income source. Also drop the README's claim that aggregation preserves tax totals; it does not. |
| **F10** | Expense refunds are excluded but do not reduce the earlier deduction. Linking a refund to its purchase needs a `Transaction` relation. Document it, and warn from the adapter when an excluded refund is seen. |

## Disclosure and traceability

| ID | Fix |
|---|---|
| **F9** | The `NOT_MODELED` list claims to be exhaustive and is not. Add: prior-year QBI loss carryforward (Form 8995 line 3), prior home-office carryovers (Form 8829), and the 2026 non-itemizer charitable deduction ($1,000 / $2,000 joint). Then either make the list genuinely exhaustive or stop claiming that it is — the second is easier to keep true. |
| P3 | `parameters/2025.ts` and `README.md:65` cite §3.01/3.02/3.15/3.27/3.30 of Rev. Proc. 2024-40. The correct sections are **§2.01/2.02/2.15/2.27/2.30**; section 3 is the effective date. Dollar values are correct — this is a citation error only. |
| P2 | `README.md:30` claims a mistranscribed bracket boundary fails the build. `parameters.test.ts:48` compares production brackets against another field in the same production table, so a consistently wrong pair passes. Either weaken the claim or add fixtures from an independent transcription. |

## The F8 dispute note

`qbi.ts` and `qbi.test.ts` encode the *same* reading of §199A(i) — that the
minimum deduction is capped at taxable income. Both were written together, so
the test cannot catch the misreading. The audit cites Pub. L. 119-21 §70105 and
draft Form 8995 lines 15–17 for a greater-of with no such cap.

If the engine author disagrees on re-reading, that is a genuine dispute between
two models about statutory text, and it does not get resolved by whoever writes
last. Escalate it — get a third read or a human. Do not let it be silently
resolved in favour of the existing code.

## Sequencing

1. Port the Category-fix counterexamples from
   [counterexamples.cjs](counterexamples.cjs) into real Vitest tests **first**,
   so they fail before any fix lands. A fix verified by a test written after it
   is much weaker evidence.
2. Apply the fixes.
3. `npm test` — the 112 existing tests plus the new ones must all pass.
4. Re-run `node docs/audits/federal-tax-2026-09-09/counterexamples.cjs`. The
   items marked *document* here will still fail; that is expected. Note which,
   and why, in the commit.

The seven counterexamples the report marks **DOMAIN GAP** state facts in
comments that the API cannot encode. Where this file says *implement*, the
input contract is being extended so the fact becomes encodable — port those as
real tests. Where it says *document*, do not port the test; the scenario stays
unsupported by design.
