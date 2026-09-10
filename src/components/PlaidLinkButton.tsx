"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link as LinkIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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
        // Refresh server components so the dashboard reflects the new rows.
        window.location.reload();
      } else if (res.status === 404) {
        // Server says there's no connection — correct our state rather than
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {linked ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600 }}>
            <CheckCircle size={18} />
            Bank Account Connected
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-blue)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1 }}
          >
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => open()}
          disabled={!ready || loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-blue)', color: '#000', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, cursor: !ready || loading ? 'wait' : 'pointer', opacity: !ready || loading ? 0.7 : 1 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LinkIcon size={18} />}
          Securely Connect Bank
        </button>
      )}

      {message && (
        <div
          role="status"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: message.kind === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)' }}
        >
          {message.kind === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
