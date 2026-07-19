'use client'

import { useEffect, useState } from 'react'

// Localized mock Payroll Engine
const calculateUKPayroll = (hours: number, rate: number) => {
  const grossPay = (hours * rate).toFixed(2);
  const incomeTax = (Number(grossPay) * 0.20).toFixed(2);
  const nationalInsurance = (Number(grossPay) * 0.05).toFixed(2);
  const totalDeductions = (Number(incomeTax) + Number(nationalInsurance)).toFixed(2);
  const netPay = (Number(grossPay) - Number(totalDeductions)).toFixed(2);
  return { grossPay, incomeTax, nationalInsurance, totalDeductions, netPay };
};

export default function PayslipPage() {
  const [profile, setProfile] = useState<any>(null)
  const [payrollData, setPayrollData] = useState<any>(null)
  const [payableHours, setPayableHours] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generatePayslip()
  }, [currentMonth])

  const generatePayslip = async () => {
    setLoading(true)
    
    // Simulating data fetching
    const userProfile = { id: 'user-123-abc', full_name: 'John Doe', email: 'john@example.com', hourly_rate: 15 }
    setProfile(userProfile)

    const totalPayable = 160 // Mocked hours
    setPayableHours(totalPayable)

    const calculated = calculateUKPayroll(totalPayable, userProfile.hourly_rate)
    setPayrollData(calculated)
    setLoading(false)
  }

  const handlePrint = () => window.print()

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Loading Payslip...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center print:hidden">
          <button onClick={() => window.history.back()} className="text-blue-600 hover:underline font-medium">← Back</button>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 font-medium">Prev</button>
            <span className="font-bold">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 font-medium">Next</button>
          </div>
          <button onClick={handlePrint} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-700">Print</button>
        </div>

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
            <div className="grid grid-cols-12 gap-4 items-center mb-4 text-sm font-medium">
              <div className="col-span-5 text-slate-800">Basic Pay</div>
              <div className="col-span-2 text-right">{payableHours}h</div>
              <div className="col-span-2 text-right">{profile?.hourly_rate?.toFixed(2)}</div>
              <div className="col-span-3 text-right font-semibold text-slate-900">{payrollData?.grossPay}</div>
            </div>
          </div>

          <div className="border-t-2 border-slate-800 pt-6 flex justify-between items-end">
            <div className="text-right ml-auto">
              <p className="text-sm font-bold text-slate-500 uppercase mb-1">Net Pay</p>
              <p className="text-5xl font-black text-slate-900 tracking-tighter">£{payrollData?.netPay}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}