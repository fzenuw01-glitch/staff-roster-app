// UK HMRC Tax & NI Thresholds (2026/27 guidelines)
const PERSONAL_ALLOWANCE = 12570;
const BASIC_RATE_LIMIT = 50270;
const ADDITIONAL_RATE_LIMIT = 125140;

const RATE_BASIC = 0.20;       // 20%
const RATE_HIGHER = 0.40;      // 40%
const RATE_ADDITIONAL = 0.45;  // 45%

const NI_PRIMARY_THRESHOLD = 12570; 
const NI_UPPER_LIMIT = 50270;       
const NI_RATE_MAIN = 0.08;          // 8%
const NI_RATE_HIGHER = 0.02;        // 2%

export function calculatePersonalAllowance(grossAnnual: number): number {
  if (grossAnnual <= 100000) return PERSONAL_ALLOWANCE;
  const excess = grossAnnual - 100000;
  const reduction = Math.floor(excess / 2);
  return Math.max(0, PERSONAL_ALLOWANCE - reduction);
}

export function calculateIncomeTax(grossAnnual: number): number {
  const allowance = calculatePersonalAllowance(grossAnnual);
  const taxableIncome = Math.max(0, grossAnnual - allowance);
  let tax = 0;

  if (taxableIncome > 0) {
    const basicBandWidth = BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE;
    const taxableInBasic = Math.min(taxableIncome, basicBandWidth);
    tax += taxableInBasic * RATE_BASIC;
  }

  if (taxableIncome > (BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE)) {
    const higherBandWidth = ADDITIONAL_RATE_LIMIT - BASIC_RATE_LIMIT;
    const taxableInHigher = Math.min(taxableIncome - (BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE), higherBandWidth);
    tax += taxableInHigher * RATE_HIGHER;
  }

  if (taxableIncome > (ADDITIONAL_RATE_LIMIT - PERSONAL_ALLOWANCE)) {
    const taxableInAdditional = taxableIncome - (ADDITIONAL_RATE_LIMIT - PERSONAL_ALLOWANCE);
    tax += taxableInAdditional * RATE_ADDITIONAL;
  }

  return Number(tax.toFixed(2));
}

export function calculateEmployeeNI(grossAnnual: number): number {
  let annualNI = 0;
  if (grossAnnual > NI_PRIMARY_THRESHOLD) {
    const mainBandEarnings = Math.min(grossAnnual, NI_UPPER_LIMIT) - NI_PRIMARY_THRESHOLD;
    annualNI += mainBandEarnings * NI_RATE_MAIN;
  }
  if (grossAnnual > NI_UPPER_LIMIT) {
    const upperBandEarnings = grossAnnual - NI_UPPER_LIMIT;
    annualNI += upperBandEarnings * NI_RATE_HIGHER;
  }
  return Number(annualNI.toFixed(2));
}

// Master calculation function taking actual hours worked & hourly rate
export function calculatePayslipBreakdown(totalHoursWorked: number, hourlyRate: number) {
  const grossPeriodPay = totalHoursWorked * hourlyRate;
  
  // Annualize for tax bracket assessment (assuming standard 52-week annual projection or period scaling)
  // For monthly payroll context, multiply period pay by 12, or compute per-pay-period directly.
  const estimatedAnnualGross = grossPeriodPay * 52; // assuming weekly calculation or scaling factor

  const annualTax = calculateIncomeTax(estimatedAnnualGross);
  const annualNI = calculateEmployeeNI(estimatedAnnualGross);

  // Scale back down to the pay period (e.g., weekly slice)
  const periodTax = Number((annualTax / 52).toFixed(2));
  const periodNI = Number((annualNI / 52).toFixed(2));
  
  const totalDeductions = periodTax + periodNI;
  const netPay = Number((grossPeriodPay - totalDeductions).toFixed(2));

  return {
    grossPay: Number(grossPeriodPay.toFixed(2)),
    incomeTax: periodTax,
    nationalInsurance: periodNI,
    totalDeductions: Number(totalDeductions.toFixed(2)),
    netPay: Math.max(0, netPay),
  };
}