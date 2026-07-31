'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase' // Ensure this matches your supabase path
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient()

// HMRC Real-Time Threshold & Progressive Calculation Engine (2026/27 guidelines)
const calculateUKPayroll = (
  hours: number,
  rate: number,
  frequency: string = 'Monthly',
  employmentType: string = 'Staff',
  totalAdvances: number = 0,
) => {
  const grossPeriodPay = hours * rate;
  const grossPay = Number(grossPeriodPay.toFixed(2));

  // Contractors are self-employed; they handle their own tax and NI via Self Assessment
  if (employmentType?.toLowerCase() === 'contractor') {
    return {
      grossPay: grossPay.toFixed(2),
      incomeTax: '0.00',
      nationalInsurance: '0.00',
      totalDeductions: '0.00',
      advanceDeduction: totalAdvances.toFixed(2),
      netPay: (grossPay - totalAdvances).toFixed(2),
    };
  }

  const periodsPerYear = frequency === 'Weekly' ? 52 : 12;
  const estimatedAnnualGross = grossPeriodPay * periodsPerYear; 

  const PERSONAL_ALLOWANCE = 12570;
  const BASIC_RATE_LIMIT = 50270;
  const ADDITIONAL_RATE_LIMIT = 125140;

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

  const NI_PRIMARY_THRESHOLD = 12570;
  const NI_UPPER_LIMIT = 50270;
  let annualNI = 0;

  if (estimatedAnnualGross > NI_PRIMARY_THRESHOLD) {
    const mainEarnings = Math.min(estimatedAnnualGross, NI_UPPER_LIMIT) - NI_PRIMARY_THRESHOLD;
    annualNI += mainEarnings * 0.08; 
  }
  if (estimatedAnnualGross > NI_UPPER_LIMIT) {
    const upperEarnings = estimatedAnnualGross - NI_UPPER_LIMIT;
    annualNI += upperEarnings * 0.02; 
  }

  const incomeTax = Number((annualTax / periodsPerYear).toFixed(2));
  const nationalInsurance = Number((annualNI / periodsPerYear).toFixed(2));
  const totalDeductions = Number((incomeTax + nationalInsurance).toFixed(2));
  const netPay = Number((grossPay - totalDeductions - totalAdvances).toFixed(2));

return { 
  grossPay: grossPay.toFixed(2), 
  incomeTax: incomeTax.toFixed(2), 
  nationalInsurance: nationalInsurance.toFixed(2), 
  totalDeductions: totalDeductions.toFixed(2), 
  advanceDeduction: totalAdvances.toFixed(2),
  netPay: Math.max(0, netPay).toFixed(2) 
};
};

export default function PayslipPage() {
  const router = useRouter()
  const params = useParams()

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

    // 1. Determine target user ID (from URL params or current user session)
    let targetUserId = params?.id as string;

    if (!targetUserId) {
      const { data: { session } } = await supabase.auth.getSession()
      targetUserId = session?.user?.id || ''
    }

    if (!targetUserId) {
      setLoading(false)
      return
    }

    // 2. Fetch staff profile (including payment_frequency)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()

    if (profileData) {
      setProfile(profileData)

const year = currentMonth.getFullYear()
const month = currentMonth.getMonth()

// Format explicitly as YYYY-MM-DD to match the 'date' column type in Supabase
const pad = (n: number) => String(n).padStart(2, '0')
const startDate = `${year}-${pad(month + 1)}-01`
const lastDay = new Date(year, month + 1, 0).getDate()
const endDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`

      // 3. Fetch shifts for the selected period
      const { data: shiftsData } = await supabase
        .from('daily_shifts') // Adjusted to daily_shifts
        .select('hours')
        .eq('user_id', targetUserId)
        .gte('date', startDate)
        .lte('date', endDate)

        // 3.5. Fetch un-deducted advances for this user in the selected month
const { data: advancesData } = await supabase
  .from('staff_advances')
  .select('amount')
  .eq('user_id', targetUserId)
  .gte('date', startDate)
  .lte('date', endDate)
  .eq('deducted', false);

const totalAdvances = advancesData?.reduce((acc: number, adv: any) => acc + (Number(adv.amount) || 0), 0) || 0;

      const totalHours = shiftsData?.reduce((acc: number, shift: any) => acc + (Number(shift.hours) || 0), 0) || 0
      setPayableHours(totalHours)

      // 4. Calculate with user rate and payment frequency
      const rate = profileData.hourly_rate || 0
      const frequency = profileData.payment_frequency || 'Monthly'
      const employmentType = profileData.employment_type || 'Staff'
      const calculated = calculateUKPayroll(totalHours, rate, frequency, employmentType)
      
      setPayrollData(calculated)
    }

    setLoading(false)
  }

  const handlePrint = () => window.print()

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Payslip...</div>
  if (!profile) return <div className="p-10 text-center font-bold text-red-500">Staff record not found or not logged in.</div>

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        
        {/* Navigation Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center print:hidden">
          <button onClick={() => router.back()} className="text-blue-600 hover:underline font-medium">← Back</button>
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

        <button onClick={() => router.push('/dashboard/admin/staff')} className="text-blue-600 hover:underline font-medium print:hidden">← Back to Staff Directory</button>

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
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded">
                {profile?.payment_frequency || 'Monthly'}
              </span>
            </div>
          </div>

          {/* Step 3: Advance Payment Deduction Row */}
          {Number(payrollData?.advanceDeduction) > 0 && (
            <div className="grid grid-cols-12 gap-4 items-center mb-4 text-sm text-rose-600 border-b pb-4">
              <div className="col-span-9">Advance Payment Deduction</div>
              <div className="col-span-3 text-right font-medium">-£{payrollData?.advanceDeduction}</div>
            </div>
          )}  

          <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-lg">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Employee Name</p>
              <p className="text-lg font-semibold text-slate-900">{profile?.full_name}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Employee ID</p>
              <p className="text-sm font-mono text-slate-700">{profile?.id ? profile.id.split('-')[0].toUpperCase() : '-'}</p>
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
          <div className="grid grid-cols-12 gap-4 items-center mb-2 text-sm text-rose-600">
            <div className="col-span-9">Employee National Insurance (NI)</div>
            <div className="col-span-3 text-right font-medium">-£{payrollData?.nationalInsurance}</div>
          </div>

          {/* Advance Payment Deduction Row */}
          {Number(payrollData?.advanceDeduction) > 0 && (
            <div className="grid grid-cols-12 gap-4 items-center mb-4 text-sm text-rose-600 border-b pb-4">
              <div className="col-span-9">Advance Payment Deduction</div>
              <div className="col-span-3 text-right font-medium">-£{payrollData?.advanceDeduction}</div>
            </div>
          )}
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