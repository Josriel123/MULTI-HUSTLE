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

const loadAccount = () => fetchAccount();

// Once someone says they are under 18 on this device, the answer sticks: the
// FTC's COPPA guidance is that an age screen should not let a child simply go
// back and give a different answer.
const UNDERAGE_KEY = 'multi-hustle:underage';
function readUnderage(): boolean {
  try {
    return window.localStorage.getItem(UNDERAGE_KEY) === '1';
  } catch {
    return false;
  }
}
function rememberUnderage() {
  try {
    window.localStorage.setItem(UNDERAGE_KEY, '1');
  } catch {
    // Storage blocked: the screen still switches for this visit.
  }
}

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
        <Loader2 size={24} className="animate-spin text-fg-faint" aria-label="Loading your account" />
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
  const [underage, setUnderage] = useState(readUnderage);
  const [deleting, setDeleting] = useState(false);
  const returning = status.acceptedVersion !== null;

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
      await deleteAccount();
      // If Clerk cannot sign out a user it has just deleted, load the page
      // afresh (replace, so Back cannot return to the deleted account) rather
      // than routing client-side with signed-in state still in memory.
      await clerk.signOut({ redirectUrl: '/welcome?deleted=1' }).catch(() => window.location.replace('/welcome?deleted=1'));
    } catch (err) {
      setError(errorText(err, 'Could not delete the account. Please try again, or write to us.'));
      setDeleting(false);
    }
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
          <div className="mt-5 flex flex-col gap-4">
            <p className="text-[0.95rem] leading-relaxed text-fg-muted">
              Thanks for being honest. {LEGAL.appName} is only for people {LEGAL.minimumAge} and older, so you can&rsquo;t use it yet. We can delete the
              account you just made right now, and we will not keep anything about you.
            </p>
            {error && <InlineStatus kind="error">{error}</InlineStatus>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" loading={deleting} onClick={() => void removeAccount()}>
                Delete my account
              </Button>
              <SignOutButton redirectUrl="/welcome">
                <Button variant="ghost">Sign out</Button>
              </SignOutButton>
            </div>
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
              <button
                type="button"
                className="font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                onClick={() => {
                  rememberUnderage();
                  setUnderage(true);
                }}
              >
                I&rsquo;m under {LEGAL.minimumAge}
              </button>
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
