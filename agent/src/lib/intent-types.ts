export type IntentConfidence = 'high' | 'medium' | 'low';

export type IntentKind = 'transaction' | 'insight' | 'other';

export type DateGrain = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  text: string;
  start: string;
  end: string;
  grain: DateGrain;
}

export interface TransactionEntities {
  amount?: number;
  currency?: string;
  merchant?: string;
  category?: string;
  description?: string;
  transactionDate?: string;
  timezone?: string;
}

export interface TransactionIntent {
  kind: 'transaction';
  action: 'log' | 'amend';
  confidence: IntentConfidence;
  entities: TransactionEntities;
  reason?: string;
}

export type InsightQueryType = 'sum' | 'average' | 'count' | 'trend' | 'comparison' | 'list';

export interface ComparisonTarget {
  startDate: string;
  endDate: string;
  label?: string;
}

export interface InsightFilters {
  merchant?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  timeframe?: DateRange;
  compareTo?: ComparisonTarget;
  minAmount?: number;
  maxAmount?: number;
  lastN?: number;
}

export interface InsightIntent {
  kind: 'insight';
  confidence: IntentConfidence;
  queryType: InsightQueryType;
  filters: InsightFilters;
  followUps?: string[];
  question?: string;
}

export interface UnknownIntent {
  kind: 'other';
  confidence: IntentConfidence;
  reason: string;
}

export type QueryIntent = TransactionIntent | InsightIntent | UnknownIntent;

export interface IntentParseDiagnostics {
  rulesFired: string[];
  usedLLM: boolean;
  cacheHit: boolean;
}

export interface IntentParseResult {
  intent: QueryIntent;
  diagnostics: IntentParseDiagnostics;
}
