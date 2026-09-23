'use client';

import { useCallback, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { GraduationCap, Save } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import {
  errorText,
  fetchForm1098E,
  fetchForm1098T,
  fetchSummary,
  saveForm1098E,
  saveForm1098T,
  type Form1098EResponse,
  type Form1098TResponse,
  type SummaryResponse,
} from '@/components/api';
import { formatCurrency } from '@/components/format';
import { normalizeMoneyText } from '@/components/moneyText';
import { useLoad } from '@/components/useLoad';
import { defaultTaxYear, useTaxYear, useYearHref } from '@/components/useTaxYear';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Card, CardDescription, CardTitle, DataRow } from '@/components/ui/Card';
import { Field, MoneyInput } from '@/components/ui/Field';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { Term } from '@/components/ui/Term';

type Status = { kind: 'ok' | 'error'; text: string } | null;

/** A stored amount back into the box: blank rather than "0.00" when nothing was entered. */
const boxValue = (v: string | number | undefined | null) => (v === undefined || v === null || Number(v) === 0 ? '' : String(v));

/**
 * Education: Form 1098-T (scholarships and tuition) and Form 1098-E (student
 * loan interest). The page saves the boxes; every figure under them is the
 * engine's, read from the summary.
 */
export default function EducationPage() {
  const [taxYear] = useTaxYear();
  const key = String(taxYear ?? 'default');
  const loadT = useCallback(() => fetchForm1098T(taxYear), [taxYear]);
  const loadE = useCallback(() => fetchForm1098E(taxYear), [taxYear]);
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const formT = useLoad(key, loadT);
  const formE = useLoad(key, loadE);
  const summary = useLoad(key, loadSummary);
  const data = summary.data;
  const year = formT.data?.taxYear ?? formE.data?.taxYear ?? data?.taxYear ?? taxYear ?? defaultTaxYear();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Education"
        description="Scholarships spent on tuition and required books are tax-free; the rest is taxed. Student loan interest can lower your income. Copy the boxes from the forms your school and loan servicer send."
        icon={<GraduationCap size={22} />}
        iconTone="accent"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {formT.error !== null && !formT.data ? (
          <InlineStatus kind="error">{errorText(formT.error, 'Could not load your 1098-T.')}</InlineStatus>
        ) : formT.data ? (
          <ScholarshipCard key={`${year}:${JSON.stringify(formT.data.form)}`} year={year} saved={formT.data} summary={data} busy={summary.loading} onSaved={summary.reload} />
        ) : (
          <Card>Loading…</Card>
        )}
        {formE.error !== null && !formE.data ? (
          <InlineStatus kind="error">{errorText(formE.error, 'Could not load your 1098-E.')}</InlineStatus>
        ) : formE.data ? (
          <LoanInterestCard key={`${year}:${JSON.stringify(formE.data.form)}`} year={year} saved={formE.data} summary={data} busy={summary.loading} onSaved={summary.reload} />
        ) : (
          <Card>Loading…</Card>
        )}
      </div>

      {summary.error !== null && (
        <InlineStatus kind="error">
          {errorText(summary.error, 'The estimate could not be worked out.')} The forms above still save; the figures under them come from the estimate.
        </InlineStatus>
      )}
      {data && <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} />}
    </div>
  );
}

