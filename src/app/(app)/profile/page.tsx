'use client';

import { useCallback, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ExternalLink, UserRound } from 'lucide-react';
import { FILING_STATUS_HELP_URL, FILING_STATUS_INFO } from '@/lib/glossary';
import { FILING_STATUSES, type FilingStatus } from '@/lib/tax/types';
import { getTaxYearParameters, isSupportedTaxYear } from '@/lib/tax/parameters';
import { errorText, fetchProfile, saveProfile, type TaxProfile } from '@/components/api';
import { formatCurrency } from '@/components/format';
import { useLoad } from '@/components/useLoad';
import { defaultTaxYear, useTaxYear, useYearHref } from '@/components/useTaxYear';
import { Button, LinkButton } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Checkbox, RadioCard } from '@/components/ui/Field';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { Term } from '@/components/ui/Term';

const loadProfile = () => fetchProfile();

/**
 * The three facts about the person, rather than their money, that the
 * estimate needs: filing status, whether someone can claim them as a
 * dependent, and (married filing separately only) whether the spouse
 * itemizes. They apply to every tax year.
 */
export default function ProfilePage() {
  const profile = useLoad('profile', loadProfile);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tax profile"
        description="A few facts about you that change the tax on everything else. They apply to every year."
        icon={<UserRound size={22} />}
        iconTone="accent"
      />
      {profile.error !== null && <InlineStatus kind="error">{errorText(profile.error, 'Could not load your tax profile.')}</InlineStatus>}
      {profile.data ? (
        <ProfileForm key={JSON.stringify(profile.data)} initial={profile.data} onSaved={profile.reload} />
      ) : (
        !profile.error && <p className="text-sm text-fg-muted">Loading…</p>
      )}
    </div>
  );
}

function ProfileForm({ initial, onSaved }: { initial: TaxProfile; onSaved: () => Promise<void> }) {
  const [taxYear] = useTaxYear();
  const yearHref = useYearHref();
  const year = taxYear ?? defaultTaxYear();
  const [filingStatus, setFilingStatus] = useState<FilingStatus>(initial.filingStatus as FilingStatus);
  const [claimedAsDependent, setClaimedAsDependent] = useState(initial.claimedAsDependent);
  const [spouseItemizes, setSpouseItemizes] = useState(initial.spouseItemizes);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const deductions = isSupportedTaxYear(year) ? getTaxYearParameters(year).standardDeduction.amounts : null;

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setStatus(null);
      try {
        await saveProfile({ filingStatus, claimedAsDependent, spouseItemizes: filingStatus === 'married_filing_separately' && spouseItemizes });
        setStatus({ kind: 'ok', text: 'Saved. Every estimate now uses this profile.' });
        await onSaved();
      } catch (err) {
        setStatus({ kind: 'error', text: errorText(err, 'Could not save your profile.') });
      } finally {
        setSaving(false);
      }
    },
    [filingStatus, claimedAsDependent, spouseItemizes, onSaved],
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {!initial.saved && (
        <Callout tone="info" title="Not set yet">
          Until you save this, the estimate assumes you file as single with no one claiming you as a dependent.
        </Callout>
      )}

      <Card padding="lg">
        <fieldset>
          <legend className="text-base font-semibold md:text-lg">
            <Term k="filingStatus">Filing status</Term>
          </legend>
          <p className="mt-1 text-sm text-fg-muted">
            How you will file your {year} return. Not sure?{' '}
            <a href={FILING_STATUS_HELP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Ask the IRS&rsquo;s interactive check <ExternalLink size={13} aria-hidden />
            </a>
          </p>
          <div className="mt-4 grid gap-2.5 md:grid-cols-2">
            {FILING_STATUSES.map((s) => (
              <RadioCard
                key={s}
                id={`fs-${s}`}
                name="filingStatus"
                value={s}
                checked={filingStatus === s}
                onChange={() => setFilingStatus(s)}
                label={FILING_STATUS_INFO[s].label}
                description={
                  <>
                    {FILING_STATUS_INFO[s].text}
                    {deductions && (
                      <span className="mt-1.5 block text-xs text-fg-faint">
                        Standard deduction for {year}: {formatCurrency(deductions[s])}
                      </span>
                    )}
                  </>
                }
              />
            ))}
          </div>
        </fieldset>
      </Card>

      <Card padding="lg" className="flex flex-col gap-3">
        <div>
          <CardTitle>Two more questions</CardTitle>
          <CardDescription>Most people answer no to both.</CardDescription>
        </div>
        <Checkbox
          id="claimed-as-dependent"
          checked={claimedAsDependent}
          onChange={(e) => setClaimedAsDependent(e.target.checked)}
          label="Someone else can claim me as a dependent"
          description="For example, a parent who supports you while you are a student. It lowers your standard deduction and rules out the student loan interest deduction."
        />
        {filingStatus === 'married_filing_separately' && (
          <Checkbox
            id="spouse-itemizes"
            className="animate-fade-in"
            checked={spouseItemizes}
            onChange={(e) => setSpouseItemizes(e.target.checked)}
            label="My spouse itemizes deductions on their return"
            description="When one spouse filing separately itemizes, the other cannot take the standard deduction at all."
          />
        )}
        {filingStatus === 'married_filing_jointly' && (
          <p className="rounded-lg bg-surface px-4 py-3 text-sm text-fg-muted">
            Filing jointly? Add your spouse&rsquo;s W-2 too, on{' '}
            <Link href={yearHref('/jobs')} className="font-medium text-accent hover:underline">
              W-2 jobs
            </Link>
            . The estimate models one self-employed person, you.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="lg" loading={saving}>
          Save profile
        </Button>
        {status?.kind === 'ok' && (
          <LinkButton href={yearHref('/')} variant="secondary" size="lg">
            See your estimate
          </LinkButton>
        )}
        {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
      </div>
    </form>
  );
}
