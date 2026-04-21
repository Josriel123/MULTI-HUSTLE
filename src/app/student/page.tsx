"use client"

import React, { useState, useEffect } from 'react';
import { BookOpen, AlertCircle, Save, TrendingDown, Loader2 } from 'lucide-react';

export default function StudentHub() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [box1, setBox1] = useState('');
  const [box5, setBox5] = useState('');
  
  const [box1E, setBox1E] = useState('');
  const [savingE, setSavingE] = useState(false);
  
  const [summaryData, setSummaryData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const [formRes, summaryRes, formERes] = await Promise.all([
          fetch('/api/student/form1098'),
          fetch('/api/dashboard/summary'),
          fetch('/api/student/1098e')
        ]);
        
        const formData = await formRes.json();
        const summary = await summaryRes.json();
        const formEData = await formERes.json();

        if (formData.form) {
          setBox1(formData.form.box1.toString());
          setBox5(formData.form.box5.toString());
        }
        if (formEData.form) {
          setBox1E(formEData.form.box1.toString());
        }
        if (summary.sources) {
          setSummaryData(summary);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/student/form1098', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box1: Number(box1), box5: Number(box5) })
      });
      if (res.ok) {
        alert("Form 1098-T Saved!");
        window.location.reload(); // Refresh to ensure dashboard and math updates perfectly
      }
    } catch (e) {
      alert("Error saving Form");
    }
    setSaving(false);
  };

  const handleSaveE = async () => {
    setSavingE(true);
    try {
      const res = await fetch('/api/student/1098e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box1: Number(box1E) })
      });
      if (res.ok) {
        alert("Form 1098-E Saved!");
        window.location.reload(); 
      }
    } catch (e) {
      alert("Error saving Form");
    }
    setSavingE(false);
  };


  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
  };

  const hasOverflow = Number(box5) > Number(box1);
  const taxableGross = hasOverflow ? Number(box5) - Number(box1) : 0;
  
  // From our backend calculation
  const textbookSavings = summaryData?.sources?.scholarships?.textbookSavings || 0;
  const ultimateTaxableScholarship = Math.max(0, taxableGross - textbookSavings);
  
  // Demonstration of standard SE logic
  // A standard software might accidentally charge 15.3% SE Tax on this $20,000 refund because it was in Plaid.
  const mistakenSETax = ultimateTaxableScholarship * 0.153;
  
  const loanInterestDeducted = summaryData?.sources?.scholarships?.loanInterestDeduction || 0;
  const loanEstimatedSavings = loanInterestDeducted * 0.12; // 12% standard income tax assumed

  return (
    <div className="animate-slide-up" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem', filter: loading ? 'blur(4px)' : 'none', transition: 'filter 0.3s' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--accent-blue)', display: 'flex' }}>
          <BookOpen size={28} color="var(--accent-blue)" />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>1098-T Tax Override</h1>
          <p className="text-secondary" style={{ fontSize: '1.1rem' }}>Bypass the 15.3% Self-Employment Tax penalty on your "Full Ride" scholarship overflow.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Input Form */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Enter Form 1098-T
          </h2>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }} className="text-secondary">
              Box 1: Payments received for qualified tuition
            </label>
            <input 
              type="number" 
              value={box1} 
              onChange={e => setBox1(e.target.value)}
              placeholder="e.g. 10000"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '1.1rem' }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }} className="text-secondary">
              Box 5: Scholarships or Grants
            </label>
            <input 
              type="number" 
              value={box5} 
              onChange={e => setBox5(e.target.value)}
              placeholder="e.g. 30000"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '1.1rem' }}
            />
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            style={{ 
              width: '100%', 
              background: 'var(--accent-blue)', 
              color: '#000', 
              padding: '1rem', 
              borderRadius: '8px', 
              fontSize: '1.1rem',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: saving ? 'wait' : 'pointer',
              border: 'none',
              transition: 'all 0.2s'
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
            Synchronize into Tax Engine
          </button>
        </div>

        {/* Verification Engine */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            SE Tax Shield Verification
          </h2>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span className="text-secondary">Raw Taxable Overflow (Box 5 - Box 1)</span>
              <strong>{formatCurrency(taxableGross)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0, 200, 230, 0.05)', borderRadius: '8px', border: '1px dashed var(--accent-blue)' }}>
              <span style={{ color: 'var(--accent-blue)' }}>"Textbook Loophole" Auto-Detected</span>
              <strong style={{ color: 'var(--accent-blue)' }}>-{formatCurrency(textbookSavings)}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span className="text-secondary">Final Taxable Scholarship</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {formatCurrency(ultimateTaxableScholarship)}
              </div>
            </div>
          </div>
          
          {hasOverflow && (
            <div className="animate-slide-up" style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0, 200, 5, 0.05)', border: '1px solid var(--accent-green)', borderRadius: '8px', display: 'flex', gap: '0.5rem', color: 'var(--accent-green)' }}>
              <TrendingDown size={28} style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: '1.1rem', marginBottom: '0.2rem', display: 'block' }}>Engine Protected: {formatCurrency(mistakenSETax)}</strong>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
                  Generic gig-worker apps would misclassify this University refund as un-taxed income. By isolating this as academic overflow, we legally bypassed the 15.3% Self-Employment mandate!
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 1098-E Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', marginTop: '2rem' }}>
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--accent-green)', display: 'flex' }}>
          <BookOpen size={28} color="var(--accent-green)" />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>1098-E Loan Interest</h1>
          <p className="text-secondary" style={{ fontSize: '1.1rem' }}>Automatically trigger a lucrative $2,500 'Above-the-Line' tax deduction against your Gig Income.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* 1098-E Input Form */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Enter Form 1098-E
          </h2>
          
          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }} className="text-secondary">
              Box 1: Student Loan Interest Received by Lender
            </label>
            <input 
              type="number" 
              value={box1E} 
              onChange={e => setBox1E(e.target.value)}
              placeholder="e.g. 1500"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '1.1rem' }}
            />
          </div>

          <button 
            onClick={handleSaveE}
            disabled={savingE}
            style={{ 
              width: '100%', 
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
              cursor: savingE ? 'wait' : 'pointer',
              border: 'none',
              transition: 'all 0.2s'
            }}
          >
            {savingE ? <Loader2 className="animate-spin" /> : <Save size={18} />}
            Activate Interest Deduction
          </button>
        </div>

        {/* 1098-E Verification Engine */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Above-the-Line Verification
          </h2>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span className="text-secondary">Reported Interest Paid</span>
              <strong>{formatCurrency(Number(box1E) || 0)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0, 200, 5, 0.05)', borderRadius: '8px', border: '1px dashed var(--accent-green)' }}>
              <span style={{ color: 'var(--accent-green)' }}>IRS Cap Enforced (Max $2,500)</span>
              <strong style={{ color: 'var(--accent-green)' }}>-{formatCurrency(loanInterestDeducted)}</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span className="text-secondary">Estimated Cash Savings</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                {formatCurrency(loanEstimatedSavings)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Context */}
      <div className="card" style={{ padding: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', borderTop: '4px solid var(--border-color)' }}>
        <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
          <AlertCircle size={24} color="var(--text-secondary)" />
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>How the "Taxable Overflow" works</h3>
          <p className="text-secondary" style={{ lineHeight: 1.6, maxWidth: '90%' }}>
            If your scholarships (Box 5) exceed your tuition (Box 1), you are considered to have a "Full Ride" payout. The IRS requires you to report the excess overflow as standard taxable income since you use it to pay for generic living expenses (rent, food). However, you DO NOT owe the brutal 15.3% Self-Employment (SE) Tax on it like you do for your freelance gig-work (Uber, DoorDash). This dashboard mathematically segregates your income streams to ensure you aren't severely overcharged by the IRS.
          </p>
        </div>
      </div>

    </div>
  );
}
