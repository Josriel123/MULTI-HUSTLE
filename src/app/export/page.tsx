'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, FileText, Printer, TrendingUp } from 'lucide-react';
import { cn } from '@/components/cn';
import { EstimateNotice } from '@/components/EstimateNotice';
import { TaxYearSelect } from '@/components/TaxYearSelect';
import { useTaxYear } from '@/components/useTaxYear';
import {
  fetchSummary,
  fetchTransactions,
  type SummaryResponse,
  type TransactionItem,
} from '@/components/api';
import { categoryLabel, formatCurrency, formatMiles } from '@/components/format';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Card, CardHeader, CardTitle, DataRow } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

/**
 * CPA Data Exporter & Tax Organizer.
 *
 * Prepares an IRS-aligned summary organizer for accountant review and prints
 * cleanly to PDF with the specialized print stylesheet. Provides raw CSV ledger export.
 * Zero local tax arithmetic: all figures are read directly from the engine summary.
 */
export default function CPAExporter() {
  const [taxYear, setTaxYear] = useTaxYear();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [transactionData, setTransactionData] = useState<TransactionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = taxYear === undefined ? 'default' : String(taxYear);
  const loading = resolvedKey !== requestKey;

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchSummary(taxYear), fetchTransactions(taxYear)])
      .then(([summary, transactions]) => {
        if (ignore) return;
        setSummaryData(summary);
        setTransactionData(transactions);
        setError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        console.error('Failed to load export data', err);
        setError(err instanceof Error ? err.message : 'Failed to compile tax data.');
      })
      .finally(() => {
        if (!ignore) setResolvedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [taxYear, requestKey]);

  const shownYear = summaryData?.taxYear ?? taxYear ?? new Date().getFullYear();

  const handlePrint = () => {
    window.print();
  };

  const exportCSV = () => {
    if (!transactionData || transactionData.length === 0) {
      alert('No transactions found for export.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Date,Type,Amount,Category,Description,Is Tax Deductible,Source\n';

    transactionData.forEach((t) => {
      const date = t.date ? new Date(t.date).toISOString().slice(0, 10) : '';
      const type = t.type || '';
      const amount = t.amount || '0.00';
      const category = `"${categoryLabel(t.category).replace(/"/g, '""')}"`;
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
      const ded = t.taxDeductible ? 'YES' : 'NO';
      const source = `"${(t.incomeSource?.name || (t.plaidTransactionId ? 'Plaid Sync' : 'Manual')).replace(/"/g, '""')}"`;

      csvContent += `${date},${type},${amount},${category},${desc},${ded},${source}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tax_ledger_export_${shownYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const grossProp = summaryData?.summary.gross;
  const taxProp = summaryData?.summary.taxLiability;
  const netProp = summaryData?.summary.net;

  const freeIncome = summaryData?.sources.freelance.income;
  const freeDed = summaryData?.sources.freelance.deductions;
  const hoDed = summaryData?.sources.freelance.homeOfficeDeduction;

  const deliveryIncome = summaryData?.sources.delivery.income;
  const deliveryMiles = summaryData?.sources.delivery.mileage;
  const deliveryDeduction = summaryData?.sources.delivery.mileageDeduction;

  const otherIncome = summaryData?.sources.other.income;
  const otherDed = summaryData?.sources.other.deductions;
  const hasOther = (otherIncome !== undefined && otherIncome > 0) || (otherDed !== undefined && otherDed > 0);

  const scholarTax = summaryData?.sources.scholarships.taxable;
  const scholarText = summaryData?.sources.scholarships.textbookSavings;
  const scholarLoan = summaryData?.sources.scholarships.loanInterestDeduction;

  // Provenance, stated rather than asserted. This organizer is handed to a tax
  // preparer, and it previously claimed "Plaid-verified ledger integrity"
  // unconditionally — including on accounts that had never linked a bank and
  // held nothing but hand-typed rows. Count what is actually here instead.
  const rowCount = transactionData?.length ?? 0;
  const importedCount = transactionData?.filter((t) => t.plaidTransactionId !== null).length ?? 0;
  const manualCount = rowCount - importedCount;
  const provenanceLabel =
    rowCount === 0
      ? 'No transactions recorded'
      : importedCount === 0
        ? `${manualCount} ${manualCount === 1 ? 'entry' : 'entries'}, all entered manually`
        : manualCount === 0
          ? `${importedCount} ${importedCount === 1 ? 'entry' : 'entries'}, all imported from a linked bank`
          : `${importedCount} imported from a linked bank, ${manualCount} entered manually`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12 md:gap-8">
      {/* Exporter Controls (Hidden on Print) */}
      <div className="print-hide print:hidden">
        <PageHeader
          title="CPA Data Exporter"
          description="Generate universally accepted tax organizers and export raw ledger data."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <TaxYearSelect value={shownYear} onChange={setTaxYear} />
              <Button
                variant="secondary"
                onClick={exportCSV}
                icon={<FileText size={16} aria-hidden />}
              >
                Raw Ledger (.CSV)
              </Button>
              <Button
                variant="primary"
                onClick={handlePrint}
                icon={<Printer size={16} aria-hidden />}
              >
                Print Organizer (PDF)
              </Button>
            </div>
          }
        />
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger print-hide print:hidden">
          {error}
        </div>
      )}

      {/* ---------------- CPA DOCUMENT BODY ---------------- */}
      <Busy busy={loading} className="flex flex-col gap-6 md:gap-8">
        <div id="cpa-document" className="flex flex-col gap-6 md:gap-8">
          {/* Document Header */}
          <div className="flex flex-col justify-between gap-4 border-b-2 border-border pb-6 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">TAX ORGANIZER</h1>
              <p className="mt-1 text-base text-fg-muted md:text-lg">
                Tax Year {shownYear} Independent Contractor &amp; Higher Education Summary
              </p>
            </div>
            <div className="flex flex-col gap-1 text-sm text-fg-muted sm:text-right">
              <div className="flex items-center gap-2 sm:justify-end">
                <TrendingUp size={18} className="text-accent" aria-hidden />
                <span className="font-semibold text-fg">Multi-Hustle Tax Organizer</span>
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end">
                <CheckCircle2 size={15} className="text-info" aria-hidden />
                <span>{provenanceLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end text-fg-faint">
                <Calendar size={14} aria-hidden />
                <span>Generated {new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
              </div>
            </div>
          </div>

          {/* Key KPI Summary Row */}
          <section aria-label="Key tax figures" className="grid gap-4 sm:grid-cols-3 md:gap-6">
            <StatCard
              label="Total Gross Income"
              value={formatCurrency(grossProp)}
              caption="Form 1040 line 9 aggregate"
              accent="neutral"
            />
            <StatCard
              label="Estimated Federal Tax"
              value={formatCurrency(taxProp)}
              caption="Form 1040 line 24, before credits"
              accent="danger"
              tone="danger"
            />
            <StatCard
              label="Safe-To-Spend Net"
              value={formatCurrency(netProp)}
              caption="Cash deposits less expenses and tax"
              accent="accent"
              tone="accent"
            />
          </section>

          {/* Mandatory EstimateNotice */}
          <EstimateNotice
            disclaimer={summaryData?.disclaimer}
            warnings={summaryData?.warnings}
            assumptions={summaryData?.assumptions}
            notModeled={summaryData?.notModeled}
          />

          {/* Part I: Schedule C */}
          <Card padding="lg" className="break-inside-avoid">
            <CardHeader className="border-b border-border pb-3">
              <div>
                <CardTitle>Part I: Schedule C Profit or Loss Summary</CardTitle>
                <p className="text-sm text-fg-muted">Sole proprietorship business receipts and ordinary business deductions.</p>
              </div>
            </CardHeader>

            <div className={cn('grid gap-6 md:gap-8', hasOther ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
              {/* Freelance Column */}
              <div className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">Freelance &amp; Professional Services</h3>
                <DataRow label="Gross Receipts / Sales" hint="Schedule C line 1" value={formatCurrency(freeIncome)} />
                <DataRow
                  label="Deductible Operating Expenses"
                  hint="Schedule C Part II"
                  value={`-${formatCurrency(freeDed)}`}
                  tone="muted"
                />
                <DataRow
                  label="Home Office Deduction (Form 8829)"
                  hint="Schedule C line 30"
                  value={`-${formatCurrency(hoDed)}`}
                  tone="muted"
                />
              </div>

              {/* Delivery Column */}
              <div className="flex flex-col gap-3">
                <h3 className="text-base font-semibold">Delivery &amp; Logistics App Gigs</h3>
                <DataRow label="Gross Receipts / Sales" hint="Schedule C line 1" value={formatCurrency(deliveryIncome)} />
                <DataRow
                  label="Standard Mileage Deduction"
                  hint={`Schedule C line 9 (${formatMiles(deliveryMiles)} logged)`}
                  value={`-${formatCurrency(deliveryDeduction)}`}
                  tone="muted"
                />
              </div>

              {/* Other Business / Unassigned Column */}
              {hasOther && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">Other Business &amp; Unassigned Gigs</h3>
                  <DataRow label="Gross Receipts / Sales" hint="Schedule C line 1" value={formatCurrency(otherIncome)} />
                  <DataRow
                    label="Deductible Operating Expenses"
                    hint="Schedule C Part II"
                    value={`-${formatCurrency(otherDed)}`}
                    tone="muted"
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Part II: Education */}
          <Card padding="lg" className="break-inside-avoid">
            <CardHeader className="border-b border-border pb-3">
              <div>
                <CardTitle>Part II: Education Deductions &amp; Scholarships</CardTitle>
                <p className="text-sm text-fg-muted">Form 1098-T scholarship reconciliation and Form 1098-E student loan interest.</p>
              </div>
            </CardHeader>

            <div className="flex flex-col gap-3">
              <DataRow
                label="Taxable Scholarship Overflow (Form 1098-T)"
                hint="Reported on Schedule 1 line 8r; not subject to self-employment tax"
                value={formatCurrency(scholarTax)}
              />
              {scholarText !== undefined && scholarText > 0 && (
                <DataRow
                  label="Required Course Materials Offsetting Aid"
                  hint="IRC §117(b)(2) qualified education expenses"
                  value={`-${formatCurrency(scholarText)}`}
                  tone="muted"
                />
              )}
              <DataRow
                label="Student Loan Interest Deduction (Form 1098-E)"
                hint="Schedule 1 line 21 above-the-line adjustment (statutory max $2,500)"
                value={`-${formatCurrency(scholarLoan)}`}
                tone="accent"
              />
            </div>

            <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-fg-faint">
              Note for tax preparer: Direct deposit refunds originating from institutional bursar accounts are excluded from
              gross receipts to prevent recursive double-counting alongside Form 1098-T Box 5 scholarship reporting. Form 8829
              home office expenses are apportioned strictly against Schedule C business revenue.
            </p>
          </Card>

          {/* Document Signatures */}
          <div className="mt-4 flex flex-col justify-between gap-8 border-t-2 border-border pt-6 break-inside-avoid sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Taxpayer Signature:</span>
              <div className="h-8 w-64 border-b border-fg-muted" />
              <span className="text-xs text-fg-faint">I certify that the transactions above are accurate.</span>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <span className="text-sm font-semibold">Preparer / CPA Review:</span>
              <div className="h-8 w-64 border-b border-fg-muted" />
              {/* An attestation the preparer signs, not a claim this app makes. */}
              <span className="text-xs text-fg-faint">Reviewed against source documents.</span>
            </div>
          </div>
        </div>
      </Busy>
    </div>
  );
}
