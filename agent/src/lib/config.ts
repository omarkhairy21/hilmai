/**
 * Configuration file for HilmAI Agent V2
 *
 * Centralizes environment variable loading and provides typed access
 */

import { LangfuseExporter } from '@mastra/langfuse';

export const config = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    polling: process.env.TELEGRAM_POLLING === 'true',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    useWebhook: process.env.TELEGRAM_USE_WEBHOOK === 'true',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },

  // Database (PostgreSQL for memory)
  database: {
    url: process.env.DATABASE_URL,
  },

  // LibSQL (for caching)
  libsql: {
    url: process.env.LIBSQL_URL,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  },

  // App
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    mastraPort: parseInt(process.env.MASTRA_PORT || '4111', 10),
  },

  // Optional Telemetry
  telemetry: {
    serviceName: process.env.OTEL_SERVICE_NAME || 'hilm-agent-v2',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },

  // Langfuse (for LLM observability)
  langfuse: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    enabled: process.env.NODE_ENV === 'production', // Only enable in production
  },

  // Stripe (for subscriptions)
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID,
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_ID,
  },
} as const;

/**
 * Validate required environment variables
 */
export function validateConfig(): void {
  const missing: string[] = [];

  if (!config.telegram.botToken) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }

  if (!config.openai.apiKey) {
    missing.push('OPENAI_API_KEY');
  }

  if (!config.supabase.url) {
    missing.push('SUPABASE_URL');
  }

  if (!config.supabase.anonKey) {
    missing.push('SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Please set them in your .env file.'
    );
  }
}

/**
 * Get database URL with optional warning if not set
 * Properly encodes special characters in the password component
 */
export function getDatabaseUrl(): string | undefined {
  if (!config.database.url) {
    console.warn(
      '[config] DATABASE_URL not set. Memory will not work. ' +
        'Set DATABASE_URL in .env to enable memory. ' +
        'Find it in Supabase Dashboard → Settings → Database → Connection string'
    );
    return undefined;
  }

  try {
    console.log('config.database.url', config.database.url);

    // Find the last @ symbol to handle passwords containing @
    const lastAtIndex = config.database.url.lastIndexOf('@');
    if (lastAtIndex === -1) {
      // No credentials in URL, try native parsing
      return new URL(config.database.url).toString();
    }

    console.log('lastAtIndex', lastAtIndex);

    const beforeAt = config.database.url.substring(0, lastAtIndex);
    const afterAt = config.database.url.substring(lastAtIndex + 1);

    // Extract protocol, user, password from the part before @
    const match = beforeAt.match(/^(postgres(?:\+\w+)?:\/\/)([^:]+):(.*)$/);
    console.log('match', match);
    if (!match) {
      // Doesn't match expected format, return original
      return config.database.url;
    }

    const [, protocol, username, password] = match;

    // Percent-encode the password to handle special characters
    // Use encodeURIComponent which encodes: $, !, *, ', (, ), etc.
    const encodedPassword = encodeURIComponent(password);

    // Reconstruct the URL with encoded password
    const encodedUrl = `${protocol}${username}:${encodedPassword}@${afterAt}`;

    console.debug('[config] Database URL password encoded successfully');
    return encodedUrl;
  } catch (error) {
    console.error('[config] Failed to encode database URL:', error);
    // If all else fails, return the original URL and hope for the best
    return config.database.url;
  }
}

/**
 * Get Langfuse exporter configuration
 * Returns array with LangfuseExporter instance if enabled and configured, otherwise returns empty array
 * 
 * Langfuse is only enabled in production (use Mastra playground in development)
 */
export function getLangfuseExporter(): LangfuseExporter[] {
  // Only enable in production
  if (config.app.nodeEnv !== 'production') {
    return [];
  }

  // Check if credentials are provided
  if (!config.langfuse.publicKey || !config.langfuse.secretKey) {
    return [];
  }

  // Return LangfuseExporter instance
  return [
    new LangfuseExporter({
      publicKey: config.langfuse.publicKey,
      secretKey: config.langfuse.secretKey,
      baseUrl: config.langfuse.baseUrl,
      realtime: false, // Batch mode in production
      logLevel: 'warn',
      options: {
        environment: config.app.nodeEnv,
      },
    }),
  ];
}