function ScholarshipCard({
  year,
  saved,
  summary,
  busy,
  onSaved,
}: {
  year: number;
  saved: Form1098TResponse;
  summary: SummaryResponse | null;
  busy: boolean;
  onSaved: () => Promise<void>;
}) {
  const yearHref = useYearHref();
  const [box1, setBox1] = useState(boxValue(saved.form?.box1));
  const [box5, setBox5] = useState(boxValue(saved.form?.box5));
  const [restricted, setRestricted] = useState(boxValue(saved.form?.restrictedToNonQualifiedExpenses));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const result = summary?.estimate.scholarships ?? null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await saveForm1098T({
        taxYear: year,
        box1: normalizeMoneyText(box1) || '0',
        box5: normalizeMoneyText(box5) || '0',
        restrictedToNonQualifiedExpenses: normalizeMoneyText(restricted),
      });
      await onSaved();
      setStatus({ kind: 'ok', text: `Saved your ${year} 1098-T. The estimate is updated.` });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not save the 1098-T.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div>
        <CardTitle>Scholarships and tuition</CardTitle>
        <CardDescription>
          From your <Term k="form1098T">Form 1098-T</Term> for {year}. Leave it blank if you were not a student.
        </CardDescription>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field htmlFor="t-box1" label="Tuition paid" aside="Box 1" hint="Payments received for qualified tuition and related expenses.">
          <MoneyInput id="t-box1" value={box1} onChange={(e) => setBox1(e.target.value)} />
        </Field>
        <Field htmlFor="t-box5" label="Scholarships or grants" aside="Box 5">
          <MoneyInput id="t-box5" value={box5} onChange={(e) => setBox5(e.target.value)} />
        </Field>
        <Field
          htmlFor="t-restricted"
          label="Grant money reserved for room and board"
          aside="Optional"
          hint="Only if a grant's own terms say part of it must go to housing, food or travel. That part is taxed whatever tuition you paid."
        >
          <MoneyInput id="t-restricted" value={restricted} onChange={(e) => setRestricted(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={saving} icon={<Save size={16} aria-hidden />}>
            Save 1098-T
          </Button>
          {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
        </div>
      </form>

      {result && (
        <Busy busy={busy} className="rounded-xl bg-surface px-4 py-2">
          <DataRow label="Scholarships and grants" value={formatCurrency(result.totalScholarships)} />
          <DataRow label="Tuition covered" hint="Box 1" value={`− ${formatCurrency(result.qualifiedTuitionFromBox1)}`} tone="muted" />
          {result.requiredCourseMaterials > 0 && (
            <DataRow label="Required books and supplies" hint="From your expenses" value={`− ${formatCurrency(result.requiredCourseMaterials)}`} tone="muted" />
          )}
          {result.restrictedToNonQualifiedExpenses > 0 && (
            <DataRow label="Reserved for room and board" hint="Always taxed" value={formatCurrency(result.restrictedToNonQualifiedExpenses)} tone="muted" />
          )}
          <DataRow label="Taxable scholarship" hint="Added to your income" value={formatCurrency(result.taxable)} emphasis />
        </Busy>
      )}
      <p className="text-sm text-fg-muted">
        Books, supplies and equipment your courses require count too. Record them as{' '}
        <Link href={yearHref('/transactions?add=expense')} className="font-medium text-accent hover:underline">
          expenses
        </Link>{' '}
        with the category for required course materials.
      </p>
    </Card>
  );
}

function LoanInterestCard({
  year,
  saved,
  summary,
  busy,
  onSaved,
}: {
  year: number;
  saved: Form1098EResponse;
  summary: SummaryResponse | null;
  busy: boolean;
  onSaved: () => Promise<void>;
}) {
  const yearHref = useYearHref();
  const [box1, setBox1] = useState(boxValue(saved.form?.box1));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const result = summary?.estimate.adjustments.studentLoanInterest ?? null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await saveForm1098E({ taxYear: year, box1: normalizeMoneyText(box1) || '0' });
      await onSaved();
      setStatus({ kind: 'ok', text: `Saved your ${year} 1098-E. The estimate is updated.` });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not save the 1098-E.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div>
        <CardTitle>Student loan interest</CardTitle>
        <CardDescription>
          From your <Term k="form1098E">Form 1098-E</Term> for {year}. Only the interest counts, never the loan payments themselves.
        </CardDescription>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field htmlFor="e-box1" label="Student loan interest paid" aside="Box 1">
          <MoneyInput id="e-box1" value={box1} onChange={(e) => setBox1(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={saving} icon={<Save size={16} aria-hidden />}>
            Save 1098-E
          </Button>
          {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
        </div>
      </form>

      {result && (
        <Busy busy={busy} className="rounded-xl bg-surface px-4 py-2">
          <DataRow label="Interest paid" value={formatCurrency(result.interestPaid)} />
          {result.tentative < result.interestPaid && <DataRow label="Capped at the yearly limit" value={formatCurrency(result.tentative)} tone="muted" />}
          {result.reduction > 0 && <DataRow label="Reduced for your income" value={`− ${formatCurrency(result.reduction)}`} tone="muted" />}
          <DataRow label="Deduction" hint="Taken off your income" value={formatCurrency(result.deduction)} emphasis />
          {result.disallowedReason && (
            <p className="pb-2 text-sm text-fg-muted">
              {result.disallowedReason === 'married_filing_separately'
                ? 'Not allowed when married filing separately, so nothing is deducted.'
                : 'Not allowed when someone can claim you as a dependent, so nothing is deducted.'}{' '}
              <Link href={yearHref('/profile')} className="font-medium text-accent hover:underline">
                Check your tax profile
              </Link>
            </p>
          )}
        </Busy>
      )}
    </Card>
  );
}
