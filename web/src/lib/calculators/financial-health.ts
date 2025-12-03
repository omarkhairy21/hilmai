/**
 * Financial Health Score Calculator Utilities
 * Calculates financial health score based on various factors
 */

export interface FinancialHealthAnswers {
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
  savingsRate: number;
  creditScore: number;
  hasRetirementSavings: boolean;
  hasInsurance: boolean;
  tracksExpenses: boolean;
}

export interface FinancialHealthResult {
  score: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' | 'Critical';
  breakdown: ScoreBreakdown[];
  recommendations: string[];
}

export interface ScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
}

/**
 * Calculate financial health score
 */
export function calculateFinancialHealthScore(
  answers: FinancialHealthAnswers
): FinancialHealthResult {
  const breakdown: ScoreBreakdown[] = [];
  let totalScore = 0;
  const maxTotalScore = 100;

  // Emergency Fund (20 points)
  const emergencyFundScore = Math.min(20, answers.emergencyFundMonths * 3.33);
  breakdown.push({
    category: 'Emergency Fund',
    score: Math.round(emergencyFundScore * 10) / 10,
    maxScore: 20,
    percentage: Math.round((emergencyFundScore / 20) * 100),
  });
  totalScore += emergencyFundScore;

  // Debt-to-Income Ratio (20 points)
  let dtiScore = 20;
  if (answers.debtToIncomeRatio > 50) dtiScore = 0;
  else if (answers.debtToIncomeRatio > 43) dtiScore = 5;
  else if (answers.debtToIncomeRatio > 36) dtiScore = 10;
  else if (answers.debtToIncomeRatio > 20) dtiScore = 15;
  breakdown.push({
    category: 'Debt Management',
    score: dtiScore,
    maxScore: 20,
    percentage: Math.round((dtiScore / 20) * 100),
  });
  totalScore += dtiScore;

  // Savings Rate (20 points)
  const savingsRateScore = Math.min(20, answers.savingsRate * 2);
  breakdown.push({
    category: 'Savings Rate',
    score: Math.round(savingsRateScore * 10) / 10,
    maxScore: 20,
    percentage: Math.round((savingsRateScore / 20) * 100),
  });
  totalScore += savingsRateScore;

  // Credit Score (15 points)
  let creditScore = 0;
  if (answers.creditScore >= 750) creditScore = 15;
  else if (answers.creditScore >= 700) creditScore = 12;
  else if (answers.creditScore >= 650) creditScore = 9;
  else if (answers.creditScore >= 600) creditScore = 6;
  else if (answers.creditScore >= 550) creditScore = 3;
  breakdown.push({
    category: 'Credit Health',
    score: creditScore,
    maxScore: 15,
    percentage: Math.round((creditScore / 15) * 100),
  });
  totalScore += creditScore;

  // Retirement Savings (10 points)
  const retirementScore = answers.hasRetirementSavings ? 10 : 0;
  breakdown.push({
    category: 'Retirement Planning',
    score: retirementScore,
    maxScore: 10,
    percentage: retirementScore ? 100 : 0,
  });
  totalScore += retirementScore;

  // Insurance (10 points)
  const insuranceScore = answers.hasInsurance ? 10 : 0;
  breakdown.push({
    category: 'Insurance Coverage',
    score: insuranceScore,
    maxScore: 10,
    percentage: insuranceScore ? 100 : 0,
  });
  totalScore += insuranceScore;

  // Expense Tracking (5 points)
  const trackingScore = answers.tracksExpenses ? 5 : 0;
  breakdown.push({
    category: 'Expense Tracking',
    score: trackingScore,
    maxScore: 5,
    percentage: trackingScore ? 100 : 0,
  });
  totalScore += trackingScore;

  const finalScore = Math.round(totalScore);
  const grade = getGrade(finalScore);
  const recommendations = generateRecommendations(answers, breakdown);

  return {
    score: finalScore,
    grade,
    breakdown,
    recommendations,
  };
}

function getGrade(score: number): 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' | 'Critical' {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Needs Improvement';
  return 'Critical';
}

function generateRecommendations(
  answers: FinancialHealthAnswers,
  breakdown: ScoreBreakdown[]
): string[] {
  const recommendations: string[] = [];

  const emergencyFundBreakdown = breakdown.find((b) => b.category === 'Emergency Fund');
  if (emergencyFundBreakdown && emergencyFundBreakdown.percentage < 100) {
    recommendations.push('Build your emergency fund to cover 3-6 months of expenses');
  }

  const dtiBreakdown = breakdown.find((b) => b.category === 'Debt Management');
  if (dtiBreakdown && dtiBreakdown.percentage < 100) {
    recommendations.push('Reduce your debt-to-income ratio by paying down debt or increasing income');
  }

  const savingsBreakdown = breakdown.find((b) => b.category === 'Savings Rate');
  if (savingsBreakdown && savingsBreakdown.percentage < 100) {
    recommendations.push('Increase your savings rate to at least 20% of income');
  }

  const creditBreakdown = breakdown.find((b) => b.category === 'Credit Health');
  if (creditBreakdown && creditBreakdown.percentage < 100) {
    recommendations.push('Improve your credit score by paying bills on time and reducing credit utilization');
  }

  if (!answers.hasRetirementSavings) {
    recommendations.push('Start contributing to a retirement account (401k, IRA, etc.)');
  }

  if (!answers.hasInsurance) {
    recommendations.push('Ensure you have adequate health, life, and disability insurance');
  }

  if (!answers.tracksExpenses) {
    recommendations.push('Start tracking your expenses to better understand your spending patterns');
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Continue maintaining your excellent financial habits');
  }

  return recommendations;
}

