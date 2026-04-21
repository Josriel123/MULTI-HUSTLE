import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      include: { form1098T: true, form1098E: true, homeOffice: true }
    });

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { incomeSource: true }
    });

    let gross = 0;
    let net = 0;
    let taxLiability = 0;
    
    // Simplistic calculation for MVP
    const expenses = transactions.filter(t => t.type === 'Expense');
    
    // Prevent Double Counting
    const income = transactions.filter(t => {
      if (t.type !== 'Income') return false;
      
      const desc = t.description.toLowerCase();
      const isAcademicRefund = desc.includes('university') || desc.includes('college') || desc.includes('financial aid') || desc.includes('bursar') || desc.includes('scholarship');
      
      // Sweep Loan Disbursements out of Gross Income
      const isLoanDisbursement = desc.includes('loan') || desc.includes('navient') || desc.includes('nelnet') || desc.includes('dept of ed') || desc.includes('education department') || desc.includes('mohela');

      if (isLoanDisbursement) {
        return false;
      }
      
      if (userRecord?.form1098T && isAcademicRefund) {
        return false;
      }
      return true;
    });

    gross = income.reduce((sum, t) => sum + t.amount, 0);
    const totalDeductions = expenses.filter(t => t.taxDeductible).reduce((sum, t) => sum + t.amount, 0);
    
    // --- HOME OFFICE ENGINE ---
    let optimalHomeOfficeDeduction = 0;
    if (userRecord?.homeOffice) {
      const { totalSqFt, officeSqFt, rentAmount, utilitiesAmount } = userRecord.homeOffice;
      // Method 1: Simplified ($5 per sqft up to 300)
      const simplified = Math.min(officeSqFt, 300) * 5;
      
      // Method 2: Standard (Percentage of Total Expenses)
      const businessPercentage = totalSqFt > 0 ? (officeSqFt / totalSqFt) : 0;
      // Monthly expenses annualized
      const annualHousingCost = (rentAmount + utilitiesAmount) * 12;
      const standard = annualHousingCost * businessPercentage;
      
      // Auto-Optimizer identifies the highest legal shield. Protect against NaN if missing data.
      optimalHomeOfficeDeduction = Math.max(simplified, standard) || 0;
    }
    
    // --- 1098-T ENGINE UPGRADE ---
    // Calculate Taxable Scholarships vs Gig Income
    let taxableScholarships = 0;
    let textbookDeductions = 0;
    
    if (userRecord?.form1098T && userRecord.form1098T.box5 > userRecord.form1098T.box1) {
      textbookDeductions = expenses
        .filter(t => t.description.toLowerCase().includes('bookstore') || t.description.toLowerCase().includes('chegg') || t.description.toLowerCase().includes('textbook') || t.description.toLowerCase().includes('amazon'))
        .reduce((sum, t) => sum + t.amount, 0);
      
      taxableScholarships = Math.max(0, (userRecord.form1098T.box5 - userRecord.form1098T.box1) - textbookDeductions);
      gross += taxableScholarships;
    }

    // 1. Business Profit (Gig Income minus Normal Deductions minus Home Office Loophole)
    // Home office wipes out business profit (reducing SE tax) but cannot create a net business loss (bounded to 0).
    const businessNet = Math.max(0, income.reduce((sum, t) => sum + t.amount, 0) - totalDeductions - optimalHomeOfficeDeduction);
    
    // 2. Self-Employment Tax (only impacts business net, NOT scholarships)
    const seTax = businessNet * 0.153; 
    
    // 3. Generic Income Tax (applies to both)
    let loanInterestDeduction = 0;
    if (userRecord?.form1098E) {
      loanInterestDeduction = Math.min(2500, userRecord.form1098E.box1);
    }
    
    const totalTaxableIncome = Math.max(0, businessNet + taxableScholarships - loanInterestDeduction);
    const incomeTax = totalTaxableIncome * 0.12; 

    taxLiability = seTax + incomeTax;
    
    const actualCashExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    net = gross - taxLiability - actualCashExpenses;

    const sources = {
      freelance: { income: 0, deductions: totalDeductions, homeOfficeDeduction: optimalHomeOfficeDeduction },
      delivery: { income: 0, mileage: 0 },
      scholarships: { taxable: taxableScholarships, textbookSavings: textbookDeductions, loanInterestDeduction },
    };

    transactions.forEach(t => {
      const sType = t.incomeSource?.type || '';
      const sName = t.incomeSource?.name || '';
      
      if (sType === 'Freelance' || sName.toLowerCase().includes('freelance')) {
        if (t.type === 'Income') sources.freelance.income += t.amount;
        if (t.type === 'Expense' && t.taxDeductible) sources.freelance.deductions += t.amount;
      } 
      else if (sType === 'Delivery' || sName.toLowerCase().includes('delivery') || sName.includes('Unknown Bank Deposit') || !sName.toLowerCase().includes('freelance')) {
        // Fallback any generic Plaid delivery/bank income to delivery for wildcard
        if (t.type === 'Income') sources.delivery.income += t.amount;
        // Mock computation: 1 mile per $0.25 cents for mockup
        if (t.type === 'Income') sources.delivery.mileage += Math.round(t.amount * 0.25); 
      }
    });

    return NextResponse.json({
      summary: {
        gross: Math.round(gross),
        net: Math.round(net),
        taxLiability: Math.round(taxLiability),
      },
      sources: sources
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
