/**
 * Emergency Fund Calculator Utilities
 * Calculates emergency fund requirements and savings timeline
 */

export interface EmergencyFundResult {
  targetAmount: number;
  monthsToSave: number;
  monthlyContribution: number;
  currentSavings: number;
  remainingNeeded: number;
}

export interface EmergencyFundTimeline {
  months: number;
  totalSaved: number;
  remaining: number;
  percentageComplete: number;
}

/**
 * Calculate required emergency fund amount
 * @param monthlyExpenses - Total monthly expenses
 * @param targetMonths - Number of months to cover (3, 6, 9, or 12)
 * @returns Target emergency fund amount
 */
export function calculateEmergencyFundTarget(
  monthlyExpenses: number,
  targetMonths: number
): number {
  if (monthlyExpenses <= 0 || targetMonths <= 0) {
    return 0;
  }
  return Math.round(monthlyExpenses * targetMonths * 100) / 100;
}

/**
 * Calculate timeline to reach emergency fund goal
 * @param targetAmount - Target emergency fund amount
 * @param currentSavings - Current savings amount
 * @param monthlyContribution - Monthly contribution amount
 * @returns Timeline result
 */
export function calculateSavingsTimeline(
  targetAmount: number,
  currentSavings: number,
  monthlyContribution: number
): EmergencyFundResult {
  if (targetAmount <= 0) {
    return {
      targetAmount: 0,
      monthsToSave: 0,
      monthlyContribution: 0,
      currentSavings: 0,
      remainingNeeded: 0,
    };
  }

  const remainingNeeded = Math.max(0, targetAmount - currentSavings);

  if (monthlyContribution <= 0) {
    return {
      targetAmount,
      monthsToSave: Infinity,
      monthlyContribution: 0,
      currentSavings,
      remainingNeeded,
    };
  }

  const monthsToSave = Math.ceil(remainingNeeded / monthlyContribution);

  return {
    targetAmount,
    monthsToSave,
    monthlyContribution,
    currentSavings,
    remainingNeeded,
  };
}

/**
 * Calculate required monthly contribution to reach goal in X months
 * @param targetAmount - Target emergency fund amount
 * @param currentSavings - Current savings amount
 * @param targetMonths - Number of months to reach goal
 * @returns Required monthly contribution
 */
export function calculateRequiredMonthlyContribution(
  targetAmount: number,
  currentSavings: number,
  targetMonths: number
): number {
  if (targetMonths <= 0) {
    return 0;
  }

  const remainingNeeded = Math.max(0, targetAmount - currentSavings);
  return Math.round((remainingNeeded / targetMonths) * 100) / 100;
}

/**
 * Generate timeline breakdown for visualization
 * @param result - Emergency fund calculation result
 * @returns Array of timeline points
 */
export function generateTimelineBreakdown(
  result: EmergencyFundResult
): EmergencyFundTimeline[] {
  const timeline: EmergencyFundTimeline[] = [];
  const maxMonths = Math.min(result.monthsToSave, 60); // Cap at 5 years for display

  for (let month = 0; month <= maxMonths; month += Math.max(1, Math.floor(maxMonths / 12))) {
    const totalSaved = Math.min(
      result.currentSavings + result.monthlyContribution * month,
      result.targetAmount
    );
    const remaining = Math.max(0, result.targetAmount - totalSaved);
    const percentageComplete = Math.min(
      (totalSaved / result.targetAmount) * 100,
      100
    );

    timeline.push({
      months: month,
      totalSaved: Math.round(totalSaved * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentageComplete: Math.round(percentageComplete * 10) / 10,
    });
  }

  return timeline;
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

