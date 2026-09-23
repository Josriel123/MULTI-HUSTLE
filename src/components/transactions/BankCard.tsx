'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePlaidLink } from 'react-plaid-link';
import { CheckCircle2, Landmark, Link2, RefreshCw, Unlink } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useConfirm } from '../ui/ConfirmDialog';
import { InlineStatus } from '../ui/InlineStatus';

type Status = { kind: 'ok' | 'error' | 'info'; text: string } | null;

/**
 * Bank connection through Plaid: connect once, then sync to bring in new
 * transactions. Connection state comes from the database (/api/plaid/status),
 * never from localStorage, which used to outlive the connection itself.
 *
 * In Plaid's sandbox the "bank" is Plaid's test institution, and the card
 * says so. Before connecting, the card says what connecting shares and links
 * both privacy policies (Plaid's developer policy asks apps to); once
 * connected, "Disconnect" revokes access at Plaid and forgets the token.
 */
export function BankCard({ onSynced }: { onSynced: () => Promise<void> }) {
  const [token, setToken] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [sandbox, setSandbox] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  /** A Link token is needed only to connect, so it is fetched only while no bank is connected. */
  const loadLinkToken = useCallback(async (isCancelled: () => boolean = () => false) => {
    const tokenRes = await fetch('/api/plaid/create_link_token', { method: 'POST' });
    const tokenBody = await tokenRes.json().catch(() => null);
    if (isCancelled()) return;
    if (tokenRes.ok && tokenBody?.link_token) setToken(tokenBody.link_token);
    else setStatus({ kind: 'error', text: tokenBody?.error ?? 'Bank connections are not available right now.' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/plaid/status');
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        setLinked(Boolean(body.linked));
        setHasSynced(Boolean(body.hasSynced));
        setSandbox(body.environment === 'sandbox');
        if (!body.linked) await loadLinkToken(() => cancelled);
      } catch (err) {
        console.error('Failed to read bank connection status', err);
        if (!cancelled) {
          setLinked(false);
          setStatus({ kind: 'error', text: 'Could not check your bank connection.' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLinkToken]);

  const sync = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        setHasSynced(true);
        const parts = [
          body.count === 0 ? 'No new transactions' : `${body.count} transaction${body.count === 1 ? '' : 's'} brought in`,
          body.removed > 0 ? `${body.removed} removed` : null,
        ].filter(Boolean);
        setStatus({ kind: 'ok', text: `${parts.join(', ')}. New ones need a category.` });
        await onSynced();
      } else if (res.status === 404) {
        setLinked(false);
        setStatus({ kind: 'error', text: 'No bank is connected any more. Connect one to sync.' });
      } else {
        setStatus({ kind: 'error', text: body?.error ?? 'Sync failed.' });
      }
    } catch {
      setStatus({ kind: 'error', text: 'Sync failed.' });
    } finally {
      setBusy(false);
    }
  }, [onSynced]);

  const disconnect = useCallback(async () => {
    const ok = await confirm({
      title: 'Disconnect your bank?',
      body: (
        <>
          {BRAND.name} will ask Plaid to stop sharing this bank&rsquo;s data and will delete its access. Transactions already brought in stay
          here; delete them yourself if you do not want them. You can connect again later.
        </>
      ),
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/plaid/disconnect', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.disconnected) {
        setStatus({ kind: 'error', text: body?.error ?? 'Could not disconnect the bank. Try again.' });
        return;
      }
      setLinked(false);
      setHasSynced(false);
      setStatus(
        body.revokedAtPlaid
          ? { kind: 'ok', text: 'Bank disconnected. Plaid has stopped sharing it with this app.' }
          : { kind: 'info', text: 'Bank disconnected here, but Plaid did not confirm. To be sure, also remove this app at my.plaid.com.' },
      );
      await loadLinkToken();
    } catch {
      setStatus({ kind: 'error', text: 'Could not disconnect the bank. Try again.' });
    } finally {
      setBusy(false);
    }
  }, [confirm, loadLinkToken]);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setBusy(true);
      setStatus(null);
      try {
        const res = await fetch('/api/plaid/exchange_public_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          setStatus({ kind: 'error', text: body?.error ?? 'Could not connect the bank.' });
          setBusy(false);
          return;
        }
        setLinked(true);
      } catch {
        setStatus({ kind: 'error', text: 'Could not connect the bank.' });
        setBusy(false);
        return;
      }
      // Bring the transactions in straight away rather than asking for a second click.
      await sync();
    },
    [sync],
  );

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info" aria-hidden>
            <Landmark size={18} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {linked ? (
                <>
                  <CheckCircle2 size={15} className="text-accent" aria-hidden /> Bank connected
                </>
              ) : (
                'Bring transactions in from your bank'
              )}
            </p>
            <p className="mt-0.5 text-sm text-fg-muted">
              {linked
                ? hasSynced
                  ? 'Sync any time to bring in new deposits and purchases.'
                  : 'Sync to bring in your deposits and purchases.'
                : 'Connect once and deposits and purchases arrive by themselves.'}
              {sandbox && !linked && ' Test mode: this uses Plaid’s sandbox bank, not a real account.'}
            </p>
            {status && <InlineStatus kind={status.kind} className="mt-2">{status.text}</InlineStatus>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 pl-13 sm:pl-0">
          {linked === null ? null : linked ? (
            <>
              <Button variant="secondary" onClick={() => void sync()} loading={busy} icon={<RefreshCw size={16} aria-hidden />}>
                Sync now
              </Button>
              <Button variant="ghost" onClick={() => void disconnect()} disabled={busy} icon={<Unlink size={16} aria-hidden />}>
                Disconnect
              </Button>
            </>
          ) : (
            <ConnectButton token={token} onSuccess={onSuccess} busy={busy} />
          )}
        </div>
      </div>
      {linked === false && (
        <p className="border-t border-border pt-3 text-xs leading-relaxed text-fg-muted">
          Connecting asks Plaid to share this bank&rsquo;s account and transaction details with {BRAND.name}, under Plaid&rsquo;s{' '}
          <a
            href="https://plaid.com/legal/#end-user-privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-2 hover:no-underline"
          >
            End User Privacy Policy<span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          and our{' '}
          <Link href="/legal/privacy#share" className="font-medium text-accent underline underline-offset-2 hover:no-underline">
            Privacy Policy
          </Link>
          . We never see your bank login, and you can disconnect at any time.
        </p>
      )}
      {confirmDialog}
    </Card>
  );
}

/**
 * Plaid Link lives in its own component so its script loads only when a bank
 * is not connected yet: a connected account never needs it, and loading it
 * on every visit is what produced Plaid's "embedded more than once" warning.
 */
function ConnectButton({ token, onSuccess, busy }: { token: string | null; onSuccess: (publicToken: string) => Promise<void>; busy: boolean }) {
  const { open, ready } = usePlaidLink({ token, onSuccess: (publicToken) => void onSuccess(publicToken) });
  return (
    <Button variant="info" onClick={() => open()} disabled={!ready || !token} loading={busy} icon={<Link2 size={16} aria-hidden />}>
      Connect a bank
    </Button>
  );
}
