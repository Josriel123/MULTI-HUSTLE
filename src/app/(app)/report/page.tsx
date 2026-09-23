'use client';

import { useCallback, type ReactNode } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { errorText, fetchPayments, fetchSummary, fetchTransactions, fetchW2s, type SummaryResponse, type TransactionItem } from '@/components/api';
import { cn } from '@/components/cn';
import { categoryLabel, filingStatusLabel, formatCurrency, formatDate, formatLineValue, formatMiles } from '@/components/format';
import { useLoad } from '@/components/useLoad';
import { defaultTaxYear, useTaxYear } from '@/components/useTaxYear';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * The tax report: everything behind the estimate on one printable page, for
 * your own records or a tax preparer. Figures are the engine's, read from
 * the summary; the lists (W-2s, payments, transactions) are the rows as
 * stored. Provenance is counted, never asserted (D19).
 */
export default function ReportPage() {
  const [taxYear] = useTaxYear();
  const key = String(taxYear ?? 'default');
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const loadTransactions = useCallback(() => fetchTransactions(taxYear), [taxYear]);
  const loadW2s = useCallback(() => fetchW2s(taxYear), [taxYear]);
  const loadPayments = useCallback(() => fetchPayments(taxYear), [taxYear]);
  const summary = useLoad(key, loadSummary);
  const transactions = useLoad(key, loadTransactions);
  const w2s = useLoad(key, loadW2s);
  const payments = useLoad(key, loadPayments);

  const data = summary.data;
  const rows = transactions.data ?? [];
  const year = data?.taxYear ?? taxYear ?? defaultTaxYear();
  const error = summary.error ?? transactions.error ?? w2s.error ?? payments.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title="Tax report"
          description="Everything behind your estimate on one page. Print it or save it as a PDF for your records or your tax preparer, or download the transactions as a spreadsheet."
          icon={<FileText size={22} />}
          iconTone="accent"
          actions={
            <>
              <Button variant="secondary" icon={<Download size={16} aria-hidden />} disabled={rows.length === 0} onClick={() => downloadCsv(rows, year)}>
                {rows.length === 0 ? 'No transactions to download' : 'Download spreadsheet'}
              </Button>
              <Button variant="primary" icon={<Printer size={16} aria-hidden />} onClick={() => window.print()} disabled={!data}>
                Print or save as PDF
              </Button>
            </>
          }
        />
      </div>

      {error !== null && (
        <div className="print:hidden">
          <InlineStatus kind="error">{errorText(error, 'Could not load everything for the report.')}</InlineStatus>
        </div>
      )}

      {data ? (
        <Busy busy={summary.loading}>
          <article aria-label={`Tax report for ${year}`} className="rounded-card border border-border bg-card p-5 shadow-card md:p-10 print:border-0 print:p-0 print:shadow-none">
            <ReportHeader data={data} rows={rows} />
            <Summary data={data} />
            <div className="mt-8">
              <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} rules={data.rules} className="shadow-none" />
            </div>
            <ScheduleC data={data} />
            <Wages data={data} forms={w2s.data?.forms ?? []} />
            <Education data={data} />
            <Payments data={data} payments={payments.data?.payments ?? []} />
            <LineByLine data={data} />
            <Signatures />
          </article>
        </Busy>
      ) : (
        !error && <p className="text-sm text-fg-muted">Preparing your report…</p>
      )}
    </div>
  );
}

