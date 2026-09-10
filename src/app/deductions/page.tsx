"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  FileText,
  ArrowLeft,
  Loader2,
  Activity,
  Car,
  Trash2,
  Edit2,
  AlertTriangle,
  Lock,
  X
} from 'lucide-react';
import Link from 'next/link';

interface IncomeSourceItem {
  id?: string;
  name: string;
  type: string;
}

interface TransactionItem {
  id: string;
  amount: string;
  type: string;
  date: string;
  description: string | null;
  taxDeductible: boolean;
  category: string | null;
  plaidTransactionId: string | null;
  incomeSource: IncomeSourceItem | null;
}

interface MileageLogItem {
  id: string;
  date: string;
  miles: string;
  purpose: string | null;
  incomeSourceId: string | null;
  incomeSource: IncomeSourceItem | null;
  ratePerMile: string;
  deduction: string;
}

const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'advertising', label: 'Advertising (Schedule C line 8)' },
  { value: 'car_and_truck', label: 'Car and truck actual expenses (Schedule C line 9)' },
  { value: 'commissions_and_fees', label: 'Commissions and fees (Schedule C line 10)' },
  { value: 'contract_labor', label: 'Contract labor (Schedule C line 11)' },
  { value: 'insurance', label: 'Business insurance (Schedule C line 15)' },
  { value: 'interest', label: 'Business interest (Schedule C line 16b)' },
  { value: 'legal_and_professional', label: 'Legal & professional (Schedule C line 17)' },
  { value: 'office_expense', label: 'Office expense (Schedule C line 18)' },
  { value: 'rent_or_lease', label: 'Rent or lease (Schedule C line 20b)' },
  { value: 'repairs_and_maintenance', label: 'Repairs & maintenance (Schedule C line 21)' },
  { value: 'supplies', label: 'Supplies (Schedule C line 22)' },
  { value: 'taxes_and_licenses', label: 'Business taxes & licenses (Schedule C line 23)' },
  { value: 'travel', label: 'Travel (Schedule C line 24a)' },
  { value: 'meals', label: 'Business meals 50% limit (Schedule C line 24b)' },
  { value: 'utilities', label: 'Business utilities (Schedule C line 25)' },
  { value: 'software_and_subscriptions', label: 'Software & subscriptions (Schedule C line 27a)' },
  { value: 'other_business_expense', label: 'Other business expense (Schedule C line 27a)' },
  { value: 'equipment', label: 'Equipment under $2,500 de minimis (Schedule C line 27a)' },
  { value: 'education_required_materials', label: 'Course books & required supplies (§117)' },
  { value: 'personal', label: 'Personal (not deductible)' },
];

const INCOME_CATEGORY_OPTIONS = [
  { value: 'business_income', label: 'Business gross receipts (Schedule C line 1)' },
  { value: 'other_taxable_income', label: 'Other taxable non-business income (Schedule 1 line 8z)' },
  { value: 'loan_proceeds', label: 'Loan disbursement (non-taxable)' },
  { value: 'transfer', label: 'Transfer between own accounts (non-taxable)' },
  { value: 'refund', label: 'Refund of purchase (non-taxable)' },
  { value: 'gift', label: 'Gift received (non-taxable)' },
  { value: 'scholarship_refund', label: 'Scholarship refund (counted on 1098-T)' },
  { value: 'investment_proceeds', label: 'Investment sale (Schedule D / capital gains)' },
  { value: 'w2_paycheck', label: 'W-2 paycheck (reported on Form W-2)' },
];

