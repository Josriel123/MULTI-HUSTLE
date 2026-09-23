'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePlaidLink } from 'react-plaid-link';
import { CheckCircle2, Landmark, Link2, Plus, RefreshCw, Unlink } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { fetchPlaidStatus, type BankConnection } from '../api';
import { formatDate } from '../format';
import { useLoad } from '../useLoad';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useConfirm } from '../ui/ConfirmDialog';
import { InlineStatus } from '../ui/InlineStatus';

type Status = { kind: 'ok' | 'error' | 'info'; text: string } | null;
type Connection = BankConnection;

const loadPlaidStatus = () => fetchPlaidStatus();
const bankName = (c: { institutionName: string | null }) => c.institutionName ?? 'Your bank';

/**
 * Bank connections through Plaid: connect one or several banks, then sync to
 * bring in new transactions from all of them (D52). Every account the person
 * shares in Plaid's window at one bank comes in through that one connection;
 * a second bank is a second connection. The same bank cannot be connected
 * twice, since its history would come in again.
 *
 * Connection state comes from the database (/api/plaid/status), never from
 * localStorage, which used to outlive the connection itself. In Plaid's
 * sandbox the "bank" is Plaid's test institution, and the card says so. The
 * card says what connecting shares and links both privacy policies (Plaid's
 * developer policy asks apps to); "Disconnect" revokes one bank at Plaid and
 * forgets its token.
 *
 * Nothing reaches Plaid until "Connect a bank" is pressed: only then is a
 * Link token requested (which tells Plaid the user's id) and Plaid's script
 * loaded. The Cookie Policy and the Privacy Policy say so.
 */
