"use client"

import React, { useState, useEffect } from 'react';
import { Home, TrendingDown, Save, Loader2, Info } from 'lucide-react';

export default function HomeOfficeHub() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [totalSqFt, setTotalSqFt] = useState('');
  const [officeSqFt, setOfficeSqFt] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [utilitiesAmount, setUtilitiesAmount] = useState('');
  
  const [summaryData, setSummaryData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const [formRes, summaryRes] = await Promise.all([
          fetch('/api/deductions/office'),
          fetch('/api/dashboard/summary')
        ]);
        
        const formData = await formRes.json();
        const summary = await summaryRes.json();

        if (formData.form) {
          setTotalSqFt(formData.form.totalSqFt.toString());
          setOfficeSqFt(formData.form.officeSqFt.toString());
          setRentAmount(formData.form.rentAmount.toString());
          setUtilitiesAmount(formData.form.utilitiesAmount.toString());
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
      const res = await fetch('/api/deductions/office', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          totalSqFt: Number(totalSqFt), 
          officeSqFt: Number(officeSqFt),
          rentAmount: Number(rentAmount),
          utilitiesAmount: Number(utilitiesAmount)
        })
      });
      if (res.ok) {
        alert("Space Loophole Saved!");
        window.location.reload(); 
      } else {
        alert("Failed to save values");
      }
    } catch (e) {
      alert("Error saving Form");
    }
    setSaving(false);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
  };

  // UI Re-calculation strictly for visual breakdown
  const tSq = Number(totalSqFt) || 1; 
  const oSq = Number(officeSqFt) || 0;
  const rent = Number(rentAmount) || 0;
  const util = Number(utilitiesAmount) || 0;
  
  const simplified = Math.min(oSq, 300) * 5;
  
  const businessPercentage = oSq / tSq;
  const annualHousingCost = (rent + util) * 12;
  const standard = Math.round(annualHousingCost * businessPercentage);

  // Dynamic real-time calculation instead of waiting for the database to sync
  const appliedDeduction = Math.max(simplified, standard);

  // Assuming top tax liability reduction
  const estTaxSavings = appliedDeduction * 0.273; // 15.3% SE + 12% Income

  return (
    <div className="animate-slide-up" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem', filter: loading ? 'blur(4px)' : 'none', transition: 'filter 0.3s' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid #c2410c', display: 'flex' }}>
          <Home size={28} color="#c2410c" />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Space & Assets Exemption</h1>
          <p className="text-secondary" style={{ fontSize: '1.1rem' }}>Convert your personal rent and utilities into a legal Schedule C tax shield.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Input Form */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Real Estate Specs
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }} className="text-secondary">
                Total Apartment SqFt
              </label>
              <input 
                type="number" 
                value={totalSqFt} 
                onChange={e => setTotalSqFt(e.target.value)}
                placeholder="e.g. 1000"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }} className="text-secondary">
                Home Office SqFt
              </label>
              <input 
                type="number" 
                value={officeSqFt} 
                onChange={e => setOfficeSqFt(e.target.value)}
                placeholder="e.g. 150"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid #c2410c', color: '#fff' }}
              />
            </div>
          </div>

          <h2 style={{ fontSize: '1.3rem', margin: '2rem 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Housing Overhead (Monthly)
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }} className="text-secondary">
                Monthly Rent / Mortgage
              </label>
              <input 
                type="number" 
                value={rentAmount} 
                onChange={e => setRentAmount(e.target.value)}
                placeholder="e.g. 2000"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }} className="text-secondary">
                Utilities & Internet
              </label>
              <input 
                type="number" 
                value={utilitiesAmount} 
                onChange={e => setUtilitiesAmount(e.target.value)}
                placeholder="e.g. 250"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff' }}
              />
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            style={{ 
              width: '100%', 
              background: '#ea580c', 
              color: '#fff', 
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
            Synchronize Loophole
          </button>
        </div>

        {/* Verification Engine */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Algorithm Comparison
          </h2>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ display: 'block' }}>Simplified Method</strong>
                <span className="text-secondary" style={{ fontSize: '0.85rem' }}>$5 x {Math.min(oSq, 300)} SqFt Max</span>
              </div>
              <strong style={{ fontSize: '1.1rem' }}>{formatCurrency(simplified)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <strong style={{ display: 'block' }}>Standard Method</strong>
                <span className="text-secondary" style={{ fontSize: '0.85rem' }}>{(businessPercentage * 100).toFixed(1)}% of Overhead</span>
              </div>
              <strong style={{ fontSize: '1.1rem' }}>{formatCurrency(standard)}</strong>
            </div>
            
            <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span className="text-secondary">Engine Applied Shield (Maximum)</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f97316' }}>
                  {formatCurrency(appliedDeduction)}
                </div>
              </div>
              
              <div className="animate-slide-up" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid #f97316', borderRadius: '8px', display: 'flex', gap: '0.5rem', color: '#ffedd5' }}>
                <TrendingDown size={28} style={{ flexShrink: 0, color: '#f97316' }} />
                <div>
                  <strong style={{ fontSize: '1.1rem', marginBottom: '0.2rem', display: 'block', color: '#f97316' }}>Est. Tax Annihilation: ~{formatCurrency(estTaxSavings)}</strong>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.4, color: '#fed7aa' }}>
                    By applying this spatial loophole, you are legally sheltering <strong>{appliedDeduction > 0 ? formatCurrency(appliedDeduction) : '$0'}</strong> of your Gig Profit from the 15.3% IRS Self-Employment bracket.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Educational Context */}
      <div className="card" style={{ padding: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', borderTop: '4px solid #c2410c' }}>
        <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
          <Info size={24} color="#f97316" />
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>W-2 Worker Exclusion Warning</h3>
          <p className="text-secondary" style={{ lineHeight: 1.6, maxWidth: '90%' }}>
            The Tax Cuts and Jobs Act (TCJA) banned W-2 corporate employees from utilizing this deduction. <strong>However, because you generate 1099 Gig Income (Delivery, Freelance)</strong>, you are legally entitled to convert a portion of your personal living expenses into a structural business loss. Our engine will aggressively compare the Simplified vs Standard method and automatically file whichever yields the highest tax liability reduction.
          </p>
        </div>
      </div>

    </div>
  );
}
