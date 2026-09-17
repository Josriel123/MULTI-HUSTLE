'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Info, Save } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { TaxYearSelect } from '@/components/TaxYearSelect';
import { useTaxYear } from '@/components/useTaxYear';
import {
  fetchForm1098E,
  fetchForm1098T,
  fetchSummary,
  saveForm1098E,
  saveForm1098T,
  type SummaryResponse,
} from '@/components/api';
import { formatCurrency } from '@/components/format';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Card, CardDescription, CardHeader, CardTitle, DataRow } from '@/components/ui/Card';
import { Field, FieldGrid, Input } from '@/components/ui/Field';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Education Deductions & Scholarships (Forms 1098-T & 1098-E).
 *
 * All calculations are read directly from the federal tax estimate:
 * - Scholarships: IRC §117; Schedule 1 line 8r.
 * - Student Loan Interest: IRC §221; Schedule 1 line 21.
 * Zero local tax arithmetic is performed in this component.
 */
export default function StudentPage() {
  const [taxYear, setTaxYear] = useTaxYear();
  const [box1, setBox1] = useState('');
  const [box5, setBox5] = useState('');
  const [box1E, setBox1E] = useState('');

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [savingT, setSavingT] = useState(false);
  const [savingE, setSavingE] = useState(false);
  const [statusT, setStatusT] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [statusE, setStatusE] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Loading is derived: busy until responses for the requested year arrive.
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = taxYear === undefined ? 'default' : String(taxYear);
  const loading = resolvedKey !== requestKey;

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchForm1098T(taxYear), fetchForm1098E(taxYear), fetchSummary(taxYear)])
      .then(([tRes, eRes, summaryRes]) => {
        if (ignore) return;
        setBox1(tRes.form ? String(tRes.form.box1) : '');
        setBox5(tRes.form ? String(tRes.form.box5) : '');
        setBox1E(eRes.form ? String(eRes.form.box1) : '');
        setSummary(summaryRes);
        setStatusT(null);
        setStatusE(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        console.error('Failed to load student education tax data', err);
        setStatusT({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to load data.' });
      })
      .finally(() => {
        if (!ignore) setResolvedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [taxYear, requestKey]);

  const shownYear = summary?.taxYear ?? taxYear;

  async function handleSaveT(e: FormEvent) {
    e.preventDefault();
    if (shownYear === undefined) return;
    setSavingT(true);
    setStatusT(null);
    try {
      await saveForm1098T({
        taxYear: shownYear,
        box1,
        box5,
      });
      const refreshed = await fetchSummary(shownYear);
      setSummary(refreshed);
      setStatusT({ kind: 'ok', text: `Saved Form 1098-T for tax year ${shownYear}. The estimate has been updated.` });
    } catch (err: unknown) {
      setStatusT({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to save Form 1098-T.' });
    } finally {
      setSavingT(false);
    }
  }

  async function handleSaveE(e: FormEvent) {
    e.preventDefault();
    if (shownYear === undefined) return;
    setSavingE(true);
    setStatusE(null);
    try {
      await saveForm1098E({
        taxYear: shownYear,
        box1: box1E,
      });
      const refreshed = await fetchSummary(shownYear);
      setSummary(refreshed);
      setStatusE({ kind: 'ok', text: `Saved Form 1098-E for tax year ${shownYear}. The estimate has been updated.` });
    } catch (err: unknown) {
      setStatusE({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to save Form 1098-E.' });
    } finally {
      setSavingE(false);
    }
  }

  const scholarships = summary?.estimate.scholarships ?? null;
  const sli = summary?.estimate.adjustments.studentLoanInterest ?? null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12 md:gap-8">
      <PageHeader
        icon={<BookOpen size={26} aria-hidden />}
        iconTone="info"
        title="Education Deductions & Scholarships"
        description="Form 1098-T scholarship overflow beyond qualified tuition is reported as ordinary income (Schedule 1 line 8r). Form 1098-E student loan interest is deductible up to $2,500 (Schedule 1 line 21)."
        actions={<TaxYearSelect value={shownYear} onChange={setTaxYear} />}
      />

      <Busy busy={loading} className="flex flex-col gap-6 md:gap-8">
        {/* Section 1: Form 1098-T */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <Card padding="lg">
            <form onSubmit={handleSaveT} className="flex flex-col gap-6">
              <div>
                <CardTitle>Form 1098-T Statement</CardTitle>
                <CardDescription>Enter amounts from your official school Form 1098-T tuition statement.</CardDescription>
              </div>
              <FieldGrid>
                <Field htmlFor="box1" label="Box 1: Payments received" hint="Qualified tuition and related expenses">
                  <Input
                    id="box1"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 10000"
                    value={box1}
                    onChange={(e) => setBox1(e.target.value)}
                  />
                </Field>
                <Field htmlFor="box5" label="Box 5: Scholarships or grants" hint="Total institutional aid received">
                  <Input
                    id="box5"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 30000"
                    value={box5}
                    onChange={(e) => setBox5(e.target.value)}
                  />
                </Field>
              </FieldGrid>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={savingT}
                icon={<Save size={18} aria-hidden />}
                disabled={shownYear === undefined}
              >
                {shownYear ? `Save 1098-T for tax year ${shownYear}` : 'Save Form 1098-T'}
              </Button>
              {statusT && <InlineStatus kind={statusT.kind}>{statusT.text}</InlineStatus>}
            </form>
          </Card>

          <Card padding="lg" className="flex flex-col">
            <CardHeader>
              <div>
                <CardTitle>What the engine reports</CardTitle>
                <CardDescription>Audited computation from IRC §117 and Pub. 970 rules.</CardDescription>
              </div>
            </CardHeader>

            {scholarships ? (
              <div className="flex flex-1 flex-col gap-3">
                <DataRow
                  label="Scholarships & grants"
                  hint="Form 1098-T Box 5 total aid"
                  value={formatCurrency(scholarships.totalScholarships)}
                />
                <DataRow
                  label="Qualified tuition covered"
                  hint="Payments received for qualified tuition (Box 1)"
                  value={`-${formatCurrency(scholarships.qualifiedTuitionFromBox1)}`}
                  tone="muted"
                />
                {scholarships.requiredCourseMaterials > 0 && (
                  <DataRow
                    label="Required course materials"
                    hint="Books and course supplies you categorised (IRC §117(b)(2))"
                    value={`-${formatCurrency(scholarships.requiredCourseMaterials)}`}
                    tone="muted"
                  />
                )}
                {scholarships.restrictedToNonQualifiedExpenses > 0 && (
                  <DataRow
                    label="Earmarked for living costs"
                    hint="Designated for room and board; always taxable"
                    value={formatCurrency(scholarships.restrictedToNonQualifiedExpenses)}
                    tone="danger"
                  />
                )}
                <div className="mt-auto border-t border-border pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-fg-muted">Reported on Schedule 1 line 8r</div>
                      <div className="mt-0.5 font-medium">Taxable scholarship income</div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-fg">
                      {formatCurrency(scholarships.taxable)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">
                {summary ? 'No Form 1098-T entered for this tax year. Save values to see the computation.' : 'Loading…'}
              </p>
            )}
          </Card>
        </div>

        {/* Section 2: Form 1098-E */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <Card padding="lg">
            <form onSubmit={handleSaveE} className="flex flex-col gap-6">
              <div>
                <CardTitle>Form 1098-E Student Loan Interest</CardTitle>
                <CardDescription>Enter student loan interest paid to qualified lenders during the tax year.</CardDescription>
              </div>
              <Field
                htmlFor="box1E"
                label="Box 1: Student loan interest received by lender"
                hint="Reported by loan servicer on Form 1098-E"
              >
                <Input
                  id="box1E"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1500"
                  value={box1E}
                  onChange={(e) => setBox1E(e.target.value)}
                />
              </Field>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={savingE}
                icon={<Save size={18} aria-hidden />}
                disabled={shownYear === undefined}
              >
                {shownYear ? `Save 1098-E for tax year ${shownYear}` : 'Save Form 1098-E'}
              </Button>
              {statusE && <InlineStatus kind={statusE.kind}>{statusE.text}</InlineStatus>}
            </form>
          </Card>

          <Card padding="lg" className="flex flex-col">
            <CardHeader>
              <div>
                <CardTitle>Deduction breakdown</CardTitle>
                <CardDescription>IRC §221 adjustment to income on Schedule 1 line 21.</CardDescription>
              </div>
            </CardHeader>

            {sli ? (
              <div className="flex flex-1 flex-col gap-3">
                <DataRow
                  label="Reported interest paid"
                  hint="Form 1098-E Box 1"
                  value={formatCurrency(sli.interestPaid)}
                />
                <DataRow
                  label="Tentative deduction"
                  hint="Maximum statutory cap is $2,500 (IRC §221(b)(1))"
                  value={formatCurrency(sli.tentative)}
                />
                {sli.reduction > 0 && (
                  <DataRow
                    label="Income phaseout reduction"
                    hint="Reduced as MAGI approaches threshold"
                    value={`-${formatCurrency(sli.reduction)}`}
                    tone="muted"
                  />
                )}
                {sli.disallowedReason && (
                  <DataRow
                    label="Disallowed status"
                    hint={
                      sli.disallowedReason === 'claimed_as_dependent'
                        ? 'Cannot claim deduction when claimed as a dependent (IRC §221(c))'
                        : 'Cannot claim deduction when married filing separately (IRC §221(e)(2))'
                    }
                    value="Disallowed"
                    tone="danger"
                  />
                )}
                <div className="mt-auto border-t border-border pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-fg-muted">Schedule 1 line 21 deduction</div>
                      <div className="mt-0.5 font-medium">Above-the-line AGI reduction</div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-accent">
                      {formatCurrency(sli.deduction)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">
                {summary ? 'No Form 1098-E entered for this tax year. Save values to see the computation.' : 'Loading…'}
              </p>
            )}
          </Card>
        </div>

        {/* Mandatory EstimateNotice */}
        <EstimateNotice
          disclaimer={summary?.disclaimer}
          warnings={summary?.warnings}
          assumptions={summary?.assumptions}
          notModeled={summary?.notModeled}
        />

        {/* Educational Context */}
        <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-bg" aria-hidden>
            <Info size={22} className="text-info" />
          </div>
          <div className="min-w-0">
            <h3 className="mb-2 text-lg font-semibold">How taxable scholarships work</h3>
            <p className="max-w-prose leading-relaxed text-fg-muted">
              A scholarship is tax-free only to the extent it pays tuition, fees, and books, supplies, and equipment
              required for your courses (IRC §117; Pub. 970 chapter 1). The portion covering room, board, or other living
              costs is taxable and reported on Schedule 1 line 8r as ordinary income. It is not earnings from self-employment,
              so no self-employment tax applies. Categorise any school-refund direct deposits as scholarship refunds on the
              Deductions page so those funds are not duplicated as business gross receipts.
            </p>
          </div>
        </Card>
      </Busy>
    </div>
  );
}
