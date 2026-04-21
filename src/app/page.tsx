"use client"

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BrainCircuit, Link2, TrendingUp, AlertCircle, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import PlaidLinkButton from '@/components/PlaidLinkButton';

export default function Dashboard() {
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  
  // Dynamic State
  const [chartData, setChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ gross: 0, net: 0, taxLiability: 0 });
  const [sources, setSources] = useState({ 
    freelance: { income: 0, deductions: 0 }, 
    delivery: { income: 0, mileage: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryRes, chartRes] = await Promise.all([
          fetch('/api/dashboard/summary'),
          fetch('/api/dashboard/chart')
        ]);
        
        const summaryData = await summaryRes.json();
        const chartDataObj = await chartRes.json();
        
        if (summaryData.summary) {
          setSummary(summaryData.summary);
          setSources(summaryData.sources);
        }
        setChartData(chartDataObj);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', filter: loading ? 'blur(4px)' : 'none', transition: 'filter 0.3s' }}>
      
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Overview</h1>
        <p className="text-secondary" style={{ fontSize: '1.1rem' }}>Welcome back. Deep insights loaded from your database.</p>
      </div>

      {/* Onboarding & Education Widget */}
      {onboardingOpen && (
        <div className="card animate-slide-up" style={{ display: 'flex', border: '1px solid var(--accent-blue)', background: 'rgba(0, 200, 230, 0.05)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-blue)' }}></div>
          <div style={{ flex: 1 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
               <BrainCircuit color="var(--accent-blue)" size={24} />
               <h2 style={{ fontSize: '1.3rem' }}>Setup Automations</h2>
             </div>
             <p className="text-secondary" style={{ marginBottom: '1.5rem', lineHeight: 1.5, maxWidth: '80%' }}>
               Connect your gig and bank accounts to unlock <strong>Tax-Loss Harvesting</strong> and <strong>Automated Mileage</strong> tracking. We automatically detect your expenses to lower your taxable burden so you can keep more of what you earn.
             </p>
             <PlaidLinkButton />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', paddingRight: '2rem' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--accent-green)" />
                <span style={{ fontSize: '0.9rem' }}>Database Connected</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <AlertCircle size={16} color="var(--accent-red)" />
                <span style={{ fontSize: '0.9rem' }}>Uber API Pending</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gamified Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} className="animate-slide-up">
        
        {/* True Net Card */}
        <div className="card" style={{ borderTop: '4px solid var(--accent-green)' }}>
          <h3 className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>True Net Income</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
            {formatCurrency(summary.net)}
            <span style={{ fontSize: '1rem', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', paddingBottom: '0.5rem' }}>
              <TrendingUp size={16} style={{ marginRight: '0.25rem' }}/> +12%
            </span>
          </div>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>"Safe-to-Spend" after est. taxes & mileage</p>
        </div>

        <div className="card" style={{ borderTop: '4px solid var(--border-color)' }}>
          <h3 className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross Income</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>{formatCurrency(summary.gross)}</div>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Before 1099 deductions</p>
        </div>

        <div className="card" style={{ borderTop: '4px solid var(--accent-red)', background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(255, 80, 0, 0.05) 100%)' }}>
          <h3 className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Tax Liability</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-red)' }}>{formatCurrency(summary.taxLiability)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Quarterly due in 14 days</p>
            <button style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-primary)' }}>Pay Now</button>
          </div>
        </div>

      </div>

      {/* Main Chart Section */}
      <div className="card animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Income vs Net Progression</h3>
            <p className="text-secondary" style={{ fontSize: '0.9rem' }}>Visualizing the power of targeted deductions over time.</p>
          </div>
          <select style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', outline: 'none' }}>
            <option>Year to Date</option>
            <option>Last 6 Months</option>
            <option>Last 30 Days</option>
          </select>
        </div>
        
        <div style={{ width: '100%', height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--border-color)" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="var(--border-color)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Area type="monotone" dataKey="gross" stroke="var(--text-secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorGross)" />
              <Area type="monotone" dataKey="net" stroke="var(--accent-green)" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Freelance Dev Income</h3>
            <Zap size={20} color="var(--accent-green)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>{formatCurrency(sources.freelance.income)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            <span>Hardware written off: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(sources.freelance.deductions)}</strong></span>
          </div>
          <button onClick={() => window.location.href='/deductions'} style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            Log New Hardware <ArrowRight size={16} />
          </button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Delivery Gig Income</h3>
            <Zap size={20} color="var(--accent-green)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem' }}>{formatCurrency(sources.delivery.income)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            <span>Automated Mileage logged: <strong style={{ color: 'var(--text-primary)' }}>{sources.delivery.mileage} mi</strong></span>
          </div>
          <button onClick={() => window.location.href='/deductions'} style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            Manual Route Entry <ArrowRight size={16} />
          </button>
        </div>

      </div>

    </div>
  );
}
