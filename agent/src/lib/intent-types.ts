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
  amount?: number | null;
  currency?: string | null;
  merchant?: string | null;
  category?: string | null;
  description?: string | null;
  transactionDate?: string | null;
  timezone?: string | null;
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
  label?: string | null;
}

export interface InsightFilters {
  merchant?: string | null;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  timeframe?: DateRange | null;
  compareTo?: ComparisonTarget | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  lastN?: number | null;
}

export interface InsightIntent {
  kind: 'insight';
  confidence: IntentConfidence;
  queryType: InsightQueryType;
  filters: InsightFilters;
  followUps?: string[];
  question?: string | null;
  reason?: string;
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
