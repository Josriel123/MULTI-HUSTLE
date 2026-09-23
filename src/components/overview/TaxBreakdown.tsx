import type { ReactNode } from 'react';
import type { SummaryResponse } from '../api';
import { cn } from '../cn';
import { formatCurrency, formatPercent } from '../format';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Term } from '../ui/Term';

function Row({ label, value, sign, total = false, hint }: { label: ReactNode; value: number; sign?: '−' | '+'; total?: boolean; hint?: ReactNode }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2', total && 'mt-1 border-t border-border pt-3')}>
      <div className="min-w-0">
        <span className={cn('text-sm', total ? 'font-semibold' : 'text-fg-muted')}>{label}</span>
        {hint && <span className="ml-1.5 text-xs text-fg-faint">{hint}</span>}
      </div>
      <span className={cn('shrink-0 tabular-nums', total ? 'font-bold' : 'text-sm font-medium')}>
        {sign && value !== 0 ? `${sign} ` : ''}
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/**
 * How the estimate gets from income to tax, one line per step, in the order
 * the return does it. Every value is a field of the engine's result; rows
 * that are zero and optional are left out, so a simple return reads simply.
 */
export function TaxBreakdown({ data }: { data: SummaryResponse }) {
  const e = data.estimate;
  const studentLoan = e.adjustments.studentLoanInterest?.deduction ?? 0;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>How your tax adds up</CardTitle>
          <CardDescription>From what you earned to what you owe, the way the federal return works it out.</CardDescription>
        </div>
      </CardHeader>

      <div className="grid gap-x-10 gap-y-2 lg:grid-cols-3">
        <section aria-label="Income">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-fg-faint">1 · Income</h3>
          <Row label={<Term k="businessProfit">Hustle profit</Term>} value={e.income.businessNetProfit} hint={e.income.businessNetProfit < 0 ? '(a loss)' : undefined} />
          {e.income.wages > 0 && <Row label="W-2 wages" value={e.income.wages} />}
          {e.income.taxableScholarships > 0 && <Row label="Taxable scholarships" value={e.income.taxableScholarships} />}
          {e.income.otherIncome > 0 && <Row label="Other income" value={e.income.otherIncome} />}
          <Row label="Total income" value={e.income.totalIncome} total />
        </section>

        <section aria-label="Deductions">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-fg-faint">2 · Minus deductions</h3>
          <Row label="Half of self-employment tax" value={e.adjustments.halfSelfEmploymentTax} sign="−" />
          {studentLoan > 0 && <Row label="Student loan interest" value={studentLoan} sign="−" />}
          <Row label={<Term k="standardDeduction">Standard deduction</Term>} value={e.standardDeduction.deduction} sign="−" />
          {e.qbi.deduction > 0 && <Row label={<Term k="qbi">Business income deduction</Term>} value={e.qbi.deduction} sign="−" />}
          <Row label={<Term k="taxableIncome">Taxable income</Term>} value={e.taxableIncome} total />
        </section>

        <section aria-label="Tax">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-fg-faint">3 · Tax</h3>
          <Row label={<Term k="incomeTax">Income tax</Term>} value={e.incomeTax.tax} />
          <Row label={<Term k="selfEmploymentTax">Self-employment tax</Term>} value={e.otherTaxes.selfEmploymentTax} />
          {e.otherTaxes.additionalMedicareTax > 0 && <Row label={<Term k="additionalMedicare">Additional Medicare</Term>} value={e.otherTaxes.additionalMedicareTax} />}
          <Row label="Total federal tax" value={e.totalTax} total />
          {e.effectiveRate !== null && (
            <p className="mt-2 text-xs text-fg-faint">
              <Term k="effectiveRate">Effective rate</Term>: {formatPercent(e.effectiveRate)} of total income
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}