export default function DeductionLog() {
  const router = useRouter();
  const [loadingTx, setLoadingTx] = useState(false);
  const [loadingMileage, setLoadingMileage] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLogItem[]>([]);
  const [totalMiles, setTotalMiles] = useState('0.00');
  const [totalMileageDeduction, setTotalMileageDeduction] = useState('0.00');
  const [fetchingHistory, setFetchingHistory] = useState(true);

  // Active tab: 'transactions' | 'mileage'
  const [activeTab, setActiveTab] = useState<'transactions' | 'mileage'>('transactions');

  // Transaction form state
  const [txFormData, setTxFormData] = useState({
    amount: '',
    type: 'Expense',
    description: '',
    category: 'other_business_expense',
    sourceName: 'Freelance Dev Income',
    taxDeductible: true,
    date: new Date().toISOString().slice(0, 10),
  });

  // Mileage form state
  const [mileageFormData, setMileageFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    miles: '',
    purpose: '',
    incomeSourceId: '',
  });

  // Transaction Edit Modal state
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    date: '',
    description: '',
    category: '',
    taxDeductible: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchAllData = async () => {
    try {
      const [txRes, mileRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/mileage'),
      ]);
      const txData = await txRes.json();
      const mileData = await mileRes.json();

      if (Array.isArray(txData)) {
        setTransactions(txData);
      }
      if (mileData.logs) {
        setMileageLogs(mileData.logs);
        setTotalMiles(mileData.totalMiles || '0.00');
        setTotalMileageDeduction(mileData.totalDeduction || '0.00');
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const [txRes, mileRes] = await Promise.all([
          fetch('/api/transactions'),
          fetch('/api/mileage'),
        ]);
        const txData = await txRes.json();
        const mileData = await mileRes.json();

        if (!ignore) {
          if (Array.isArray(txData)) {
            setTransactions(txData);
          }
          if (mileData.logs) {
            setMileageLogs(mileData.logs);
            setTotalMiles(mileData.totalMiles || '0.00');
            setTotalMileageDeduction(mileData.totalDeduction || '0.00');
          }
        }
      } catch (err) {
        console.error('Failed to initialize ledger data:', err);
      } finally {
        if (!ignore) {
          setFetchingHistory(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txFormData.amount) return;

    setLoadingTx(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txFormData),
      });
      if (res.ok) {
        setTxFormData({
          ...txFormData,
          amount: '',
          description: '',
        });
        await fetchAllData();
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to log transaction:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  const handleMileageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mileageFormData.miles) return;

    setLoadingMileage(true);
    try {
      const res = await fetch('/api/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mileageFormData),
      });
      if (res.ok) {
        setMileageFormData({
          date: new Date().toISOString().slice(0, 10),
          miles: '',
          purpose: '',
          incomeSourceId: '',
        });
        await fetchAllData();
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to log mileage:', err);
    } finally {
      setLoadingMileage(false);
    }
  };

  const handleDeleteMileage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trip log?')) return;
    try {
      const res = await fetch(`/api/mileage/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAllData();
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to delete mileage log:', err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAllData();
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    }
  };

  const startEditingTransaction = (t: TransactionItem) => {
    setEditingTx(t);
    setEditError(null);
    setEditFormData({
      amount: t.amount,
      date: new Date(t.date).toISOString().slice(0, 10),
      description: t.description || '',
      category: t.category || (t.type === 'Income' ? 'business_income' : 'other_business_expense'),
      taxDeductible: t.taxDeductible,
    });
  };

  const handleSaveTransactionEdit = async () => {
    if (!editingTx) return;
    setSavingEdit(true);
    setEditError(null);

    const isPlaid = Boolean(editingTx.plaidTransactionId);
    const payload: Record<string, unknown> = {
      category: editFormData.category,
      taxDeductible: editFormData.taxDeductible,
    };

    if (!isPlaid) {
      payload.amount = editFormData.amount;
      payload.date = editFormData.date;
      payload.description = editFormData.description;
    }

    try {
      const res = await fetch(`/api/transactions/${editingTx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to save changes');
      } else {
        setEditingTx(null);
        await fetchAllData();
        router.refresh();
      }
    } catch (err) {
      console.error('Failed to update transaction:', err);
      setEditError('Network error while updating transaction.');
    } finally {
      setSavingEdit(false);
    }
  };

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? Number(val) : val;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num || 0);
  };

  return (
    <div className="animate-slide-up" style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link
          href="/"
          style={{
            padding: '0.5rem',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            color: 'var(--text-primary)',
          }}
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Deductions &amp; Mileage Hub</h1>
          <p className="text-secondary" style={{ fontSize: '1rem' }}>
            Log hardware expenses, audit transactions, and record Schedule C business mileage.
          </p>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('transactions')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            background: activeTab === 'transactions' ? 'var(--accent-blue)' : 'var(--bg-card)',
            color: activeTab === 'transactions' ? '#000' : 'var(--text-primary)',
            fontWeight: 600,
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Activity size={18} /> Transaction Ledger
        </button>
        <button
          onClick={() => setActiveTab('mileage')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            background: activeTab === 'mileage' ? 'var(--accent-green)' : 'var(--bg-card)',
            color: activeTab === 'mileage' ? '#000' : 'var(--text-primary)',
            fontWeight: 600,
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Car size={18} /> Business Mileage (Schedule C Part IV)
        </button>
      </div>

      {/* TAB 1: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <>
          {/* Simulator Form */}
          <div className="card" style={{ padding: '2rem', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Log New Transaction</h2>
            <form onSubmit={handleTransactionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="250.00"
                    value={txFormData.amount}
                    onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      outline: 'none',
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Transaction Type</label>
                  <select
                    value={txFormData.type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setTxFormData({
                        ...txFormData,
                        type: nextType,
                        taxDeductible: nextType === 'Expense',
                        category: nextType === 'Income' ? 'business_income' : 'other_business_expense',
                      });
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      outline: 'none',
                    }}
                  >
                    <option value="Expense">Expense / Deduction</option>
                    <option value="Income">Gross Income Payout</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    value={txFormData.date}
                    onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      outline: 'none',
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tax Treatment Category</label>
                  <select
                    value={txFormData.category}
                    onChange={(e) => setTxFormData({ ...txFormData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '1.05rem',
                      outline: 'none',
                    }}
                  >
                    {txFormData.type === 'Income'
                      ? INCOME_CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))
                      : EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Description / Vendor</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0 1rem' }}>
                  <FileText size={18} color="var(--text-secondary)" />
                  <input
                    type="text"
                    placeholder="e.g. M3 Macbook Pro, Client retainer, AWS Cloud..."
                    value={txFormData.description}
                    onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '1.1rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Linked Income Source</label>
                <select
                  value={txFormData.sourceName}
                  onChange={(e) => setTxFormData({ ...txFormData, sourceName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    fontSize: '1.1rem',
                    outline: 'none',
                  }}
                >
                  <option value="Freelance Dev Income">Freelance Dev Income</option>
                  <option value="Delivery Gig Income">Delivery Gig Income</option>
                  <option value="Trading &amp; Investments">Trading &amp; Investments</option>
                </select>
              </div>

              {txFormData.type === 'Expense' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(0, 200, 5, 0.05)', border: '1px solid var(--accent-green)', borderRadius: '8px' }}>
                  <input
                    type="checkbox"
                    checked={txFormData.taxDeductible}
                    onChange={(e) => setTxFormData({ ...txFormData, taxDeductible: e.target.checked })}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent-green)' }}
                    id="taxDeduct"
                  />
                  <label htmlFor="taxDeduct" style={{ color: 'var(--text-primary)', cursor: 'pointer' }}>
                    Mark as Tax Deductible <span className="text-secondary" style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>(Subject to IRC Schedule C rules)</span>
                  </label>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

              <button
                type="submit"
                disabled={loadingTx}
                style={{
                  background: txFormData.type === 'Income' ? 'var(--accent-blue)' : 'var(--accent-green)',
                  color: '#000',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: loadingTx ? 'not-allowed' : 'pointer',
                  opacity: loadingTx ? 0.7 : 1,
                  border: 'none',
                }}
              >
                {loadingTx ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                {txFormData.type === 'Income' ? 'Log Income &amp; Recalculate' : 'Log Expense &amp; Recalculate'}
              </button>
            </form>
          </div>

          {/* Transaction Ledger Table */}
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
                <p>Loading records...</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Description &amp; Category</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Source</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: i === transactions.length - 1 ? 'none' : '1px solid var(--border-color)',
                        background: t.plaidTransactionId ? 'rgba(0, 200, 230, 0.02)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {t.plaidTransactionId && (
                          <span
                            title="Synced via Plaid bank integration"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              color: 'var(--accent-blue)',
                            }}
                          >
                            <Lock size={12} /> Plaid
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{t.description || 'Transaction'}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {t.taxDeductible && t.type === 'Expense' ? (
                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'rgba(0,200,5,0.1)', color: 'var(--accent-green)', borderRadius: '4px', border: '1px solid var(--accent-green)' }}>
                              Deductible
                            </span>
                          ) : t.type === 'Income' ? (
                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'rgba(0,200,230,0.1)', color: 'var(--accent-blue)', borderRadius: '4px', border: '1px solid var(--accent-blue)' }}>
                              Income
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                              Standard Expense
                            </span>
                          )}
                          {t.category && (
                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                              {t.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                        {t.incomeSource?.name || 'Manual'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                        {t.type === 'Income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => startEditingTransaction(t)}
                            title="Edit transaction"
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.4rem',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            title="Delete transaction"
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '0.4rem',
                              color: 'var(--accent-red)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* TAB 2: MILEAGE LOGGER */}
      {activeTab === 'mileage' && (
        <>
          {/* Mileage Summary Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="card" style={{ borderTop: '4px solid var(--accent-green)' }}>
              <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Total Miles Logged
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                {totalMiles} <span style={{ fontSize: '1.2rem' }}>mi</span>
              </div>
              <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Substantiated via Schedule C Part IV log</p>
            </div>

            <div className="card" style={{ borderTop: '4px solid var(--accent-blue)' }}>
              <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Standard Mileage Deduction
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatCurrency(totalMileageDeduction)}
              </div>
              <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Priced at IRS Notice rates (Schedule C line 9)</p>
            </div>
          </div>

          {/* Log Mileage Trip Form */}
          <div className="card" style={{ padding: '2rem', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Car size={20} color="var(--accent-green)" /> Record Business Travel
            </h2>
            <form onSubmit={handleMileageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Trip Date</label>
                  <input
                    type="date"
                    value={mileageFormData.date}
                    onChange={(e) => setMileageFormData({ ...mileageFormData, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      outline: 'none',
                    }}
                    required
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Rate is determined by date (e.g. 70¢/mi in 2025; 72.5¢ Jan–Jun, 76¢ Jul–Dec 2026).
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Miles Driven</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="e.g. 34.5"
                    value={mileageFormData.miles}
                    onChange={(e) => setMileageFormData({ ...mileageFormData, miles: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      outline: 'none',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Business Purpose (Schedule C Part IV Substantiation)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Uber passenger trips, DoorDash restaurant drop-offs, client on-site visit..."
                  value={mileageFormData.purpose}
                  onChange={(e) => setMileageFormData({ ...mileageFormData, purpose: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    fontSize: '1.1rem',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loadingMileage}
                style={{
                  background: 'var(--accent-green)',
                  color: '#000',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: loadingMileage ? 'not-allowed' : 'pointer',
                  opacity: loadingMileage ? 0.7 : 1,
                  border: 'none',
                }}
              >
                {loadingMileage ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                Record Trip &amp; Price Deduction
              </button>
            </form>
          </div>

          {/* Mileage Logged Records Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Car size={20} color="var(--accent-green)" /> Mileage Log Ledger
            </h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Showing {mileageLogs.length} trips</div>
          </div>

          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            {mileageLogs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No trips logged yet. Use the form above to record business mileage.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Purpose</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>Miles</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>IRS Rate</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>Deduction</th>
                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mileageLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: i === mileageLogs.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 500 }}>{log.purpose || 'Business Trip'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.incomeSource?.name || 'Delivery / Business'}</div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                        {log.miles} mi
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        ${log.ratePerMile}/mi
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--accent-green)' }}>
                        +{formatCurrency(log.deduction)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteMileage(log.id)}
                          title="Delete trip log"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '0.4rem',
                            color: 'var(--accent-red)',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* TRANSACTION EDIT MODAL */}
      {editingTx && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: '2rem',
              position: 'relative',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Edit Transaction</h3>
              <button
                onClick={() => setEditingTx(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {Boolean(editingTx.plaidTransactionId) && (
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(0, 200, 230, 0.08)',
                  border: '1px solid var(--accent-blue)',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                }}
              >
                <Lock size={20} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  <strong>Plaid-synced transaction:</strong> Amount and date are locked because the next bank sync would overwrite them. You can adjust the tax category and deductible classification.
                </div>
              </div>
            )}

            {editError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 80, 0, 0.1)',
                  border: '1px solid var(--accent-red)',
                  borderRadius: '8px',
                  color: 'var(--accent-red)',
                  fontSize: '0.9rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={16} /> {editError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Amount ($) {Boolean(editingTx.plaidTransactionId) && '(Locked)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={Boolean(editingTx.plaidTransactionId)}
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: editingTx.plaidTransactionId ? 'rgba(255,255,255,0.05)' : 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '6px',
                      opacity: editingTx.plaidTransactionId ? 0.6 : 1,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Date {Boolean(editingTx.plaidTransactionId) && '(Locked)'}
                  </label>
                  <input
                    type="date"
                    disabled={Boolean(editingTx.plaidTransactionId)}
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: editingTx.plaidTransactionId ? 'rgba(255,255,255,0.05)' : 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '6px',
                      opacity: editingTx.plaidTransactionId ? 0.6 : 1,
                    }}
                  />
                </div>
              </div>

              {!editingTx.plaidTransactionId && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Description</label>
                  <input
                    type="text"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Tax Treatment Category</label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                  }}
                >
                  {editingTx.type === 'Income'
                    ? INCOME_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))
                    : EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                </select>
              </div>

              {editingTx.type === 'Expense' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="modalTaxDeduct"
                    checked={editFormData.taxDeductible}
                    onChange={(e) => setEditFormData({ ...editFormData, taxDeductible: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-green)' }}
                  />
                  <label htmlFor="modalTaxDeduct" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.9rem' }}>
                    Mark as Tax Deductible Business Expense
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  style={{
                    padding: '0.6rem 1.2rem',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTransactionEdit}
                  disabled={savingEdit}
                  style={{
                    padding: '0.6rem 1.4rem',
                    borderRadius: '6px',
                    background: 'var(--accent-blue)',
                    border: 'none',
                    color: '#000',
                    fontWeight: 600,
                    cursor: savingEdit ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {savingEdit && <Loader2 size={16} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