export function BankCard({ onSynced }: { onSynced: () => Promise<void> }) {
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [confirm, confirmDialog] = useConfirm();
  const banks = useLoad('plaid-status', loadPlaidStatus);
  const reloadBanks = banks.reload;
  // Null until the first answer; a failed check shows as none connected, with the error below.
  const connections: Connection[] | null = banks.data?.connections ?? (banks.error ? [] : null);
  const sandbox = banks.data?.environment === 'sandbox';
  const loadError = banks.error && !banks.data ? 'Could not check your bank connections.' : null;

  /** Asks for a Link token, and so loads Plaid, only when the person presses "Connect". */
  const startConnect = useCallback(async () => {
    setConnecting(true);
    setStatus(null);
    try {
      const tokenRes = await fetch('/api/plaid/create_link_token', { method: 'POST' });
      const tokenBody = await tokenRes.json().catch(() => null);
      if (tokenRes.ok && tokenBody?.link_token) {
        setToken(tokenBody.link_token);
        return;
      }
      setStatus({ kind: 'error', text: tokenBody?.error ?? 'Bank connections are not available right now.' });
    } catch {
      setStatus({ kind: 'error', text: 'Bank connections are not available right now.' });
    }
    setConnecting(false);
  }, []);

  /** Plaid's window closed without a bank (or after one): back to the plain button. */
  const endConnect = useCallback(() => {
    setToken(null);
    setConnecting(false);
  }, []);

  const sync = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        const failed = (body.banks ?? []).filter((b: { error?: string }) => b.error).map(bankName);
        const parts = [
          body.count === 0 ? 'No new transactions' : `${body.count} transaction${body.count === 1 ? '' : 's'} brought in`,
          body.removed > 0 ? `${body.removed} removed` : null,
        ].filter(Boolean);
        setStatus(
          failed.length > 0
            ? { kind: 'info', text: `${parts.join(', ')}. Could not reach ${failed.join(' and ')} this time; try again later.` }
            : { kind: 'ok', text: `${parts.join(', ')}. New ones need a category.` },
        );
        await Promise.allSettled([onSynced(), reloadBanks()]);
      } else if (res.status === 404) {
        await reloadBanks();
        setStatus({ kind: 'error', text: 'No bank is connected any more. Connect one to sync.' });
      } else {
        setStatus({ kind: 'error', text: body?.error ?? 'Sync failed.' });
      }
    } catch {
      setStatus({ kind: 'error', text: 'Sync failed.' });
    } finally {
      setBusy(false);
    }
  }, [onSynced, reloadBanks]);

  const disconnect = useCallback(
    async (connection: Connection) => {
      const name = bankName(connection);
      const ok = await confirm({
        title: `Disconnect ${name}?`,
        body: (
          <>
            {BRAND.name} will ask Plaid to stop sharing this bank&rsquo;s data and will delete its access. Transactions already brought in from it
            stay here; delete them yourself if you do not want them. If you connect it again later, its past transactions come in again, so delete
            these first or they will be counted twice.
          </>
        ),
        confirmLabel: 'Disconnect',
        tone: 'danger',
      });
      if (!ok) return;
      setBusy(true);
      setStatus(null);
      try {
        const res = await fetch('/api/plaid/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: connection.id }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.disconnected) {
          setStatus({ kind: 'error', text: body?.error ?? 'Could not disconnect the bank. Try again.' });
          return;
        }
        await reloadBanks();
        setStatus(
          body.revokedAtPlaid
            ? { kind: 'ok', text: `${name} disconnected. Plaid has stopped sharing it with this app.` }
            : { kind: 'info', text: `${name} disconnected here, but Plaid did not confirm. To be sure, also remove this app at my.plaid.com.` },
        );
      } catch {
        setStatus({ kind: 'error', text: 'Could not disconnect the bank. Try again.' });
      } finally {
        setBusy(false);
      }
    },
    [confirm, reloadBanks],
  );

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
          // 409: that bank is already connected; the message says to sync it instead.
          setStatus({ kind: res.status === 409 ? 'info' : 'error', text: body?.error ?? 'Could not connect the bank.' });
          setBusy(false);
          return;
        }
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

  const list = connections ?? [];
  const some = list.length > 0;

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info" aria-hidden>
            <Landmark size={18} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {some ? (
                <>
                  <CheckCircle2 size={15} className="text-accent" aria-hidden />
                  {list.length === 1 ? '1 bank connected' : `${list.length} banks connected`}
                </>
              ) : (
                'Bring transactions in from your bank'
              )}
            </p>
            <p className="mt-0.5 text-sm text-fg-muted">
              {some
                ? 'Sync brings in new deposits and purchases from every connected bank. Money in several banks? Connect each one.'
                : 'Connect once and deposits and purchases arrive by themselves. Money in several banks? Connect each one.'}
              {sandbox && ' Test mode: this uses Plaid’s sandbox banks, not real accounts.'}
            </p>
            {(status || loadError) && (
              <InlineStatus kind={status?.kind ?? 'error'} className="mt-2">
                {status?.text ?? loadError}
              </InlineStatus>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 pl-13 sm:pl-0">
          {connections === null ? null : (
            <>
              {some && (
                <Button variant="secondary" onClick={() => void sync()} loading={busy} icon={<RefreshCw size={16} aria-hidden />}>
                  Sync now
                </Button>
              )}
              <Button
                variant={some ? 'ghost' : 'info'}
                onClick={() => void startConnect()}
                loading={connecting || (!some && busy)}
                disabled={busy}
                icon={some ? <Plus size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
              >
                {some ? 'Connect another bank' : 'Connect a bank'}
              </Button>
              {token && <PlaidLinkOpener token={token} onSuccess={onSuccess} onExit={endConnect} />}
            </>
          )}
        </div>
      </div>

      {some && (
        <ul className="divide-y divide-border rounded-xl border border-border" aria-label="Connected banks">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{bankName(c)}</p>
                <p className="text-xs text-fg-faint">
                  Connected {formatDate(c.linkedAt)}
                  {!c.hasSynced && ' · not synced yet'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void disconnect(c)}
                disabled={busy}
                icon={<Unlink size={15} aria-hidden />}
                aria-label={`Disconnect ${bankName(c)}`}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}

      {some && (
        <p className="text-xs leading-relaxed text-fg-muted">
          Moved money between your own accounts? Those deposits are not income. The list below flags the ones that look like transfers; mark them
          &ldquo;Transfer between your own accounts&rdquo; so they are not counted.
        </p>
      )}

      <p className="border-t border-border pt-3 text-xs leading-relaxed text-fg-muted">
        Connecting asks Plaid to share that bank&rsquo;s account and transaction details with {BRAND.name}, under Plaid&rsquo;s{' '}
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
        . We never see your bank login, and you can disconnect any bank at any time.
      </p>
      {confirmDialog}
    </Card>
  );
}

/**
 * Plaid Link, mounted only after "Connect" is pressed: mounting it is what
 * loads Plaid's script, and it opens Plaid's window as soon as it is ready.
 * It unmounts again when the window closes, which also avoids Plaid's
 * "embedded more than once" warning.
 */
function PlaidLinkOpener({ token, onSuccess, onExit }: { token: string; onSuccess: (publicToken: string) => Promise<void>; onExit: () => void }) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken) => {
      onExit();
      void onSuccess(publicToken);
    },
    onExit: () => onExit(),
  });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}
