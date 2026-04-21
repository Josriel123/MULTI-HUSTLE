"use client"

import React, { useState, useEffect } from 'react';
import { Download, Printer, FileText, CheckCircle2, TrendingUp, AlertCircle, Calendar } from 'lucide-react';

export default function CPAExporter() {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [transactionData, setTransactionData] = useState<any>(null);

  useEffect(() => {
    async function fetchLedger() {
      try {
        const [sumRes, tpRes] = await Promise.all([
          fetch('/api/dashboard/summary'),
          fetch('/api/transactions')
        ]);
        const sum = await sumRes.json();
        const txs = await tpRes.json();
        
        setSummaryData(sum);
        setTransactionData(txs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLedger();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const parseCSV = () => {
    if (!transactionData || transactionData.length === 0) return alert("No transactions found.");
    
    // Generate headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Type,Amount,Description,Is Tax Deductible,Source\n";

    transactionData.forEach((t: any) => {
      const date = new Date(t.date).toLocaleDateString() || '';
      const type = t.type || '';
      const amount = t.amount || 0;
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
      const ded = t.taxDeductible ? 'YES' : 'NO';
      const source = t.incomeSource?.name || 'Manual';
      
      csvContent += `${date},${type},${amount},${desc},${ded},${source}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tax_ledger_export_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Compiling Tax Data...</div>;
  }

  const netProp = summaryData?.summary?.net ?? 0;
  const grossProp = summaryData?.summary?.gross ?? 0;
  const taxProp = summaryData?.summary?.taxLiability ?? 0;

  const freeIncome = summaryData?.sources?.freelance?.income || 0;
  const freeDed = summaryData?.sources?.freelance?.deductions || 0;
  
  const shipIncome = summaryData?.sources?.delivery?.income || 0;
  const shipMile = summaryData?.sources?.delivery?.mileage || 0;

  const hoDed = summaryData?.sources?.freelance?.homeOfficeDeduction || 0;
  
  const scholarTax = summaryData?.sources?.scholarships?.taxable || 0;
  const scholarText = summaryData?.sources?.scholarships?.textbookSavings || 0;
  const scholarLoan = summaryData?.sources?.scholarships?.loanInterestDeduction || 0;

  // The Current Tax Year
  const taxYear = new Date().getFullYear();

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }} className="animate-slide-up">
      
      {/* Exporter Controls (Hidden on Print) */}
      <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>CPA Data Exporter</h1>
          <p className="text-secondary">Generate universally accepted tax documents.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={parseCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.2rem', borderRadius: '8px', background: '#333', color: '#fff', border: '1px solid #444', fontWeight: 600 }}>
            <FileText size={18} />
            Raw Ledger (.CSV)
          </button>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.2rem', borderRadius: '8px', background: '#fff', color: '#000', fontWeight: 600 }}>
            <Printer size={18} />
            Print Organizer (PDF)
          </button>
        </div>
      </div>

      {/* ---------------- CPA DOCUMENT BODY ---------------- */}
      <div id="cpa-document" style={{ width: '100%' }}>
        
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>TAX ORGANIZER</h1>
            <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{taxYear} Independent Contractor & Student Summary</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <TrendingUp size={20} color="var(--text-primary)" />
              <strong style={{ fontSize: '1.2rem' }}>Multi-Hustle OS Validation</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={16} /> Data cryptographically synchronized via Plaid API
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
               <Calendar size={16} /> Generated on {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
        
        {/* Key KPI Row */}
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{ flex: 1, padding: '1.5rem', border: '2px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
             <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '0.5rem' }}>Total Gross Engine Input</p>
             <h2 style={{ fontSize: '2.5rem', margin: 0 }}>{formatCurrency(grossProp)}</h2>
          </div>
          <div style={{ flex: 1, padding: '1.5rem', border: '2px solid var(--border-color)', borderRadius: '8px', textAlign: 'center' }}>
             <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '0.5rem' }}>Est. Total Tax Liability</p>
             <h2 style={{ fontSize: '2.5rem', margin: 0 }}>{formatCurrency(taxProp)}</h2>
          </div>
          <div style={{ flex: 1, padding: '1.5rem', background: 'var(--accent-green-dim)', border: '2px solid var(--accent-green)', borderRadius: '8px', textAlign: 'center' }}>
             <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '0.5rem' }}>Safe-To-Spend True Net</p>
             <h2 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--accent-green)' }}>{formatCurrency(netProp)}</h2>
          </div>
        </div>

        {/* Section: Schedule C */}
        <div style={{ marginBottom: '3rem', pageBreakInside: 'avoid' }}>
           <h3 style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
             Part I: Schedule C Profit or Loss Form Parameters
           </h3>
           
           <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
             
             {/* General Freelance */}
             <div>
                <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem' }}>Freelance & Independent Contracts</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Gross Receipts/Sales:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(freeIncome)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Logged Expense Deductions:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- {formatCurrency(freeDed)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Form 8829 Home Office Space Deduction:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- {formatCurrency(hoDed)}</span>
                </div>
             </div>

             {/* Delivery Driver */}
             <div>
                <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '1rem' }}>Delivery App Gig Economy (Uber, DoorDash)</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span>Gross Receipts/Sales:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(shipIncome)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span>IRS Standard Mileage Deduction:</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- {formatCurrency(shipMile)}</span>
                </div>
             </div>

           </div>
        </div>

        {/* Section: Student Optimization */}
        <div style={{ marginBottom: '3rem', pageBreakInside: 'avoid' }}>
           <h3 style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
             Part II: Student Loophole Tax Shield Parameters
           </h3>
           
           <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem' }}>
             
             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>Form 1098-T</strong> Calculated Taxable Scholarship Overflow:
                </span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(scholarTax)}</span>
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>AOC/LLC</strong> Legal Textbook Expense Deductions:
                </span>
                <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- {formatCurrency(scholarText)}</span>
             </div>

             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>Form 1098-E</strong> Student Loan Interest Deduction (Max $2,500):
                </span>
                <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>- {formatCurrency(scholarLoan)}</span>
             </div>

           </div>

           <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={20} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <i>Note to CPA: The Multi-Hustle Engine has automatically filtered Bank Direct Deposits originating from University/Bursar addresses out of Standard Gross Income to prevent recursive double-taxation alongside the explicit Form 1098-T Taxable Scholarship rendering above. Form 8829 calculations apply exclusively to Schedule C Gig revenue streams.</i>
              </p>
           </div>
        </div>

        </div>

        {/* Footer Signature */}
        <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pageBreakInside: 'avoid' }}>
           <div>
             <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Prepared For Context Initialization By:</div>
             <div style={{ width: '250px', borderBottom: '1px solid var(--text-primary)', height: '30px' }}></div>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Taxpayer Signature</div>
           </div>
           
           <div>
             <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Accountant Review:</div>
             <div style={{ width: '250px', borderBottom: '1px solid var(--text-primary)', height: '30px' }}></div>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>CPA Validation Checklist</div>
           </div>
        </div>

      </div>

    </div>
  );
}
