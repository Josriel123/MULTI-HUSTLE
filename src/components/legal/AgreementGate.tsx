'use client';

import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { SignOutButton, useClerk } from '@clerk/nextjs';
import { Loader2, Sprout } from 'lucide-react';
import { LEGAL } from '@/lib/legal';
import { acceptAgreement, deleteAccount, errorText, fetchAccount, type AgreementStatus } from '../api';
import { useLoad } from '../useLoad';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Field';
import { InlineStatus } from '../ui/InlineStatus';
import { afterDeletionUrl } from './deletion';
import { readUnderage, rememberUnderage } from './underage';

const loadAccount = () => fetchAccount();

/**
 * Nothing in the app until the person has, themselves, ticked "I am 18 or
 * older" and "I agree to the Terms of Service and Privacy Policy", for the
 * current version. That tick is the clickwrap agreement; the server records
 * the version and the time. Neither box is ticked in advance, and saying no to
 * the age question leads straight to deleting the account, so no data is kept
 * about anyone under 18.
 */
export function AgreementGate({ children }: { children: ReactNode }) {
  const account = useLoad('account', loadAccount);
  const [accepted, setAccepted] = useState(false);

  if (accepted || account.data?.agreement.needsAgreement === false) return <>{children}</>;

  if (account.data) {
    return <AgreementScreen status={account.data.agreement} onAccepted={() => setAccepted(true)} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {account.error !== null ? (
        <div className="max-w-sm text-center">
          <InlineStatus kind="error" className="justify-center">
            {errorText(account.error, 'Could not load your account.')}
          </InlineStatus>
          <Button variant="secondary" className="mt-4" onClick={() => void account.reload()}>
            Try again
          </Button>
        </div>
      ) : (
        <Loader2 size={24} className="animate-spin text-fg-faint" role="img" aria-label="Loading your account" />
      )}
    </div>
  );
}

/** The agreement step itself. Exported for the dev-only preview. */
export function AgreementScreen({ status, onAccepted }: { status: AgreementStatus; onAccepted: () => void }) {
  const clerk = useClerk();
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returning = status.acceptedVersion !== null;
  // A device that already answered "under 18" shows that screen again, for a
  // new account; someone returning for new terms confirmed their age before.
  const [underage, setUnderage] = useState(() => !returning && readUnderage());
  const [deleting, setDeleting] = useState(false);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!adult) return setError(`Confirm that you are ${LEGAL.minimumAge} or older.`);
      if (!agree) return setError('Agree to the Terms of Service and Privacy Policy to continue.');
      setSaving(true);
      try {
        await acceptAgreement({ agreementVersion: status.currentVersion, agree: true, adult: true });
        onAccepted();
      } catch (err) {
        setError(errorText(err, 'Could not save your agreement. Please try again.'));
      } finally {
        setSaving(false);
      }
    },
    [adult, agree, onAccepted, status.currentVersion],
  );

  async function removeAccount() {
    setDeleting(true);
    setError(null);
    try {
      const destination = afterDeletionUrl(await deleteAccount(), 'underage');
      // Sign out, then load the next page afresh whatever Clerk did: it may
      // reject, or resolve without navigating when the user it just deleted
      // has no session left. Replace, so Back cannot return to the account.
      await clerk.signOut({ redirectUrl: destination }).catch(() => undefined);
      window.location.replace(destination);
    } catch (err) {
      setError(errorText(err, 'Could not delete the account. Please try again, or write to us.'));
      setDeleting(false);
    }
  }

  /** "I'm under 18": the account goes at once, on the server, not only when a second button is pressed. */
  function declareUnderage() {
    rememberUnderage();
    setUnderage(true);
    void removeAccount();
  }

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-pop md:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
            <Sprout size={22} strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-sm font-medium text-fg-muted">{LEGAL.appName}</p>
            <h1 className="text-xl font-bold tracking-tight">{returning ? 'Our terms have changed' : 'Before you start'}</h1>
          </div>
        </div>

        {underage ? (
          <div className="mt-5 flex flex-col gap-4" role="status">
            <p className="text-[0.95rem] leading-relaxed text-fg-muted">
              Thanks for being honest. {LEGAL.appName} is only for people {LEGAL.minimumAge} and older, so you can&rsquo;t use it yet.{' '}
              {deleting
                ? 'We are deleting the account you just made, and will keep nothing about you.'
                : 'Delete the account you just made, and we will keep nothing about you.'}
            </p>
            {error && <InlineStatus kind="error">{error}</InlineStatus>}
            {!deleting && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="danger" onClick={() => void removeAccount()}>
                  Delete my account
                </Button>
              </div>
            )}
            {deleting && <Loader2 size={20} className="animate-spin text-fg-faint" role="img" aria-label="Deleting your account" />}
            <p className="text-sm text-fg-muted">
              Made a mistake? Write to{' '}
              <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent hover:underline">
                {LEGAL.contactEmail}
              </a>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
            <p className="text-[0.95rem] leading-relaxed text-fg-muted">
              {returning
                ? 'Please read the updated Terms of Service and Privacy Policy and agree to continue. Your data stays as it is.'
                : `${LEGAL.appName} estimates the federal tax on your side hustles. It is a planning tool, not tax advice. Two quick things first:`}
            </p>
            <Checkbox id="agree-adult" checked={adult} onChange={(e) => setAdult(e.target.checked)} label={`I am ${LEGAL.minimumAge} or older.`} />
            <Checkbox
              id="agree-terms"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              label="I have read and agree to the Terms of Service and the Privacy Policy."
              description={
                <>
                  Read the{' '}
                  <Link href="/legal/terms" target="_blank" className="font-medium text-accent underline-offset-2 hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and the{' '}
                  <Link href="/legal/privacy" target="_blank" className="font-medium text-accent underline-offset-2 hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  (they open in a new tab).
                </>
              }
            />
            {error && <InlineStatus kind="error">{error}</InlineStatus>}
            {/* The button names the act: courts ask whether the click plainly meant agreement. */}
            <Button type="submit" variant="primary" size="lg" loading={saving}>
              Agree and continue
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
              {/* Only a new account is asked: someone returning for new terms already confirmed their age. */}
              {returning ? (
                <span />
              ) : (
                <button
                  type="button"
                  className="font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                  onClick={declareUnderage}
                >
                  I&rsquo;m under {LEGAL.minimumAge}
                </button>
              )}
              <SignOutButton redirectUrl="/welcome">
                <button type="button" className="font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
