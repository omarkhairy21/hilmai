import type { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';

type Logger = ReturnType<Mastra['getLogger']>;

const HEARTBEAT_ENV_KEY = 'BOT_HEARTBEAT_INTERVAL_MS';
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Registers lifecycle observability for the Telegram bot.
 *  - Emits a heartbeat log on a configurable cadence
 *  - Logs startup diagnostics (bot identity, environment)
 *  - Logs shutdown signals and ensures graceful bot stop
 */
export function registerBotHealth(bot: Bot, logger: Logger): void {
  const heartbeatIntervalMs = resolveHeartbeatInterval();

  // Startup diagnostics (fire and forget)
  void announceBotIdentity(bot, logger);

  // Heartbeat logger to confirm the process is still alive
  let heartbeatTimer: NodeJS.Timeout | undefined;
  if (heartbeatIntervalMs > 0) {
    heartbeatTimer = setInterval(() => {
      logger.info('bot:heartbeat', {
        uptimeSeconds: Math.round(process.uptime()),
        memoryRss: process.memoryUsage().rss,
      });
    }, heartbeatIntervalMs);
    heartbeatTimer.unref?.();

    logger.debug('bot:heartbeat_registered', {
      intervalMs: heartbeatIntervalMs,
    });
  }

  // Graceful shutdown on signals
  const handleSignal = async (signal: NodeJS.Signals) => {
    logger.warn('bot:shutdown_signal', { signal });
    try {
      await bot.stop();
      logger.info('bot:shutdown_complete', { signal });
    } catch (error) {
      logger.error('bot:shutdown_error', {
        signal,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    }
  };

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.once(signal, () => {
      void handleSignal(signal);
    });
  });

  process.once('beforeExit', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    logger.info('bot:process_before_exit');
  });
}

function resolveHeartbeatInterval(): number {
  const value = process.env[HEARTBEAT_ENV_KEY];
  if (!value) {
    return DEFAULT_HEARTBEAT_INTERVAL_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return DEFAULT_HEARTBEAT_INTERVAL_MS;
  }

  return parsed;
}

async function announceBotIdentity(bot: Bot, logger: Logger): Promise<void> {
  try {
    const me = await bot.api.getMe();
    logger.info('bot:ready', {
      id: me.id,
      username: me.username,
      firstName: me.first_name,
      canJoinGroups: me.can_join_groups,
      supportsInlineQueries: me.supports_inline_queries,
    });
  } catch (error) {
    logger.warn('bot:identity_lookup_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
