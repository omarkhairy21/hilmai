/**
 * Configuration file for HilmAI Agent V2
 *
 * Centralizes environment variable loading and provides typed access
 */

export const config = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    polling: process.env.TELEGRAM_POLLING === 'true',
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
 * Encodes special characters in the password component
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
    // Parse the URL to handle special characters in credentials
    const url = new URL(config.database.url);

    // The URL constructor automatically encodes special characters in credentials
    // Just return the properly formatted URL
    return url.toString();
  } catch {
    // If URL parsing fails, return the original URL
    // This handles cases where the URL might have unusual formatting
    return config.database.url;
  }
}
