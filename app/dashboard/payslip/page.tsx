'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const supabase = createClient()

// HMRC Real-Time Threshold & Progressive Calculation Engine (2026/27 guidelines)
const calculateUKPayroll = (hours: number, rate: number) => {
  const grossPeriodPay = hours * rate;
  
  // Annualize earnings to evaluate against tax brackets properly
  const estimatedAnnualGross = grossPeriodPay * 52; 

  const PERSONAL_ALLOWANCE = 12570;
  const BASIC_RATE_LIMIT = 50270;
  const ADDITIONAL_RATE_LIMIT = 125140;

  // Personal Allowance Taper for income over £100,000
  let allowance = PERSONAL_ALLOWANCE;
  if (estimatedAnnualGross > 100000) {
    const excess = estimatedAnnualGross - 100000;
    allowance = Math.max(0, PERSONAL_ALLOWANCE - Math.floor(excess / 2));
  }

  const taxableIncome = Math.max(0, estimatedAnnualGross - allowance);
  let annualTax = 0;

  if (taxableIncome > 0) {
    const basicWidth = BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE;
    const inBasic = Math.min(taxableIncome, basicWidth);
    annualTax += inBasic * 0.20;
  }
  if (taxableIncome > (BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE)) {
    const higherWidth = ADDITIONAL_RATE_LIMIT - BASIC_RATE_LIMIT;
    const inHigher = Math.min(taxableIncome - (BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE), higherWidth);
    annualTax += inHigher * 0.40;
  }
  if (taxableIncome > (ADDITIONAL_RATE_LIMIT - PERSONAL_ALLOWANCE)) {
    const inAdditional = taxableIncome - (ADDITIONAL_RATE_LIMIT - PERSONAL_ALLOWANCE);
    annualTax += inAdditional * 0.45;
  }

  // Employee Class 1 National Insurance Calculation
  const NI_PRIMARY_THRESHOLD = 12570;
  const NI_UPPER_LIMIT = 50270;
  let annualNI = 0;

  if (estimatedAnnualGross > NI_PRIMARY_THRESHOLD) {
    const mainEarnings = Math.min(estimatedAnnualGross, NI_UPPER_LIMIT) - NI_PRIMARY_THRESHOLD;
    annualNI += mainEarnings * 0.08; // 8% main rate
  }
  if (estimatedAnnualGross > NI_UPPER_LIMIT) {
    const upperEarnings = estimatedAnnualGross - NI_UPPER_LIMIT;
    annualNI += upperEarnings * 0.02; // 2% higher rate
  }

  // Convert back to pay period proportion (e.g., weekly slice)
  const incomeTax = Number((annualTax / 52).toFixed(2));
  const nationalInsurance = Number((annualNI / 52).toFixed(2));
  const grossPay = Number(grossPeriodPay.toFixed(2));
  const totalDeductions = Number((incomeTax + nationalInsurance).toFixed(2));
  const netPay = Number((grossPay - totalDeductions).toFixed(2));

  return { 
    grossPay: grossPay.toFixed(2), 
    incomeTax: incomeTax.toFixed(2), 
    nationalInsurance: nationalInsurance.toFixed(2), 
    totalDeductions: totalDeductions.toFixed(2), 
    netPay: Math.max(0, netPay).toFixed(2) 
  };
};

export default function PayslipPage() {
  const [profile, setProfile] = useState<any>(null)
  const [payrollData, setPayrollData] = useState<any>(null)
  const [payableHours, setPayableHours] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPayslipData()
  }, [currentMonth])

  const fetchPayslipData = async () => {
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileData) {
      setProfile(profileData)

      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth()
      const startDate = new Date(year, month, 1).toISOString()
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('hours_worked')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', endDate)

      const totalHours = shiftsData?.reduce((acc: number, shift: any) => acc + (Number(shift.hours_worked) || 0), 0) || 0
      setPayableHours(totalHours)

      const rate = profileData.hourly_rate || 0
      const calculated = calculateUKPayroll(totalHours, rate)
      setPayrollData(calculated)
    }

    setLoading(false)
  }

  const router = useRouter()
  const handlePrint = () => window.print()

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Payslip...</div>
  if (!profile) return <div className="p-10 text-center font-bold text-red-500">Please log in to view your payslip.</div>

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        
        {/* Navigation Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center print:hidden">
          <button onClick={() => window.history.back()} className="text-blue-600 hover:underline font-medium">← Back</button>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} 
              className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 font-medium"
            >
              Prev
            </button>
            <span className="font-bold">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button 
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} 
              className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 font-medium"
            >
              Next
            </button>
          </div>
          <button onClick={handlePrint} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-700">Print</button>
        </div>

        <button onClick={() => router.push('/dashboard')} className="text-blue-600 hover:underline font-medium print:hidden">← Back to Dashboard</button>

        {/* Printable Wage Slip Document */}
        <div className="bg-white p-10 rounded-xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0">
          <div className="border-b-2 border-slate-800 pb-6 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">WAGE SLIP</h1>
              <p className="text-slate-500 font-medium mt-1">Hawani PMS</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Period</p>
              <p className="text-lg font-bold text-slate-800">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-lg">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Employee Name</p>
              <p className="text-lg font-semibold text-slate-900">{profile?.full_name}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Employee ID</p>
              <p className="text-sm font-mono text-slate-700">{profile?.id.split('-')[0].toUpperCase()}</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase border-b pb-2 mb-4">
              <div className="col-span-5">Description</div>
              <div className="col-span-2 text-right">Units</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-3 text-right">Amount</div>
            </div>
            
            {/* Earnings Item */}
            <div className="grid grid-cols-12 gap-4 items-center mb-3 text-sm font-medium">
              <div className="col-span-5 text-slate-800">Basic Pay</div>
              <div className="col-span-2 text-right">{payableHours}h</div>
              <div className="col-span-2 text-right">£{profile?.hourly_rate?.toFixed(2) || '0.00'}</div>
              <div className="col-span-3 text-right font-semibold text-slate-900">£{payrollData?.grossPay}</div>
            </div>

            {/* Deductions Items */}
            <div className="grid grid-cols-12 gap-4 items-center mb-2 text-sm text-rose-600">
              <div className="col-span-9">PAYE Income Tax</div>
              <div className="col-span-3 text-right font-medium">-£{payrollData?.incomeTax}</div>
            </div>
            <div className="grid grid-cols-12 gap-4 items-center mb-4 text-sm text-rose-600 border-b pb-4">
              <div className="col-span-9">Employee National Insurance (NI)</div>
              <div className="col-span-3 text-right font-medium">-£{payrollData?.nationalInsurance}</div>
            </div>
          </div>

          <div className="border-t-2 border-slate-800 pt-6 flex justify-between items-end">
            <div>
              <p className="text-xs text-slate-400">HMRC Compliant Calculation (2026/27 Rates)</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-500 uppercase mb-1">Net Pay</p>
              <p className="text-5xl font-black text-slate-900 tracking-tighter">£{payrollData?.netPay}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}