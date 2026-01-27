/**
 * Message Processing Workflow for HilmAI Stateless Agent
 *
 * Platform-agnostic workflow that processes messages and delegates to agents
 * Removes Telegram-specific elements (telegramMarkup, messageId)
 */

import {
  createStep,
  createWorkflow,
  type ConditionFunction,
  type DefaultEngineType,
} from '@mastra/core/workflows';
import { z } from 'zod';
import fs from 'fs';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';

import { openai } from '../../lib/openai';
import { AgentResponseCache } from '../../lib/prompt-cache';
import { UserService, type UserMode, supabaseService } from '@hilm/shared';
import { buildMemoryThreadIds, type AgentRole } from '../../lib/memory-factory';

/**
 * Workflow schemas - platform-agnostic
 */
const workflowInputSchema = z.object({
  messageText: z.string().optional(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  userId: z.union([z.number(), z.string()]).describe('User ID: Legacy BIGINT or Mobile UUID string'),
  userMetadata: z
    .object({
      username: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
  requestId: z.string().optional().describe('Generic tracking ID (platform-agnostic)'),
  timezone: z.string().optional(),
});

const workflowOutputSchema = z.object({
  response: z.string(),
  metadata: z.object({
    inputType: z.enum(['text', 'voice', 'photo']),
    cached: z.boolean(),
  }),
  actions: z
    .array(
      z.object({
        label: z.string(),
        action: z.string(),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional()
    .describe('Platform-agnostic actions (replaces telegramMarkup)'),
});

const workflowStateSchema = z.object({});

/**
 * STEP 1: Determine input type + date context
 */
const determineInputTypeOutputSchema = z.object({
  inputType: z.enum(['text', 'voice', 'photo']),
  messageText: z.string().optional(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  currentDate: z.string(),
  currentTime: z.string(),
  yesterday: z.string(),
  userId: z.union([z.number(), z.string()]),
  userMetadata: z
    .object({
      username: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
  requestId: z.string().optional(),
  timezone: z.string(),
});

export type DetermineInputOutput = z.infer<typeof determineInputTypeOutputSchema>;

export function resolveDetermineInputOutput(
  inputData: z.infer<typeof workflowInputSchema>,
  now: Date = new Date()
): DetermineInputOutput {
  const timezone = inputData.timezone ?? 'UTC';
  const currentDate = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  const currentTime = formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const yesterday = subDays(now, 1);
  const yesterdayStr = formatInTimeZone(yesterday, timezone, 'yyyy-MM-dd');

  const sanitizedMessage = inputData.messageText?.trim();
  const hasText = Boolean(sanitizedMessage);
  const hasVoice = Boolean(inputData.voiceFilePath);
  const hasPhoto = Boolean(inputData.photoFilePath);

  let inputType: DetermineInputOutput['inputType'];
  if (hasText) {
    inputType = 'text';
  } else if (hasVoice) {
    inputType = 'voice';
  } else if (hasPhoto) {
    inputType = 'photo';
  } else {
    throw new Error('Unsupported message type. Provide text, voice, or photo input.');
  }

  return {
    inputType,
    messageText: hasText ? sanitizedMessage : undefined,
    voiceFilePath: inputData.voiceFilePath,
    photoFilePath: inputData.photoFilePath,
    currentDate,
    currentTime,
    yesterday: yesterdayStr,
    userId: inputData.userId,
    userMetadata: inputData.userMetadata,
    requestId: inputData.requestId,
    timezone,
  };
}

export const determineInputTypeStep = createStep({
  id: 'determine-input-type',
  description: 'Determine message type and attach date/user context',
  stateSchema: workflowStateSchema,
  inputSchema: workflowInputSchema,
  outputSchema: determineInputTypeOutputSchema,
  execute: async ({ inputData }) => {
    return resolveDetermineInputOutput(inputData);
  },
});

/**
 * STEP 2: Build context-enriched prompt
 */
const buildContextPromptOutputSchema = z.object({
  prompt: z.string(),
  text: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.union([z.number(), z.string()]),
  userMetadata: z
    .object({
      username: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
  requestId: z.string().optional(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  timezone: z.string(),
  defaultCurrency: z.string(),
});

const buildContextPromptStep = createStep({
  id: 'build-context-prompt',
  description: 'Build context-rich prompt for the supervisor agent',
  stateSchema: workflowStateSchema,
  inputSchema: determineInputTypeOutputSchema,
  outputSchema: buildContextPromptOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();

    // Initialize UserService with supabase client and logger
    if (!supabaseService) {
      throw new Error('Supabase service not initialized');
    }
    const userService = new UserService(supabaseService, logger);

    // Get default currency only (user mode will be fetched in separate step)
    const defaultCurrency = await userService.getUserDefaultCurrency(inputData.userId);

    const firstName = inputData.userMetadata?.firstName;
    const lastName = inputData.userMetadata?.lastName;
    const username = inputData.userMetadata?.username;

    // Build context headers (without user mode - will be added later)
    const contextHeaders = [
      `[Current Date: Today is ${inputData.currentDate}, Yesterday was ${inputData.yesterday}]`,
      `[Current Time: ${inputData.currentTime}]`,
      `[User Timezone: ${inputData.timezone}]`,
      `[User: ${firstName || username || 'User'}]`,
      `[User ID: ${inputData.userId}]`,
      `[User Metadata JSON: ${JSON.stringify({ userId: inputData.userId, ...inputData.userMetadata })}]`,
      `[Default Currency: ${defaultCurrency}]`,
      `[Message Type: ${inputData.inputType}]`,
    ];

    const prompt = `${contextHeaders.join('\n')}\n\n${inputData.messageText || ''}`;

    logger.info('[workflow:build-context]', {
      userId: inputData.userId,
      defaultCurrency,
      inputType: inputData.inputType,
    });

    return {
      prompt,
      text: inputData.messageText || '',
      inputType: inputData.inputType,
      userId: inputData.userId,
      userMetadata: inputData.userMetadata,
      requestId: inputData.requestId,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
      timezone: inputData.timezone,
      defaultCurrency,
    };
  },
});

/**
 * STEP 3: Fetch user mode from database
 */
const fetchUserModeOutputSchema = z.object({
  prompt: z.string(),
  text: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.union([z.number(), z.string()]),
  userMode: z.enum(['logger', 'chat', 'query']),
  userMetadata: z
    .object({
      username: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
  requestId: z.string().optional(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  timezone: z.string(),
  defaultCurrency: z.string(),
});

const fetchUserModeStep = createStep({
  id: 'fetch-user-mode',
  description: "Get user's current mode from database",
  stateSchema: workflowStateSchema,
  inputSchema: buildContextPromptOutputSchema,
  outputSchema: fetchUserModeOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    const fetchModeStart = Date.now();

    // Initialize UserService with supabase client and logger
    if (!supabaseService) {
      throw new Error('Supabase service not initialized');
    }
    const userService = new UserService(supabaseService, logger);

    const mode = await userService.getUserMode(inputData.userId);

    const fetchModeDuration = Date.now() - fetchModeStart;
    logger.info('[workflow:performance]', {
      operation: 'fetch_user_mode',
      duration: fetchModeDuration,
      userId: inputData.userId,
      mode,
    });

    // Add user mode to prompt
    const promptWithMode = `${inputData.prompt}\n[User Mode: ${mode}]`;

    return {
      ...inputData,
      prompt: promptWithMode,
      userMode: mode,
    };
  },
});

/**
 * STEP 4: Response cache lookup
 */
const checkCacheOutputSchema = z.object({
  prompt: z.string(),
  text: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.union([z.number(), z.string()]),
  userMode: z.enum(['logger', 'chat', 'query']),
  cachedResponse: z.string().optional(),
  isCached: z.boolean(),
  userMetadata: z
    .object({
      username: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
  requestId: z.string().optional(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  timezone: z.string(),
  defaultCurrency: z.string(),
});

const checkCacheStep = createStep({
  id: 'check-cache',
  description: 'Check agent response cache',
  stateSchema: workflowStateSchema,
  inputSchema: fetchUserModeOutputSchema,
  outputSchema: checkCacheOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    const cacheCheckStart = Date.now();

    const cached = await AgentResponseCache.get(inputData.userId, inputData.text);

    const cacheCheckDuration = Date.now() - cacheCheckStart;
    logger.info('[workflow:performance]', {
      operation: 'cache_check',
      duration: cacheCheckDuration,
      userId: inputData.userId,
      hit: !!cached,
    });

    if (cached) {
      logger.info('[workflow:cache]', {
        event: 'cache_hit',
        userId: inputData.userId,
        inputType: inputData.inputType,
      });

      return {
        prompt: inputData.prompt,
        text: inputData.text,
        inputType: inputData.inputType,
        userId: inputData.userId,
        userMode: inputData.userMode,
        cachedResponse: cached.response,
        isCached: true,
        userMetadata: inputData.userMetadata,
        requestId: inputData.requestId,
        timezone: inputData.timezone,
        voiceFilePath: inputData.voiceFilePath,
        photoFilePath: inputData.photoFilePath,
        defaultCurrency: inputData.defaultCurrency,
      };
    }

    logger.info('[workflow:cache]', {
      event: 'cache_miss',
      userId: inputData.userId,
      inputType: inputData.inputType,
    });

    return {
      prompt: inputData.prompt,
      text: inputData.text,
      inputType: inputData.inputType,
      userId: inputData.userId,
      userMode: inputData.userMode,
      isCached: false,
      userMetadata: inputData.userMetadata,
      requestId: inputData.requestId,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
      timezone: inputData.timezone,
      defaultCurrency: inputData.defaultCurrency,
    };
  },
});

/**
 * STEP 5: Call mode-specific agent (with branching)
 */
const agentInvocationOutputSchema = z.object({
  agentResponse: z.string(),
  text: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.union([z.number(), z.string()]),
  userMode: z.enum(['logger', 'chat', 'query']),
  isCached: z.boolean(),
  userMetadata: z
    .object({
      username: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
  requestId: z.string().optional(),
  timezone: z.string(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
});

type AgentInvocationOutput = z.infer<typeof agentInvocationOutputSchema>;

// Condition functions for mode branching
type ModeBranchConditionFn = ConditionFunction<
  any,
  z.infer<typeof checkCacheOutputSchema>,
  unknown,
  unknown,
  DefaultEngineType
>;

const isLoggerMode: ModeBranchConditionFn = async ({ inputData }) =>
  inputData.userMode === 'logger';

const isQueryMode: ModeBranchConditionFn = async ({ inputData }) =>
  inputData.userMode === 'query';

const isChatMode: ModeBranchConditionFn = async ({ inputData }) =>
  inputData.userMode === 'chat';

/**
 * Logger Mode Agent Step - No memory (fastest)
 */
const invokeLoggerAgentStep = createStep({
  id: 'invoke-logger-agent',
  description: 'Call transaction logger (no memory)',
  stateSchema: workflowStateSchema,
  inputSchema: checkCacheOutputSchema,
  outputSchema: agentInvocationOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    const stepStartTime = Date.now();

    // Return cached response if available
    if (inputData.isCached && inputData.cachedResponse) {
      logger.info('[workflow:logger-agent]', {
        event: 'cache_hit',
        userId: inputData.userId,
      });

      return {
        agentResponse: inputData.cachedResponse,
        text: inputData.text,
        inputType: inputData.inputType,
        userId: inputData.userId,
        userMode: inputData.userMode,
        isCached: true,
        userMetadata: inputData.userMetadata,
        requestId: inputData.requestId,
        timezone: inputData.timezone,
        voiceFilePath: inputData.voiceFilePath,
        photoFilePath: inputData.photoFilePath,
      };
    }

    const agent = mastra.getAgent('transactionLogger');
    if (!agent) {
      throw new Error('Transaction logger agent is not registered in Mastra');
    }

    logger.info('[workflow:logger-agent]', {
      event: 'generate_start',
      userId: inputData.userId,
      inputType: inputData.inputType,
    });

    // Logger mode: NO memory (fastest) - agent configured with undefined memory
    // Note: Mastra workflowRoute with includeTextStreamParts:true will automatically
    // stream agent responses - we use generate() and workflowRoute handles streaming
    const memoryStartTime = Date.now();
    const genResult = await agent.generate(inputData.prompt);

    const memoryDuration = Date.now() - memoryStartTime;
    logger.info('[workflow:memory]', {
      operation: 'logger_agent_memory',
      duration: memoryDuration,
      userId: inputData.userId,
      hasMemory: false,
    });

    const duration = Date.now() - stepStartTime;
    logger.info('[workflow:performance]', {
      operation: 'logger_agent_complete',
      duration,
      userId: inputData.userId,
      responseLength: genResult.text?.length || 0,
    });

    return {
      agentResponse: genResult.text ?? 'Transaction saved.',
      text: inputData.text,
      inputType: inputData.inputType,
      userId: inputData.userId,
      userMode: inputData.userMode,
      isCached: false,
      userMetadata: inputData.userMetadata,
      requestId: inputData.requestId,
      timezone: inputData.timezone,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
    };
  },
});

/**
 * Query Mode Agent Step - Minimal memory (3 messages)
 */
const invokeQueryAgentStep = createStep({
  id: 'invoke-query-agent',
  description: 'Call query executor (minimal memory)',
  stateSchema: workflowStateSchema,
  inputSchema: checkCacheOutputSchema,
  outputSchema: agentInvocationOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    const stepStartTime = Date.now();

    // Return cached response if available
    if (inputData.isCached && inputData.cachedResponse) {
      logger.info('[workflow:query-agent]', {
        event: 'cache_hit',
        userId: inputData.userId,
      });

      return {
        agentResponse: inputData.cachedResponse,
        text: inputData.text,
        inputType: inputData.inputType,
        userId: inputData.userId,
        userMode: inputData.userMode,
        isCached: true,
        userMetadata: inputData.userMetadata,
        requestId: inputData.requestId,
        timezone: inputData.timezone,
        voiceFilePath: inputData.voiceFilePath,
        photoFilePath: inputData.photoFilePath,
      };
    }

    const agent = mastra.getAgent('queryExecutor');
    if (!agent) {
      throw new Error('Query executor agent is not registered in Mastra');
    }

    logger.info('[workflow:query-agent]', {
      event: 'generate_start',
      userId: inputData.userId,
      inputType: inputData.inputType,
    });

    // Query mode: Use role-based memory (configured at agent definition level)
    const threadIds = buildMemoryThreadIds(inputData.userId, 'query');

    // Note: Mastra workflowRoute with includeTextStreamParts:true will automatically
    // stream agent responses - we use generate() and workflowRoute handles streaming
    const memoryStartTime = Date.now();
    const genResult = await agent.generate(inputData.prompt, {
      memory: {
        thread: threadIds.thread,
        resource: threadIds.resource,
      },
    });

    const memoryDuration = Date.now() - memoryStartTime;
    logger.info('[workflow:memory]', {
      operation: 'query_agent_memory',
      duration: memoryDuration,
      userId: inputData.userId,
      thread: threadIds.thread,
      resource: threadIds.resource,
    });

    const duration = Date.now() - stepStartTime;
    logger.info('[workflow:performance]', {
      operation: 'query_agent_complete',
      duration,
      userId: inputData.userId,
      responseLength: genResult.text?.length || 0,
    });

    return {
      agentResponse: genResult.text ?? 'No results found.',
      text: inputData.text,
      inputType: inputData.inputType,
      userId: inputData.userId,
      userMode: inputData.userMode,
      isCached: false,
      userMetadata: inputData.userMetadata,
      requestId: inputData.requestId,
      timezone: inputData.timezone,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
    };
  },
});

/**
 * Chat Mode Agent Step - Minimal memory (3 messages)
 */
const invokeChatAgentStep = createStep({
  id: 'invoke-chat-agent',
  description: 'Call conversation agent (minimal memory)',
  stateSchema: workflowStateSchema,
  inputSchema: checkCacheOutputSchema,
  outputSchema: agentInvocationOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();
    const stepStartTime = Date.now();

    // Return cached response if available
    if (inputData.isCached && inputData.cachedResponse) {
      logger.info('[workflow:chat-agent]', {
        event: 'cache_hit',
        userId: inputData.userId,
      });

      return {
        agentResponse: inputData.cachedResponse,
        text: inputData.text,
        inputType: inputData.inputType,
        userId: inputData.userId,
        userMode: inputData.userMode,
        isCached: true,
        userMetadata: inputData.userMetadata,
        requestId: inputData.requestId,
        timezone: inputData.timezone,
        voiceFilePath: inputData.voiceFilePath,
        photoFilePath: inputData.photoFilePath,
      };
    }

    const agent = mastra.getAgent('conversation');
    if (!agent) {
      throw new Error('Conversation agent is not registered in Mastra');
    }

    logger.info('[workflow:chat-agent]', {
      event: 'generate_start',
      userId: inputData.userId,
      inputType: inputData.inputType,
    });

    // Chat mode: Use role-based memory (configured at agent definition level)
    const threadIds = buildMemoryThreadIds(inputData.userId, 'conversation');

    // Note: Mastra workflowRoute with includeTextStreamParts:true will automatically
    // stream agent responses - we use generate() and workflowRoute handles streaming
    const memoryStartTime = Date.now();
    const genResult = await agent.generate(inputData.prompt, {
      memory: {
        thread: threadIds.thread,
        resource: threadIds.resource,
      },
    });

    const memoryDuration = Date.now() - memoryStartTime;
    logger.info('[workflow:memory]', {
      operation: 'chat_agent_memory',
      duration: memoryDuration,
      userId: inputData.userId,
      thread: threadIds.thread,
      resource: threadIds.resource,
    });

    const duration = Date.now() - stepStartTime;
    logger.info('[workflow:performance]', {
      operation: 'chat_agent_complete',
      duration,
      userId: inputData.userId,
      responseLength: genResult.text?.length || 0,
    });

    return {
      agentResponse: genResult.text ?? 'How can I help?',
      text: inputData.text,
      inputType: inputData.inputType,
      userId: inputData.userId,
      userMode: inputData.userMode,
      isCached: false,
      userMetadata: inputData.userMetadata,
      requestId: inputData.requestId,
      timezone: inputData.timezone,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
    };
  },
});

/**
 * Unwrap branch output (normalize the three agent step outputs)
 */
const agentBranchOutputSchema = z.object({
  'invoke-logger-agent': agentInvocationOutputSchema.optional(),
  'invoke-query-agent': agentInvocationOutputSchema.optional(),
  'invoke-chat-agent': agentInvocationOutputSchema.optional(),
});

const unwrapAgentResponseStep = createStep({
  id: 'unwrap-agent-response',
  description: 'Normalize branch output from mode-specific agents',
  stateSchema: workflowStateSchema,
  inputSchema: agentBranchOutputSchema,
  outputSchema: agentInvocationOutputSchema,
  execute: async ({ inputData }) => {
    const candidates: Array<AgentInvocationOutput | undefined> = [
      inputData['invoke-logger-agent'],
      inputData['invoke-query-agent'],
      inputData['invoke-chat-agent'],
    ];

    const match = candidates.find((entry): entry is AgentInvocationOutput => !!entry);
    if (!match) {
      throw new Error(
        'No agent invocation output detected. Ensure the branch step returned a value.'
      );
    }

    return match;
  },
});

/**
 * STEP 6: Cache reusable responses
 */
const cacheResponseOutputSchema = z.object({
  response: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.union([z.number(), z.string()]),
  cached: z.boolean(),
});

const cacheResponseStep = createStep({
  id: 'cache-response',
  description: 'Cache query/help responses for faster follow-ups',
  stateSchema: workflowStateSchema,
  inputSchema: agentInvocationOutputSchema,
  outputSchema: cacheResponseOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger();

    // Cache response if appropriate (queries and help, not transactions)
    if (!inputData.isCached && (inputData.userMode === 'query' || inputData.userMode === 'chat')) {
      const cacheSetStart = Date.now();
      const cacheKey = inputData.text.trim().toLowerCase();

      await AgentResponseCache.set(inputData.userId, cacheKey, {
        response: inputData.agentResponse,
        metadata: {
          userMode: inputData.userMode,
          inputType: inputData.inputType,
          cachedAt: new Date().toISOString(),
        },
      });

      const cacheSetDuration = Date.now() - cacheSetStart;
      logger.info('[workflow:performance]', {
        operation: 'cache_set',
        duration: cacheSetDuration,
        userId: inputData.userId,
      });

      logger.info('[workflow:cache]', {
        event: 'response_cached',
        userId: inputData.userId,
        inputType: inputData.inputType,
      });

      return {
        response: inputData.agentResponse,
        inputType: inputData.inputType,
        userId: inputData.userId,
        cached: true,
      };
    }

    logger.debug('[workflow:cache]', {
      event: 'skip_caching',
      userId: inputData.userId,
      reason: inputData.isCached ? 'already_cached' : 'not_cacheable',
    });

    return {
      response: inputData.agentResponse,
      inputType: inputData.inputType,
      userId: inputData.userId,
      cached: inputData.isCached,
    };
  },
});

/**
 * STEP 7: Format output
 */
const formatOutputStep = createStep({
  id: 'format-output',
  description: 'Format workflow output',
  stateSchema: workflowStateSchema,
  inputSchema: cacheResponseOutputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    return {
      response: inputData.response,
      metadata: {
        inputType: inputData.inputType,
        cached: inputData.cached,
      },
      // Actions can be added here if needed for platform-specific UI
      actions: undefined,
    };
  },
});

/**
 * Main workflow
 */
export const messageProcessingWorkflow = createWorkflow<
  'message-processing',
  typeof workflowStateSchema,
  typeof workflowInputSchema,
  typeof workflowOutputSchema
>({
  id: 'message-processing',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  stateSchema: workflowStateSchema,
})
  .then(determineInputTypeStep)
  .then(buildContextPromptStep)
  .then(fetchUserModeStep)
  .then(checkCacheStep)
  .branch([
    // Branch on mode instead of single agent selection
    [isLoggerMode, invokeLoggerAgentStep],
    [isQueryMode, invokeQueryAgentStep],
    [isChatMode, invokeChatAgentStep],
  ])
  .then(unwrapAgentResponseStep)
  .then(cacheResponseStep)
  .then(formatOutputStep)
  .commit();

