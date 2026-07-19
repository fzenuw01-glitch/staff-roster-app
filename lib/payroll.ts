// lib/payroll.ts

export function calculateUKPayroll(totalPayableHours: number, hourlyRate: number) {
  const grossPay = totalPayableHours * hourlyRate;

  // UK Standard Monthly Thresholds (Approx. 2026/2027 targets)
  // Tax Code 1257L implies £12,570 tax-free per year / 12 months = £1,047.50
  const personalAllowance = 1047.50; 
  const niThreshold = 1048.00;

  // 1. Calculate Income Tax (20% basic rate on everything above allowance)
  let incomeTax = 0;
  if (grossPay > personalAllowance) {
    incomeTax = (grossPay - personalAllowance) * 0.20;
  }

  // 2. Calculate Class 1 National Insurance (8% on everything above threshold)
  let nationalInsurance = 0;
  if (grossPay > niThreshold) {
    nationalInsurance = (grossPay - niThreshold) * 0.08;
  }

  const totalDeductions = incomeTax + nationalInsurance;
  const netPay = grossPay - totalDeductions;

  return {
    grossPay: grossPay.toFixed(2),
    incomeTax: incomeTax.toFixed(2),
    nationalInsurance: nationalInsurance.toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
    netPay: netPay.toFixed(2)
  };
}