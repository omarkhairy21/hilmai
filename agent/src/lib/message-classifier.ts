/**
 * Message Classifier
 * Determines whether a user message is a transaction or a query
 */

export type MessageType = 'transaction' | 'query' | 'other';

/**
 * Transaction keywords that indicate the user is logging an expense
 */
const TRANSACTION_KEYWORDS = [
  // Action verbs
  'spent', 'paid', 'bought', 'purchased', 'cost', 'costs',
  // Transaction indicators
  'transaction', 'expense', 'buy', 'pay', 'charge',
  // Currency symbols (will be checked separately)
];

/**
 * Query keywords that indicate the user is asking a question
 */
const QUERY_KEYWORDS = [
  // Question words
  'how much', 'what', 'when', 'where', 'which', 'who',
  'show', 'show me', 'find', 'search', 'list',
  // Analysis words
  'total', 'sum', 'average', 'spending', 'spent on',
  'analyze', 'breakdown', 'summary', 'report',
  // Time-based queries
  'last month', 'this month', 'last week', 'this week',
  'today', 'yesterday', 'last year', 'this year',
];

/**
 * Check if message contains a currency symbol or amount pattern
 */
function hasCurrencyOrAmount(text: string): boolean {
  // Currency symbols
  const currencySymbols = /[$€£¥₹₽฿₪₩]/;

  // Amount patterns: "25.50", "100", "1,500.00", etc.
  const amountPattern = /\b\d+([,.]?\d+)*(\.\d{2})?\b/;

  return currencySymbols.test(text) || amountPattern.test(text);
}

/**
 * Check if message starts with a question word or contains question mark
 */
function isQuestion(text: string): boolean {
  const questionWords = /^(how|what|when|where|which|who|why|can|could|would|should|is|are|was|were|do|does|did|show|find)\b/i;
  return questionWords.test(text) || text.includes('?');
}

/**
 * Classify a user message as transaction, query, or other
 */
export function classifyMessage(text: string): MessageType {
  const lowerText = text.toLowerCase().trim();

  // Handle commands separately
  if (lowerText.startsWith('/')) {
    return 'other';
  }

  // Check if it's a question
  const hasQuestionIndicator = isQuestion(lowerText);

  // Check for query keywords
  const hasQueryKeyword = QUERY_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  // Check for transaction keywords
  const hasTransactionKeyword = TRANSACTION_KEYWORDS.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );

  // Check for currency/amount
  const hasAmount = hasCurrencyOrAmount(text);

  // Decision logic
  // If it's a question OR has query keywords, treat as query
  if (hasQuestionIndicator || hasQueryKeyword) {
    return 'query';
  }

  // If it has transaction keywords AND amount, it's a transaction
  if (hasTransactionKeyword && hasAmount) {
    return 'transaction';
  }

  // If it has amount but no question words, likely a transaction
  if (hasAmount && !hasQuestionIndicator) {
    return 'transaction';
  }

  // If it has transaction keywords without query context, it's a transaction
  if (hasTransactionKeyword && !hasQueryKeyword) {
    return 'transaction';
  }

  // Default to other
  return 'other';
}

/**
 * Check if a message is a transaction (convenience function)
 */
export function isTransaction(text: string): boolean {
  return classifyMessage(text) === 'transaction';
}

/**
 * Check if a message is a query (convenience function)
 */
export function isQuery(text: string): boolean {
  return classifyMessage(text) === 'query';
}

/**
 * Get a detailed classification with confidence
 */
export function classifyWithConfidence(text: string): {
  type: MessageType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  const lowerText = text.toLowerCase().trim();
  const type = classifyMessage(text);

  if (type === 'other') {
    return {
      type,
      confidence: 'high',
      reason: 'No transaction or query indicators found',
    };
  }

  const hasQuestion = isQuestion(lowerText);
  const hasAmount = hasCurrencyOrAmount(text);
  const hasTransactionKeyword = TRANSACTION_KEYWORDS.some(k => lowerText.includes(k));
  const hasQueryKeyword = QUERY_KEYWORDS.some(k => lowerText.includes(k));

  if (type === 'query') {
    if (hasQuestion && hasQueryKeyword) {
      return {
        type,
        confidence: 'high',
        reason: 'Contains question word and query keywords',
      };
    }
    if (hasQuestion || hasQueryKeyword) {
      return {
        type,
        confidence: 'medium',
        reason: hasQuestion ? 'Contains question word' : 'Contains query keywords',
      };
    }
    return {
      type,
      confidence: 'low',
      reason: 'Unclear query pattern',
    };
  }

  if (type === 'transaction') {
    if (hasTransactionKeyword && hasAmount) {
      return {
        type,
        confidence: 'high',
        reason: 'Contains transaction keyword and amount',
      };
    }
    if (hasAmount) {
      return {
        type,
        confidence: 'medium',
        reason: 'Contains amount but no explicit transaction keyword',
      };
    }
    return {
      type,
      confidence: 'low',
      reason: 'Transaction keyword found but no amount',
    };
  }

  return {
    type,
    confidence: 'low',
    reason: 'Default classification',
  };
}
