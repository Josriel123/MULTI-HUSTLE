'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { Download, KeyRound, Mail, ShieldCheck, Sprout, Trash2 } from 'lucide-react';
import { LEGAL, formatLegalDate } from '@/lib/legal';
import { deleteAccount, downloadAccountData, errorText, fetchAccount } from '@/components/api';
import { formatDate } from '@/components/format';
import { reopenCookieNotice } from '@/components/legal/CookieNotice';
import { startTour } from '@/components/tour/GuidedTour';
import { useLoad } from '@/components/useLoad';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';

const loadAccount = () => fetchAccount();

/**
 * Account & privacy: the user's rights, one click each. Download everything
 * (right to access and portability), delete everything (right to delete), see
 * what they agreed to and when, and the privacy choices. Deleting is as easy
 * to find as signing up was: the FTC counts a buried or obstructed deletion
 * as a dark pattern.
 */
export default function AccountPage() {
  const clerk = useClerk();
  const account = useLoad('account', loadAccount);
  const [confirm, confirmDialog] = useConfirm();
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const agreement = account.data?.agreement;

  async function download() {
    setDownloading(true);
    setStatus(null);
    try {
      await downloadAccountData();
      setStatus({ kind: 'ok', text: 'Your data is downloading as a JSON file.' });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not prepare your data.') });
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete your account and all of your data?',
      body: (
        <>
          This erases every transaction, trip, W-2, payment, form and setting you have entered, disconnects any bank, and closes your sign-in account. It
          happens straight away and cannot be undone. You may want to download your data first.
        </>
      ),
      confirmLabel: 'Delete everything',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    setStatus(null);
    try {
      await deleteAccount();
      // If Clerk cannot sign out a user it has just deleted, load the page
      // afresh (replace, so Back cannot return to the deleted account) rather
      // than routing client-side with signed-in state still in memory.
      await clerk.signOut({ redirectUrl: '/welcome?deleted=1' }).catch(() => window.location.replace('/welcome?deleted=1'));
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not delete your account. Please try again.') });
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account & privacy"
        description="Your data belongs to you. Download it, delete it, or check what you agreed to, any time."
        icon={<ShieldCheck size={22} />}
        iconTone="accent"
      />

      {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg" className="flex flex-col gap-4">
          <div>
            <CardTitle>Download your data</CardTitle>
            <CardDescription>
              A single file with everything {LEGAL.appName} stores about you: your profile, transactions, hustles, trips, W-2s, payments and forms. The bank
              access token is left out; it is a credential, not information about you.
            </CardDescription>
          </div>
          <Button variant="secondary" loading={downloading} icon={<Download size={16} aria-hidden />} onClick={() => void download()} className="self-start">
            Download my data
          </Button>
        </Card>

        <Card padding="lg" className="flex flex-col gap-4">
          <div>
            <CardTitle>Delete your account</CardTitle>
            <CardDescription>
              Erases everything you have entered, disconnects any bank through Plaid, and closes your sign-in account. There is no waiting period and nothing
              is kept, apart from encrypted database backups that expire on their own within {LEGAL.backupRetentionDays} days.
            </CardDescription>
          </div>
          <Button variant="danger" loading={deleting} icon={<Trash2 size={16} aria-hidden />} onClick={() => void remove()} className="self-start">
            Delete my account
          </Button>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <CardTitle>What you agreed to</CardTitle>
          {agreement?.acceptedAt ? (
            <p className="text-sm leading-relaxed text-fg-muted">
              You agreed to the{' '}
              <Link href="/legal/terms" className="font-medium text-accent hover:underline">
                Terms of Service
              </Link>{' '}
              and the{' '}
              <Link href="/legal/privacy" className="font-medium text-accent hover:underline">
                Privacy Policy
              </Link>{' '}
              dated {formatLegalDate(agreement.acceptedVersion ?? LEGAL.effectiveDate)} on {formatDate(agreement.acceptedAt)}, and confirmed you are{' '}
              {LEGAL.minimumAge} or older.
            </p>
          ) : (
            <p className="text-sm text-fg-muted">{account.error ? errorText(account.error, 'Could not load your agreement.') : 'Loading…'}</p>
          )}
          <p className="text-sm text-fg-muted">
            If either changes in a way that matters, we will ask you to agree again before you continue, and you can always{' '}
            <Link href="/legal" className="font-medium text-accent hover:underline">
              read every policy
            </Link>
            .
          </p>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <CardTitle>Privacy choices</CardTitle>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-fg-muted">
            <li>We never sell your personal information, and never share or use it for advertising.</li>
            <li>There are no analytics or advertising cookies, so there is nothing to switch off. Browser privacy signals (Global Privacy Control, Do Not Track) change nothing because we do not track you in the first place.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => reopenCookieNotice()}>
              Show the cookie notice
            </Button>
            <Link href="/legal/cookies" className="inline-flex h-9 items-center px-2 text-sm font-medium text-accent hover:underline">
              Cookie policy
            </Link>
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <CardTitle>Sign-in and security</CardTitle>
          <p className="text-sm leading-relaxed text-fg-muted">
            Your email, password and two-step sign-in are managed by Clerk. Change them, or see where you are signed in, from your account settings.
          </p>
          <Button variant="secondary" size="sm" icon={<KeyRound size={15} aria-hidden />} onClick={() => clerk.openUserProfile()} className="self-start">
            Open sign-in settings
          </Button>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <CardTitle>Help</CardTitle>
          <p className="text-sm leading-relaxed text-fg-muted">
            New here, or want a refresher? Sprout can walk you through every tab again. For anything about your data, write to us; we answer within{' '}
            {LEGAL.responseDays} days.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Sprout size={15} aria-hidden />} onClick={() => startTour()}>
              Take the tour again
            </Button>
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="inline-flex h-9 items-center gap-1.5 px-2 text-sm font-medium text-accent hover:underline"
            >
              <Mail size={15} aria-hidden />
              {LEGAL.contactEmail}
            </a>
          </div>
        </Card>
      </div>
      {confirmDialog}
    </div>
  );
}
