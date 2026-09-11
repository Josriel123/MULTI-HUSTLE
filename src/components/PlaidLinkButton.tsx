'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link as LinkIcon, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { InlineStatus } from './ui/InlineStatus';

export default function PlaidLinkButton() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  // Connection state comes from the database, not localStorage. The old
  // version trusted a localStorage flag that outlived the actual connection.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [statusRes, tokenRes] = await Promise.all([
          fetch('/api/plaid/status'),
          fetch('/api/plaid/create_link_token', { method: 'POST' }),
        ]);

        if (cancelled) return;

        if (statusRes.ok) {
          const status = await statusRes.json();
          setLinked(Boolean(status.linked));
        }

        if (tokenRes.ok) {
          const data = await tokenRes.json();
          setToken(data.link_token ?? null);
        }
      } catch (err) {
        console.error('Failed to initialise Plaid link', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSuccess = useCallback(async (public_token: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/plaid/exchange_public_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLinked(true);
        setMessage({ text: 'Bank linked. Sync to import transactions.', kind: 'ok' });
      } else {
        setMessage({ text: data.error ?? 'Failed to link bank.', kind: 'error' });
      }
    } catch {
      setMessage({ text: 'Failed to link bank.', kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({ token, onSuccess });

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        const parts = [`Synced ${data.count} transaction${data.count === 1 ? '' : 's'}`];
        if (data.removed > 0) parts.push(`${data.removed} removed`);
        setMessage({ text: `${parts.join(', ')}.`, kind: 'ok' });
        // Refresh so the dashboard reflects the new rows.
        window.location.reload();
      } else if (res.status === 404) {
        // Server says there's no connection: correct our state rather than
        // leaving the user with a button that always fails.
        setLinked(false);
        setMessage({ text: 'No linked bank found. Please connect one.', kind: 'error' });
      } else {
        setMessage({ text: data.error ?? 'Sync failed.', kind: 'error' });
      }
    } catch {
      setMessage({ text: 'Sync failed.', kind: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {linked ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-11 items-center gap-2 rounded-lg border border-accent bg-surface px-4 text-sm font-semibold text-accent">
            <CheckCircle size={18} aria-hidden />
            Bank account connected
          </div>
          <Button variant="info" onClick={handleSync} loading={syncing} icon={<RefreshCw size={16} aria-hidden />}>
            {syncing ? 'Syncing…' : 'Sync transactions'}
          </Button>
        </div>
      ) : (
        <Button variant="info" onClick={() => open()} disabled={!ready} loading={loading} icon={<LinkIcon size={18} aria-hidden />}>
          Connect a bank (Plaid sandbox)
        </Button>
      )}

      {message && <InlineStatus kind={message.kind}>{message.text}</InlineStatus>}
    </div>
  );
}