function ReportHeader({ data, rows }: { data: SummaryResponse; rows: readonly TransactionItem[] }) {
  // Provenance, stated rather than asserted: this page is handed to a tax
  // preparer, and it once claimed "Plaid-verified ledger integrity" for
  // accounts that had never linked a bank.
  const imported = rows.filter((t) => t.plaidTransactionId !== null).length;
  const manual = rows.length - imported;
  const provenance =
    rows.length === 0
      ? 'No transactions recorded'
      : imported === 0
        ? `${manual} ${manual === 1 ? 'transaction' : 'transactions'}, all entered by hand`
        : manual === 0
          ? `${imported} ${imported === 1 ? 'transaction' : 'transactions'}, all brought in from a linked bank`
          : `${imported} brought in from a linked bank, ${manual} entered by hand`;
  return (
    <header className="flex flex-col gap-4 border-b-2 border-fg pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-fg-muted">Multi-Hustle · Federal estimate</p>
        {/* h2: the page's h1 is the PageHeader above (hidden only on paper). */}
        <h2 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Tax report {data.taxYear}</h2>
        <p className="mt-1 text-fg-muted">
          Filing as {filingStatusLabel(data.filingStatus).toLowerCase()}
          {data.filingStatusSource === 'default' && ' (assumed: no tax profile saved)'}
        </p>
      </div>
      <dl className="grid gap-0.5 text-sm text-fg-muted sm:text-right">
        <div>
          <dt className="sr-only">Prepared</dt>
          <dd>Prepared {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</dd>
        </div>
        <div>
          <dt className="sr-only">Source of transactions</dt>
          <dd>{provenance}</dd>
        </div>
      </dl>
    </header>
  );
}

function Summary({ data }: { data: SummaryResponse }) {
  const refund = data.summary.refund > 0;
  const cells = [
    { label: 'Total income', hint: 'Form 1040 line 9', value: data.summary.gross },
    { label: 'Total federal tax', hint: 'Form 1040 line 24', value: data.summary.taxLiability },
    { label: 'Paid so far', hint: 'Form 1040 line 33', value: data.summary.paid },
    refund
      ? { label: 'Expected refund', hint: 'Form 1040 line 34', value: data.summary.refund }
      : { label: 'Left to pay', hint: 'Form 1040 line 37', value: data.summary.leftToPay },
  ];
  return (
    <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4" data-print-avoid-break>
      {cells.map((c) => (
        <div key={c.label} className="bg-card p-4">
          <p className="text-xs font-medium text-fg-muted">{c.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums md:text-2xl">{formatCurrency(c.value)}</p>
          <p className="mt-0.5 text-xs text-fg-faint">{c.hint}</p>
        </div>
      ))}
    </section>
  );
}

function Section({ n, title, description, children }: { n: number; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10 print:mt-8" aria-labelledby={`report-${n}`}>
      <h2 id={`report-${n}`} className="flex items-baseline gap-2 border-b border-border pb-2 text-lg font-semibold print:break-after-avoid">
        <span className="text-fg-faint">{n}.</span> {title}
      </h2>
      {description && <p className="mt-2 text-sm text-fg-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full min-w-[32rem] text-left text-sm', className)}>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-[0.06em] text-fg-faint">
            {head.map((h, i) => (
              <th key={i} scope="col" className={cn('py-2 pr-3 font-semibold', i > 0 && i === head.length - 1 && 'text-right', i > 1 && i < head.length - 1 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

const td = 'py-2 pr-3 align-top';
const num = 'py-2 pr-3 text-right tabular-nums align-top';

/** Schedule C's own order: 8, 9, 10 ... 24a, 24b, 25, 27a. */
const byFormLine = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b);

function ScheduleC({ data }: { data: SummaryResponse }) {
  const c = data.estimate.scheduleC;
  const car = c.expenseLines.find((l) => l.category === 'car_and_truck');
  const hasCar = c.mileage.methodApplied !== 'none' || Boolean(car);
  const lines = c.expenseLines
    .filter((l): l is typeof l & { scheduleCLine: string } => l.scheduleCLine !== null && l.category !== 'car_and_truck')
    .sort((a, b) => byFormLine(a.scheduleCLine, b.scheduleCLine));
  const beforeCar = lines.filter((l) => byFormLine(l.scheduleCLine, '9') < 0);
  const afterCar = lines.filter((l) => byFormLine(l.scheduleCLine, '9') >= 0);
  const expenseRow = (l: (typeof lines)[number]) => (
    <tr key={l.category}>
      <td className={td}>{l.scheduleCLine}</td>
      <td className={td}>{categoryLabel(l.category)}</td>
      <td className={num}>{formatCurrency(l.entered, { cents: true })}</td>
      <td className={num}>{formatCurrency(l.deductible, { cents: true })}</td>
    </tr>
  );
  return (
    <Section
      n={1}
      title="Business income and costs (Schedule C)"
      description="All hustles combined on one Schedule C. Entered is what you recorded; deducted is what the estimate allows after limits."
    >
      <Table head={['Line', 'Item', 'Entered', 'Deducted']}>
        <tr>
          <td className={td}>1</td>
          <td className={td}>Gross receipts</td>
          <td className={num} />
          <td className={cn(num, 'font-semibold')}>{formatCurrency(c.grossReceipts, { cents: true })}</td>
        </tr>
        {beforeCar.map(expenseRow)}
        {hasCar && (
          <tr>
            <td className={td}>9</td>
            <td className={td}>
              Car and truck
              <span className="block text-xs text-fg-faint">
                {c.mileage.methodApplied === 'standard_mileage'
                  ? `Standard mileage rate on ${formatMiles(c.mileage.totalMiles)}`
                  : c.mileage.methodApplied === 'actual_expenses'
                    ? 'Actual costs (larger than the standard rate on logged miles)'
                    : 'Nothing deducted'}
              </span>
            </td>
            <td className={num}>{car ? formatCurrency(car.entered, { cents: true }) : ''}</td>
            <td className={num}>{formatCurrency(c.mileage.line9, { cents: true })}</td>
          </tr>
        )}
        {afterCar.map(expenseRow)}
        <tr className="font-semibold">
          <td className={td}>28</td>
          <td className={td}>Total expenses</td>
          <td className={num} />
          <td className={num}>{formatCurrency(c.totalExpenses, { cents: true })}</td>
        </tr>
        <tr>
          <td className={td}>29</td>
          <td className={td}>Tentative profit</td>
          <td className={num} />
          <td className={num}>{formatCurrency(c.tentativeProfit, { cents: true })}</td>
        </tr>
        <tr>
          <td className={td}>30</td>
          <td className={td}>Home office</td>
          <td className={num} />
          <td className={num}>{formatCurrency(c.homeOfficeDeduction, { cents: true })}</td>
        </tr>
        <tr className="font-bold">
          <td className={td}>31</td>
          <td className={td}>Net profit or (loss)</td>
          <td className={num} />
          <td className={num}>{formatCurrency(c.netProfit, { cents: true })}</td>
        </tr>
      </Table>
      {data.incomeBySource.length > 0 && (
        <div className="mt-5" data-print-avoid-break>
          <h3 className="text-sm font-semibold">Income by hustle</h3>
          <ul className="mt-2 grid gap-x-8 text-sm sm:grid-cols-2">
            {data.incomeBySource.map((h) => (
              <li key={`${h.type}:${h.name}`} className="flex justify-between gap-3 border-b border-border py-1.5">
                <span>{h.name ?? 'No hustle chosen'}</span>
                <span className="tabular-nums">{formatCurrency(h.income, { cents: true })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function Wages({ data, forms }: { data: SummaryResponse; forms: { id: string; employer: string; wages: string; federalWithheld: string; socialSecurityWages: string; medicareWages: string; ownedByTaxpayer: boolean }[] }) {
  if (forms.length === 0) {
    return (
      <Section n={2} title="Wages (W-2)">
        <p className="text-sm text-fg-muted">No W-2s entered for {data.taxYear}.</p>
      </Section>
    );
  }
  const joint = data.filingStatus === 'married_filing_jointly';
  return (
    <Section n={2} title="Wages (W-2)">
      <Table head={['Employer', 'Whose', 'Box 1 wages', 'Box 3', 'Box 5', 'Box 2 withheld']}>
        {forms.map((f) => (
          <tr key={f.id}>
            <td className={td}>{f.employer}</td>
            <td className={td}>{f.ownedByTaxpayer ? 'Mine' : joint ? "Spouse's" : "Spouse's (left out: not a joint return)"}</td>
            <td className={num}>{formatCurrency(f.wages, { cents: true })}</td>
            <td className={num}>{formatCurrency(f.socialSecurityWages, { cents: true })}</td>
            <td className={num}>{formatCurrency(f.medicareWages, { cents: true })}</td>
            <td className={num}>{formatCurrency(f.federalWithheld, { cents: true })}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-sm text-fg-muted">
        On the return: wages {formatCurrency(data.estimate.income.wages, { cents: true })} (Form 1040 line 1a); federal tax withheld{' '}
        {formatCurrency(data.estimate.payments.withholding, { cents: true })} (line 25a).
      </p>
    </Section>
  );
}

function Education({ data }: { data: SummaryResponse }) {
  const s = data.estimate.scholarships;
  const l = data.estimate.adjustments.studentLoanInterest;
  return (
    <Section n={3} title="Education">
      {!s && !l ? (
        <p className="text-sm text-fg-muted">No Form 1098-T or 1098-E entered for {data.taxYear}.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {s && (
            <dl className="text-sm" data-print-avoid-break>
              <p className="mb-1 font-semibold">Scholarships (Form 1098-T)</p>
              <Pair k="Scholarships or grants (box 5)" v={s.totalScholarships} />
              <Pair k="Tuition (box 1)" v={s.qualifiedTuitionFromBox1} />
              <Pair k="Required books and supplies" v={s.requiredCourseMaterials} />
              <Pair k="Reserved for room and board" v={s.restrictedToNonQualifiedExpenses} />
              <Pair k="Taxable scholarship (Schedule 1 line 8r)" v={s.taxable} strong />
            </dl>
          )}
          {l && (
            <dl className="text-sm" data-print-avoid-break>
              <p className="mb-1 font-semibold">Student loan interest (Form 1098-E)</p>
              <Pair k="Interest paid (box 1)" v={l.interestPaid} />
              <Pair k="After the yearly limit" v={l.tentative} />
              <Pair k="Income phase-out reduction" v={l.reduction} />
              <Pair k="Deduction (Schedule 1 line 21)" v={l.deduction} strong />
            </dl>
          )}
        </div>
      )}
    </Section>
  );
}

function Pair({ k, v, strong = false }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3 border-b border-border py-1.5', strong && 'font-semibold')}>
      <dt>{k}</dt>
      <dd className="tabular-nums">{formatCurrency(v, { cents: true })}</dd>
    </div>
  );
}

function Payments({ data, payments }: { data: SummaryResponse; payments: { id: string; paidOn: string; amount: string; note: string | null }[] }) {
  const p = data.estimate.payments;
  return (
    <Section n={4} title="Payments">
      {payments.length > 0 ? (
        <Table head={['Date paid', 'Note', 'Amount']}>
          {payments.map((row) => (
            <tr key={row.id}>
              <td className={td}>{formatDate(row.paidOn)}</td>
              <td className={td}>{row.note ?? ''}</td>
              <td className={num}>{formatCurrency(row.amount, { cents: true })}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <p className="text-sm text-fg-muted">No estimated tax payments recorded for {data.taxYear}.</p>
      )}
      <dl className="mt-3 max-w-md text-sm">
        <Pair k="Federal tax withheld (line 25a)" v={p.withholding} />
        {p.additionalMedicareWithheld > 0 && <Pair k="Additional Medicare Tax withheld (line 25c)" v={p.additionalMedicareWithheld} />}
        <Pair k="Estimated payments (line 26)" v={p.estimatedPayments} />
        <Pair k="Total payments (line 33)" v={p.total} strong />
      </dl>
    </Section>
  );
}

function LineByLine({ data }: { data: SummaryResponse }) {
  const office = data.estimate.scheduleC.homeOffice?.lines ?? [];
  return (
    <Section n={5} title="Line by line, for your tax preparer" description="Every step of the estimate, with the form line it corresponds to.">
      <Table head={['Form line', 'Description', 'Amount']}>
        {[...data.estimate.lines, ...office].map((line, i) => (
          <tr key={`${line.ref}-${i}`}>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{line.ref}</td>
            <td className={td}>{line.label}</td>
            <td className={num}>{formatLineValue(line.value, line.unit)}</td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

function Signatures() {
  return (
    <div className="mt-12 grid gap-10 border-t-2 border-fg pt-8 sm:grid-cols-2" data-print-avoid-break>
      <div>
        <p className="text-sm font-semibold">Taxpayer</p>
        <div className="mt-8 border-b border-fg-muted" />
        <p className="mt-1.5 text-xs text-fg-faint">I confirm the transactions and forms above are complete and accurate.</p>
      </div>
      <div>
        <p className="text-sm font-semibold">Tax preparer review</p>
        <div className="mt-8 border-b border-fg-muted" />
        {/* An attestation the preparer signs, not a claim this app makes. */}
        <p className="mt-1.5 text-xs text-fg-faint">Reviewed against source documents.</p>
      </div>
    </div>
  );
}

/** The year's transactions as a spreadsheet. A Blob, not a data: URI, which cut the file short at the first "#". */
function downloadCsv(rows: readonly TransactionItem[], year: number) {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ['Date', 'Money in or out', 'Amount', 'Category', 'Deductible', 'Description', 'Hustle', 'Source'].join(','),
    ...rows.map((t) =>
      [
        t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
        t.type === 'Income' ? 'In' : 'Out',
        t.amount,
        cell(categoryLabel(t.category)),
        t.taxDeductible ? 'Yes' : 'No',
        cell(t.description ?? ''),
        cell(t.incomeSource?.name ?? ''),
        t.plaidTransactionId ? 'Bank' : 'Entered by hand',
      ].join(','),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `multi-hustle-transactions-${year}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
