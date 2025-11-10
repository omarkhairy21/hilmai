/**
 * Usage Tracker - AI Span Processor
 *
 * Tracks token usage across workflow runs using Mastra AI tracing
 */

import { recordTokenUsage } from '../services/subscription.service';

// Type definitions for AI tracing (matching Mastra's internal types)
interface AISpanProcessor {
  name: string;
  process(span?: any): any;
  shutdown(): Promise<void>;
}

type AnyAISpan = any;

/**
 * Custom AI span processor that tracks token usage
 *
 * This processor intercepts MODEL_GENERATION spans and aggregates
 * token usage, then persists it to the subscription_usage table
 */
export class UsageTrackingProcessor implements AISpanProcessor {
  name = 'usage-tracking-processor';

  private workflowTokens = new Map<string, { userId: number; totalTokens: number }>();

  /**
   * Process each span and aggregate token usage
   */
  process(span?: AnyAISpan): AnyAISpan | undefined {
    if (!span) {
      return undefined;
    }

    // Track MODEL_GENERATION spans for token usage
    if (span.type === 'MODEL_GENERATION' && span.attributes?.usage?.totalTokens) {
      const tokens = span.attributes.usage.totalTokens;

      // Find the root WORKFLOW_RUN span to get user context
      let currentSpan: AnyAISpan | undefined = span;
      let workflowSpan: AnyAISpan | undefined;

      while (currentSpan) {
        if (currentSpan.type === 'WORKFLOW_RUN') {
          workflowSpan = currentSpan;
          break;
        }
        currentSpan = currentSpan.parent;
      }

      if (workflowSpan) {
        const traceId = workflowSpan.traceId;

        // Aggregate tokens for this workflow run
        const existing = this.workflowTokens.get(traceId);
        if (existing) {
          existing.totalTokens += tokens;
        } else {
          // Try to extract userId from workflow metadata or input
          const userId = this.extractUserId(workflowSpan);
          if (userId) {
            this.workflowTokens.set(traceId, { userId, totalTokens: tokens });
          }
        }
      }
    }

    // When workflow completes, persist the aggregated usage
    if (span.type === 'WORKFLOW_RUN' && span.output) {
      const traceId = span.traceId;
      const usage = this.workflowTokens.get(traceId);

      if (usage) {
        // Persist usage asynchronously (don't block workflow completion)
        recordTokenUsage(usage.userId, usage.totalTokens).catch((error) => {
          console.error('[usage-tracker] Failed to record usage:', error);
        });

        // Clean up
        this.workflowTokens.delete(traceId);
      }
    }

    return span;
  }

  /**
   * Extract userId from workflow span metadata or input
   */
  private extractUserId(workflowSpan: AnyAISpan): number | null {
    try {
      // Try metadata first
      if (workflowSpan.metadata?.userId) {
        return typeof workflowSpan.metadata.userId === 'number'
          ? workflowSpan.metadata.userId
          : parseInt(workflowSpan.metadata.userId, 10);
      }

      // Try input data
      if (workflowSpan.input?.userId) {
        return typeof workflowSpan.input.userId === 'number'
          ? workflowSpan.input.userId
          : parseInt(workflowSpan.input.userId, 10);
      }

      return null;
    } catch (error) {
      console.error('[usage-tracker] Failed to extract userId:', error);
      return null;
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    // Persist any remaining usage data
    const promises: Promise<void>[] = [];

    for (const entry of Array.from(this.workflowTokens.entries())) {
      const [traceId, usage] = entry;
      promises.push(
        recordTokenUsage(usage.userId, usage.totalTokens).catch((error) => {
          console.error('[usage-tracker] Failed to record usage on shutdown:', error);
        })
      );
    }

    await Promise.all(promises);
    this.workflowTokens.clear();
  }
}
