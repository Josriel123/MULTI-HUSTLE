"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link as LinkIcon, Loader2, CheckCircle } from 'lucide-react';

export default function PlaidLinkButton() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 1. Check local persistence first
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLinkedAlready = localStorage.getItem('plaid_linked_state');
      if (isLinkedAlready === 'true') {
        setLinked(true);
      }
    }
  }, []);

  // 2. Fetch Link Token from our backend
  useEffect(() => {
    const createToken = async () => {
      try {
        const response = await fetch('/api/plaid/create_link_token', { method: 'POST' });
        const data = await response.json();
        setToken(data.link_token);
      } catch (err) {
        console.error("Failed to generate link token", err);
      } finally {
        setLoading(false);
      }
    };
    createToken();
  }, []);

  // 2. Exchange Public Token for Access Token
  const onSuccess = useCallback(async (public_token: string, metadata: any) => {
    try {
      setLoading(true);
      const res = await fetch('/api/plaid/exchange_public_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      const data = await res.json();
      if (data.success) {
        setLinked(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('plaid_linked_state', 'true');
        }
      }
    } catch (err) {
      console.error("Failed to exchange token", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully synced ${data.count} transactions!`);
        window.location.reload();
      } else {
        if (data.error.includes('No Plaid connection found')) {
          alert('You need to actually link your bank first! The component remembered you from earlier.');
          localStorage.removeItem('plaid_linked_state');
          window.location.reload();
        } else {
          alert('Failed to sync: ' + data.error);
        }
      }
    } catch (e) {
      alert('Error during sync');
    }
    setSyncing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {linked ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, cursor: 'default' }}>
            <CheckCircle size={18} />
            Bank Account Connected
          </button>
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
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-blue)', color: '#000', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, cursor: (!ready || loading) ? 'wait' : 'pointer', opacity: (!ready || loading) ? 0.7 : 1 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LinkIcon size={18} />}
          Securely Connect Bank
        </button>
      )}
    </div>
  );
}
