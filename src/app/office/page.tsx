'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Home, Info, Save } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { TaxYearSelect } from '@/components/TaxYearSelect';
import { useTaxYear } from '@/components/useTaxYear';
import { errorText, fetchHomeOfficeForm, fetchSummary, saveHomeOfficeForm, type SummaryResponse } from '@/components/api';
import { formatCurrency, formatPercent, homeOfficeMethodLabel } from '@/components/format';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Card, CardDescription, CardHeader, CardTitle, DataRow } from '@/components/ui/Card';
import { Field, FieldGrid, Input } from '@/components/ui/Field';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';

interface FormState {
  totalSqFt: string;
  officeSqFt: string;
  rentAmount: string;
  utilitiesAmount: string;
}

const EMPTY_FORM: FormState = { totalSqFt: '', officeSqFt: '', rentAmount: '', utilitiesAmount: '' };

/**
 * Home office deduction (Schedule C line 30). Reference implementation for a
 * form page: the inputs are saved per tax year, and the comparison on the
 * right is read from `estimate.scheduleC.homeOffice`, which the engine
 * computed and cited. Nothing on this page multiplies anything.
 */
export default function HomeOfficePage() {
  const [taxYear, setTaxYear] = useTaxYear();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  /** The year the form endpoint answered for; independent of the estimate. */
  const [formYear, setFormYear] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // Loading is derived: busy until the response for the requested year has landed (or failed).
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = taxYear === undefined ? 'default' : String(taxYear);
  const loading = resolvedKey !== requestKey;

  useEffect(() => {
    let ignore = false;
    // allSettled, not all. This is the page you would come to in order to fix
    // a bad home office record, so it must not be disabled by the estimate
    // that record breaks. The e2e audit found it blank with Save greyed out —
    // the form data had loaded, but Promise.all rejected before it applied.
    Promise.allSettled([fetchHomeOfficeForm(taxYear), fetchSummary(taxYear)])
      .then(([formRes, summaryRes]) => {
        if (ignore) return;

        if (formRes.status === 'fulfilled') {
          setForm(
            formRes.value.form
              ? {
                  totalSqFt: String(formRes.value.form.totalSqFt),
                  officeSqFt: String(formRes.value.form.officeSqFt),
                  rentAmount: String(formRes.value.form.rentAmount),
                  utilitiesAmount: String(formRes.value.form.utilitiesAmount),
                }
              : EMPTY_FORM,
          );
          setFormYear(formRes.value.taxYear);
          setStatus(null);
        } else {
          console.error('Failed to load the home office form', formRes.reason);
          setStatus({ kind: 'error', text: errorText(formRes.reason, 'Failed to load.') });
        }

        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value);
          setSummaryError(null);
        } else {
          console.error('Failed to load the estimate', summaryRes.reason);
          setSummary(null);
          setSummaryError(errorText(summaryRes.reason, 'The estimate could not be calculated.'));
        }
      })
      .finally(() => {
        if (!ignore) setResolvedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [taxYear, requestKey]);

  // From the form endpoint, not the estimate. Deriving it from the estimate
  // left it undefined whenever the estimate failed, which disabled Save on the
  // one page that can repair the record causing the failure.
  const shownYear = formYear ?? summary?.taxYear ?? taxYear;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (shownYear === undefined) return;
    setSaving(true);
    setStatus(null);

    // The save and the refresh are reported separately. They used to share one
    // try block, so a failing estimate produced "Failed to save" after the row
    // had already been written — the audit saw exactly that and concluded its
    // invalid entry had been rejected when it had in fact been stored.
    try {
      await saveHomeOfficeForm({ taxYear: shownYear, ...form });
    } catch (err: unknown) {
      setStatus({ kind: 'error', text: errorText(err, 'Failed to save.') });
      setSaving(false);
      return;
    }

    try {
      // Re-run the estimate so the comparison reflects what was just saved.
      const refreshed = await fetchSummary(shownYear);
      setSummary(refreshed);
      setSummaryError(null);
      setStatus({ kind: 'ok', text: `Saved for tax year ${shownYear}. The estimate has been updated.` });
    } catch (err: unknown) {
      setSummary(null);
      setSummaryError(errorText(err, 'The estimate could not be recalculated.'));
      setStatus({ kind: 'ok', text: `Saved for tax year ${shownYear}.` });
    } finally {
      setSaving(false);
    }
  }

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const homeOffice = summary?.estimate.scheduleC.homeOffice ?? null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12 md:gap-8">
      <PageHeader
        icon={<Home size={26} aria-hidden />}
        iconTone="accent"
        title="Home Office Deduction"
        description="Schedule C line 30: the business share of your rent and utilities, or $5 per square foot. Whichever is larger is applied, capped at the business's profit."
        actions={<TaxYearSelect value={shownYear} onChange={setTaxYear} />}
      />

      <Busy busy={loading} className="flex flex-col gap-6 md:gap-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <Card padding="lg">
            <form onSubmit={handleSave} className="flex flex-col gap-6">
              <div>
                <CardTitle>Your space</CardTitle>
                <CardDescription>Only an area used regularly and exclusively for the business counts (IRC §280A(c)(1)).</CardDescription>
              </div>
              <FieldGrid>
                <Field htmlFor="totalSqFt" label="Total home area" hint="Square feet of the whole home">
                  <Input id="totalSqFt" type="number" inputMode="decimal" min="0" step="1" placeholder="e.g. 1000" value={form.totalSqFt} onChange={update('totalSqFt')} />
                </Field>
                <Field htmlFor="officeSqFt" label="Office area" hint="Square feet used only for the business">
                  <Input id="officeSqFt" type="number" inputMode="decimal" min="0" step="1" placeholder="e.g. 150" value={form.officeSqFt} onChange={update('officeSqFt')} />
                </Field>
              </FieldGrid>

              <div>
                <CardTitle>Monthly housing costs</CardTitle>
                <CardDescription>Entered per month; the engine uses twelve months for the year.</CardDescription>
              </div>
              <FieldGrid>
                <Field htmlFor="rentAmount" label="Rent or mortgage interest" hint="Dollars per month">
                  <Input id="rentAmount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="e.g. 2000" value={form.rentAmount} onChange={update('rentAmount')} />
                </Field>
                <Field htmlFor="utilitiesAmount" label="Utilities and internet" hint="Dollars per month">
                  <Input id="utilitiesAmount" type="number" inputMode="decimal" min="0" step="0.01" placeholder="e.g. 250" value={form.utilitiesAmount} onChange={update('utilitiesAmount')} />
                </Field>
              </FieldGrid>

              <Button type="submit" variant="primary" size="lg" fullWidth loading={saving} icon={<Save size={18} aria-hidden />} disabled={shownYear === undefined}>
                {shownYear ? `Save for tax year ${shownYear}` : 'Save'}
              </Button>
              {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
            </form>
          </Card>

          <Card padding="lg" className="flex flex-col">
            <CardHeader>
              <div>
                <CardTitle>How the engine computed it</CardTitle>
                <CardDescription>Both methods, from your saved figures. Values are the engine&apos;s, cited in the estimate.</CardDescription>
              </div>
            </CardHeader>

            {homeOffice ? (
              <div className="flex flex-1 flex-col gap-3">
                <DataRow
                  label="Simplified method"
                  hint={`${homeOffice.simplified.allowableSquareFeet} sq ft allowable × ${formatCurrency(homeOffice.simplified.ratePerSquareFoot)} (Rev. Proc. 2013-13)`}
                  value={formatCurrency(homeOffice.simplified.beforeLimit)}
                />
                <DataRow
                  label="Regular method"
                  hint={`${formatPercent(homeOffice.regular.businessUsePercentage)} of ${formatCurrency(homeOffice.regular.annualRentAndUtilities)} annual costs (Form 8829)`}
                  value={formatCurrency(homeOffice.regular.beforeLimit)}
                />
                <DataRow
                  label="Income limit"
                  hint="Neither method may exceed the business's tentative profit (IRC §280A(c)(5))"
                  value={formatCurrency(homeOffice.grossIncomeLimit)}
                  tone="muted"
                />
                {homeOffice.regular.carryover > 0 && (
                  <DataRow label="Regular-method carryover" hint="Disallowed this year; carries to next year on Form 8829" value={formatCurrency(homeOffice.regular.carryover)} tone="muted" />
                )}
                <div className="mt-auto border-t border-border pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-fg-muted">Applied on Schedule C line 30</div>
                      <div className="mt-0.5 font-medium">{homeOfficeMethodLabel(homeOffice.method)}</div>
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-accent">{formatCurrency(homeOffice.deduction)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">
                {summary ? 'No home office details saved for this year. Save the form to see the comparison.' : 'Loading…'}
              </p>
            )}
          </Card>
        </div>

        {/* Name the problem rather than showing an empty comparison. The form
            above stays usable, which is the point — this is the page you fix
            a bad record from. */}
        {summaryError && (
          <InlineStatus kind="error">
            {summaryError} The form above still works; correct the values and save to recalculate.
          </InlineStatus>
        )}

        <EstimateNotice
          disclaimer={summary?.disclaimer}
          warnings={summary?.warnings}
          assumptions={summary?.assumptions}
          notModeled={summary?.notModeled}
        />

        <Card padding="lg" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-bg" aria-hidden>
            <Info size={22} className="text-info" />
          </div>
          <div className="min-w-0">
            <h3 className="mb-2 text-lg font-semibold">Who can take this deduction</h3>
            <p className="max-w-prose leading-relaxed text-fg-muted">
              The deduction is for self-employment income reported on Schedule C. Employees cannot claim a home office for
              W-2 work, because the itemized deduction for unreimbursed employee expenses is suspended. The office must be
              used regularly and exclusively for the business, the deduction cannot exceed the business&apos;s profit for the
              year, and the choice between the two methods is made each year. The engine reports both and applies the
              larger one; it does not file anything.
            </p>
          </div>
        </Card>
      </Busy>
    </div>
  );
}
