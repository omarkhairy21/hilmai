/**
 * 50/30/20 Budget Calculator Utilities
 * Calculates budget breakdown based on the 50/30/20 rule
 */

export interface BudgetBreakdown {
  needs: number;
  wants: number;
  savings: number;
  total: number;
}

export interface BudgetPercentages {
  needsPercent: number;
  wantsPercent: number;
  savingsPercent: number;
}

/**
 * Calculate 50/30/20 budget breakdown
 * @param monthlyIncome - Monthly after-tax income
 * @returns Budget breakdown in dollars
 */
export function calculateBudget(monthlyIncome: number): BudgetBreakdown {
  if (monthlyIncome <= 0) {
    return { needs: 0, wants: 0, savings: 0, total: 0 };
  }

  return {
    needs: Math.round(monthlyIncome * 0.5 * 100) / 100,
    wants: Math.round(monthlyIncome * 0.3 * 100) / 100,
    savings: Math.round(monthlyIncome * 0.2 * 100) / 100,
    total: monthlyIncome,
  };
}

/**
 * Get budget percentages (for display)
 */
export function getBudgetPercentages(): BudgetPercentages {
  return {
    needsPercent: 50,
    wantsPercent: 30,
    savingsPercent: 20,
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

