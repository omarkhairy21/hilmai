/**
 * Debt Payoff Calculator Utilities
 * Calculates debt payoff strategies (snowball vs avalanche)
 */

export interface Debt {
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

export interface DebtPayoffResult {
  method: 'snowball' | 'avalanche';
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  payments: DebtPayment[];
}

export interface DebtPayment {
  month: number;
  debtName: string;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

/**
 * Calculate debt payoff using snowball method (smallest balance first)
 */
export function calculateSnowballMethod(
  debts: Debt[],
  extraPayment: number = 0
): DebtPayoffResult {
  const sortedDebts = [...debts].sort((a, b) => a.balance - b.balance);
  return calculatePayoff(sortedDebts, extraPayment, 'snowball');
}

/**
 * Calculate debt payoff using avalanche method (highest interest first)
 */
export function calculateAvalancheMethod(
  debts: Debt[],
  extraPayment: number = 0
): DebtPayoffResult {
  const sortedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);
  return calculatePayoff(sortedDebts, extraPayment, 'avalanche');
}

function calculatePayoff(
  sortedDebts: Debt[],
  extraPayment: number,
  method: 'snowball' | 'avalanche'
): DebtPayoffResult {
  const debts = sortedDebts.map((d) => ({ ...d, balance: d.balance }));
  const payments: DebtPayment[] = [];
  let month = 0;
  let totalInterest = 0;
  const monthlyRate = (rate: number) => rate / 100 / 12;

  while (debts.some((d) => d.balance > 0.01)) {
    month++;
    let availableExtra = extraPayment;

    for (const debt of debts) {
      if (debt.balance <= 0.01) continue;

      const interest = debt.balance * monthlyRate(debt.interestRate);
      let payment = debt.minimumPayment + (availableExtra > 0 ? availableExtra : 0);
      const principal = Math.min(payment - interest, debt.balance);

      debt.balance -= principal;
      totalInterest += interest;

      if (debt.balance <= 0.01) {
        payment = debt.balance + principal + interest;
        debt.balance = 0;
        availableExtra = 0;
      } else {
        availableExtra = 0;
      }

      payments.push({
        month,
        debtName: debt.name,
        payment: Math.round(payment * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remainingBalance: Math.round(debt.balance * 100) / 100,
      });
    }

    if (month > 600) break; // Safety limit
  }

  const totalPaid =
    debts.reduce((sum, d) => sum + d.minimumPayment * month, 0) +
    extraPayment * month +
    totalInterest;

  return {
    method,
    totalMonths: month,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    payments,
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

