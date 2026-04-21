"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Search, Calendar, FileText, ArrowLeft, Loader2, DollarSign, Activity } from 'lucide-react';
import Link from 'next/link';

export default function DeductionLog() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(true);
  
  const [formData, setFormData] = useState({
    amount: '',
    type: 'Expense',
    description: '',
    sourceName: 'Freelance Dev Income',
    taxDeductible: true
  });

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount) return;
    
    setLoading(true);
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      // Clear form and refetch locally
      setFormData({ ...formData, amount: '', description: '' });
      await fetchTransactions();
      
      // Call router.refresh so dashboard caches are busted if we hit back
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="animate-slide-up" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/" style={{ padding: '0.5rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', color: 'var(--text-primary)' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Transaction Simulator</h1>
          <p className="text-secondary" style={{ fontSize: '1rem' }}>Log a transaction to test the tax engine, then view the ledger below.</p>
        </div>
      </div>

      {/* Simulator Form */}
      <div className="card" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Amount ($)</label>
              <input 
                type="number" 
                placeholder="2500"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '1.1rem', outline: 'none' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Transaction Type</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value, taxDeductible: e.target.value === 'Expense'})}
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '1.1rem', outline: 'none' }}
              >
                <option value="Expense">Expense / Deduction</option>
                <option value="Income">Gross Income Payout</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Description / Vendor</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem' }}>
              <FileText size={18} color="var(--text-secondary)" />
              <input 
                type="text" 
                placeholder="e.g. M3 Macbook Pro, Uber Payout..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                style={{ width: '100%', padding: '0.75rem 0.75rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Linked Income Source</label>
            <select 
              value={formData.sourceName}
              onChange={e => setFormData({...formData, sourceName: e.target.value})}
              style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '1.1rem', outline: 'none' }}
            >
              <option value="Freelance Dev Income">Freelance Dev Income</option>
              <option value="Delivery Gig Income">Delivery Gig Income</option>
              <option value="Trading & Investments">Trading & Investments</option>
            </select>
          </div>

          {formData.type === 'Expense' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(0, 200, 5, 0.05)', border: '1px solid var(--accent-green)', borderRadius: '8px', marginTop: '0.5rem' }}>
               <input 
                 type="checkbox" 
                 checked={formData.taxDeductible}
                 onChange={e => setFormData({...formData, taxDeductible: e.target.checked})}
                 style={{ width: '20px', height: '20px', accentColor: 'var(--accent-green)' }}
                 id="taxDeduct"
               />
               <label htmlFor="taxDeduct" style={{ color: 'var(--text-primary)', cursor: 'pointer' }}>
                 Mark as Tax Deductible <span className="text-secondary" style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>(Will lower liability directly)</span>
               </label>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />

          <button 
            type="submit"
            disabled={loading}
            style={{ 
              background: formData.type === 'Income' ? 'var(--accent-blue)' : 'var(--accent-green)', 
              color: '#000', 
              padding: '1rem', 
              borderRadius: '8px', 
              fontSize: '1.1rem',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <Loader2 className="animate-spin" /> : <PlusCircle />}
            {formData.type === 'Income' ? 'Log Income & Refresh' : 'Log Deduction & Refresh'}
          </button>
        </form>
      </div>

      {/* Transaction History Ledger */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={20} color="var(--accent-blue)" /> Macro Ledger
        </h2>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Showing {transactions.length} total entries</div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {fetchingHistory ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto', marginBottom: '1rem' }} />
            <p>Loading historical records...</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Source</th>
                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i === transactions.length - 1 ? 'none' : '1px solid var(--border-color)', transition: 'background 0.2s', ...({ '&:hover': { background: 'var(--bg-primary)' } } as any) }}>
                  <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{t.description || 'Auto Sync'}</div>
                    {t.taxDeductible && t.type === 'Expense' ? (
                      <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'rgba(0,200,5,0.1)', color: 'var(--accent-green)', borderRadius: '4px', border: '1px solid var(--accent-green)' }}>Tax Deductible</span>
                    ) : t.type === 'Income' ? (
                      <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'rgba(0,200,230,0.1)', color: 'var(--accent-blue)', borderRadius: '4px', border: '1px solid var(--accent-blue)' }}>Income</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>Standard Expense</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                    {t.incomeSource?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: t.type === 'Income' ? 'var(--text-primary)' : 'var(--text-primary)' }}>
                    {t.type === 'Income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
