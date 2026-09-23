'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { CheckCircle2, Landmark, Link2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { InlineStatus } from '../ui/InlineStatus';

type Status = { kind: 'ok' | 'error' | 'info'; text: string } | null;

/**
 * Bank connection through Plaid: connect once, then sync to bring in new
 * transactions. Connection state comes from the database (/api/plaid/status),
 * never from localStorage, which used to outlive the connection itself.
 *
 * Plaid runs in sandbox mode here: the "bank" is Plaid's test institution,
 * and the card says so.
 */
export function BankCard({ onSynced }: { onSynced: () => Promise<void> }) {
  const [token, setToken] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [hasSynced, setHasSynced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

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
        if (!body.linked) {
          const tokenRes = await fetch('/api/plaid/create_link_token', { method: 'POST' });
          const tokenBody = await tokenRes.json().catch(() => null);
          if (!cancelled) {
            if (tokenRes.ok && tokenBody?.link_token) setToken(tokenBody.link_token);
            else setStatus({ kind: 'error', text: tokenBody?.error ?? 'Bank connections are not available right now.' });
          }
        }
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
  }, []);

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
    <Card padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              : 'Connect once and deposits and purchases arrive by themselves. Test mode: this uses Plaid’s sandbox bank, not a real account.'}
          </p>
          {status && <InlineStatus kind={status.kind} className="mt-2">{status.text}</InlineStatus>}
        </div>
      </div>
      <div className="shrink-0 pl-13 sm:pl-0">
        {linked === null ? null : linked ? (
          <Button variant="secondary" onClick={() => void sync()} loading={busy} icon={<RefreshCw size={16} aria-hidden />}>
            Sync now
          </Button>
        ) : (
          <ConnectButton token={token} onSuccess={onSuccess} busy={busy} />
        )}
      </div>
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
