/**
 * Health Check API Handler
 * 
 * Provides a simple health check endpoint for monitoring
 */

import type { Context } from 'hono';
import type { Mastra } from '@mastra/core/mastra';

export async function handleHealthCheck(c: Context, mastra: Mastra) {
  const logger = mastra.getLogger();
  
  logger.debug('[api:health]', {
    event: 'health_check',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
  
  return c.json({
    status: 'ok',
    service: 'hilm-ai-agent-v2',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

