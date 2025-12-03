/**
 * Investment Return Calculator Utilities
 * Calculates investment growth projections
 */

export interface InvestmentResult {
  initialInvestment: number;
  monthlyContribution: number;
  annualReturnRate: number;
  years: number;
  totalContributed: number;
  totalInterest: number;
  finalValue: number;
  breakdown: InvestmentBreakdown[];
}

export interface InvestmentBreakdown {
  year: number;
  beginningBalance: number;
  contributions: number;
  interest: number;
  endingBalance: number;
}

/**
 * Calculate investment growth
 */
export function calculateInvestmentGrowth(
  initialInvestment: number,
  monthlyContribution: number,
  annualReturnRate: number,
  years: number
): InvestmentResult {
  const months = years * 12;
  const monthlyRate = annualReturnRate / 100 / 12;
  let balance = initialInvestment;
  const breakdown: InvestmentBreakdown[] = [];
  let totalContributed = initialInvestment;
  let totalInterest = 0;

  for (let year = 1; year <= years; year++) {
    const beginningBalance = balance;
    let yearContributions = 0;
    let yearInterest = 0;

    for (let month = 0; month < 12; month++) {
      const interest = balance * monthlyRate;
      balance = balance + interest + monthlyContribution;
      yearContributions += monthlyContribution;
      yearInterest += interest;
      totalContributed += monthlyContribution;
      totalInterest += interest;
    }

    breakdown.push({
      year,
      beginningBalance: Math.round(beginningBalance * 100) / 100,
      contributions: Math.round(yearContributions * 100) / 100,
      interest: Math.round(yearInterest * 100) / 100,
      endingBalance: Math.round(balance * 100) / 100,
    });
  }

  return {
    initialInvestment,
    monthlyContribution,
    annualReturnRate,
    years,
    totalContributed: Math.round(totalContributed * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    finalValue: Math.round(balance * 100) / 100,
    breakdown,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

