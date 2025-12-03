/**
 * Retirement Calculator Utilities
 * Calculates retirement savings needs and projections
 */

export interface RetirementResult {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  annualReturnRate: number;
  retirementSavings: number;
  monthlyRetirementIncome: number;
  yearsOfRetirement: number;
  totalRetirementNeeded: number;
  shortfall: number;
  isOnTrack: boolean;
}

/**
 * Calculate retirement savings projection
 */
export function calculateRetirement(
  currentAge: number,
  retirementAge: number,
  currentSavings: number,
  monthlyContribution: number,
  annualReturnRate: number,
  monthlyRetirementIncome: number,
  yearsOfRetirement: number = 30
): RetirementResult {
  const yearsToRetirement = retirementAge - currentAge;
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyRate = annualReturnRate / 100 / 12;

  // Calculate future value of current savings
  const futureValueCurrentSavings = currentSavings * Math.pow(1 + monthlyRate, monthsToRetirement);

  // Calculate future value of monthly contributions
  let futureValueContributions = 0;
  if (monthlyRate > 0) {
    futureValueContributions =
      monthlyContribution *
      ((Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate);
  } else {
    futureValueContributions = monthlyContribution * monthsToRetirement;
  }

  const retirementSavings = Math.round((futureValueCurrentSavings + futureValueContributions) * 100) / 100;

  // Calculate total retirement needed (using 4% rule)
  const annualRetirementIncome = monthlyRetirementIncome * 12;
  const totalRetirementNeeded = annualRetirementIncome * 25; // 4% rule: 25x annual expenses

  const shortfall = Math.max(0, Math.round((totalRetirementNeeded - retirementSavings) * 100) / 100);
  const isOnTrack = shortfall <= 0;

  return {
    currentAge,
    retirementAge,
    currentSavings,
    monthlyContribution,
    annualReturnRate,
    retirementSavings: Math.round(retirementSavings * 100) / 100,
    monthlyRetirementIncome,
    yearsOfRetirement,
    totalRetirementNeeded: Math.round(totalRetirementNeeded * 100) / 100,
    shortfall,
    isOnTrack,
  };
}

/**
 * Calculate required monthly contribution to meet retirement goal
 */
export function calculateRequiredMonthlyContribution(
  currentAge: number,
  retirementAge: number,
  currentSavings: number,
  annualReturnRate: number,
  targetRetirementSavings: number
): number {
  const yearsToRetirement = retirementAge - currentAge;
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyRate = annualReturnRate / 100 / 12;

  // Future value of current savings
  const futureValueCurrentSavings = currentSavings * Math.pow(1 + monthlyRate, monthsToRetirement);

  // Required future value from contributions
  const requiredFromContributions = targetRetirementSavings - futureValueCurrentSavings;

  if (requiredFromContributions <= 0) return 0;

  // Calculate required monthly contribution
  if (monthlyRate > 0) {
    const denominator = (Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate;
    return Math.max(0, Math.round((requiredFromContributions / denominator) * 100) / 100);
  } else {
    return Math.max(0, Math.round((requiredFromContributions / monthsToRetirement) * 100) / 100);
  }
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

