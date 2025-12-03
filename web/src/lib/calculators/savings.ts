/**
 * Savings Goal Calculator Utilities
 * Calculates savings goals and timelines
 */

export interface SavingsGoalResult {
  targetAmount: number;
  currentSavings: number;
  monthlyContribution: number;
  monthsToGoal: number;
  yearsToGoal: number;
  totalContributed: number;
  totalInterest: number;
  finalAmount: number;
}

/**
 * Calculate timeline to reach savings goal
 */
export function calculateSavingsTimeline(
  targetAmount: number,
  currentSavings: number,
  monthlyContribution: number,
  annualInterestRate: number = 0
): SavingsGoalResult {
  if (monthlyContribution <= 0 && currentSavings < targetAmount) {
    return {
      targetAmount,
      currentSavings,
      monthlyContribution: 0,
      monthsToGoal: Infinity,
      yearsToGoal: Infinity,
      totalContributed: 0,
      totalInterest: 0,
      finalAmount: currentSavings,
    };
  }

  let balance = currentSavings;
  let months = 0;
  const monthlyRate = annualInterestRate / 100 / 12;
  const maxMonths = 600; // 50 years

  while (balance < targetAmount && months < maxMonths) {
    months++;
    balance = balance * (1 + monthlyRate) + monthlyContribution;
  }

  const totalContributed = currentSavings + monthlyContribution * months;
  const totalInterest = balance - totalContributed;
  const finalAmount = Math.min(balance, targetAmount);

  return {
    targetAmount,
    currentSavings,
    monthlyContribution,
    monthsToGoal: months,
    yearsToGoal: Math.round((months / 12) * 10) / 10,
    totalContributed: Math.round(totalContributed * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    finalAmount: Math.round(finalAmount * 100) / 100,
  };
}

/**
 * Calculate required monthly contribution to reach goal in X months
 */
export function calculateRequiredMonthlyContribution(
  targetAmount: number,
  currentSavings: number,
  monthsToGoal: number,
  annualInterestRate: number = 0
): number {
  if (monthsToGoal <= 0) return 0;

  const monthlyRate = annualInterestRate / 100 / 12;
  const futureValue = targetAmount;
  const presentValue = currentSavings;

  if (monthlyRate === 0) {
    // Simple calculation without interest
    return Math.max(0, (futureValue - presentValue) / monthsToGoal);
  }

  // Compound interest formula: FV = PV(1+r)^n + PMT[((1+r)^n - 1)/r]
  // Solving for PMT: PMT = (FV - PV(1+r)^n) / [((1+r)^n - 1)/r]
  const compoundFactor = Math.pow(1 + monthlyRate, monthsToGoal);
  const numerator = futureValue - presentValue * compoundFactor;
  const denominator = (compoundFactor - 1) / monthlyRate;

  return Math.max(0, Math.round((numerator / denominator) * 100) / 100);
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

