/**
 * Message Processing Workflow for HilmAI Agent V2
 *
 * End-to-end pipeline that normalizes Telegram input and delegates to the
 * supervisor agent with full observability in Mastra.
 *
 * Flow:
 * 1. Decode the inbound payload and derive input type + date context
 * 2. Branch into specialized processing for voice, photo, or text
 * 3. Build a context-rich prompt for the supervisor agent
 * 4. Check the response cache and short-circuit if possible
 * 5. Call the supervisor agent (with Mastra memory enabled)
 * 6. Cache query/help responses when appropriate
 * 7. Clean up any temporary media files
 */

import {
  createStep,
  createWorkflow,
  type ConditionFunction,
  type DefaultEngineType,
} from '@mastra/core/workflows';
import { z } from 'zod';
import fs from 'fs';

import { openai } from '../../lib/openai';
import { deleteFile } from '../../lib/file-utils';
import { AgentResponseCache } from '../../lib/prompt-cache';
import { shouldCacheResponse } from '../../lib/input-normalization';

/**
 * Shared schemas and types
 */
const workflowInputSchema = z.object({
  messageText: z.string().optional(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  userId: z.number(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
});

const workflowOutputSchema = z.object({
  response: z.string(),
  metadata: z.object({
    inputType: z.enum(['text', 'voice', 'photo']),
    cached: z.boolean(),
    intent: z.string().optional(),
  }),
  telegramMarkup: z
    .object({
      inline_keyboard: z.array(
        z.array(
          z.object({
            text: z.string(),
            callback_data: z.string(),
          })
        )
      ),
    })
    .optional(),
});

const workflowStateSchema = z.object({});

type WorkflowInput = z.infer<typeof workflowInputSchema>;
type WorkflowOutput = z.infer<typeof workflowOutputSchema>;

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
  userId: z.number(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
});

type DetermineInputOutput = z.infer<typeof determineInputTypeOutputSchema>;

const determineInputTypeStep = createStep({
  id: 'determine-input-type',
  description: 'Determine message type and attach date/user context',
  stateSchema: workflowStateSchema,
  inputSchema: workflowInputSchema,
  outputSchema: determineInputTypeOutputSchema,
  execute: async ({ inputData }) => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toISOString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let inputType: DetermineInputOutput['inputType'];
    if (inputData.messageText) {
      inputType = 'text';
    } else if (inputData.voiceFilePath) {
      inputType = 'voice';
    } else if (inputData.photoFilePath) {
      inputType = 'photo';
    } else {
      throw new Error('Unsupported message type. Provide text, voice, or photo input.');
    }

    const result: DetermineInputOutput = {
      inputType,
      messageText: inputData.messageText,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
      currentDate,
      currentTime,
      yesterday: yesterdayStr,
      userId: inputData.userId,
      username: inputData.username,
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      messageId: inputData.messageId,
    };
    return result;
  },
});

/**
 * STEP 2A: Transcribe voice input
 */
const transcribeVoiceOutputSchema = z.object({
  text: z.string(),
  inputType: z.literal('voice'),
  currentDate: z.string(),
  currentTime: z.string(),
  yesterday: z.string(),
  userId: z.number(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
  voiceFilePath: z.string(),
  photoFilePath: z.string().optional(),
});

type TranscribeVoiceOutput = z.infer<typeof transcribeVoiceOutputSchema>;

const transcribeVoiceStep = createStep({
  id: 'transcribe-voice',
  description: 'Transcribe voice message using Whisper',
  stateSchema: workflowStateSchema,
  inputSchema: determineInputTypeOutputSchema,
  outputSchema: transcribeVoiceOutputSchema,
  execute: async ({ inputData }) => {
    const audioFilePath = inputData.voiceFilePath;
    if (!audioFilePath) {
      throw new Error('Voice file path missing for transcription');
    }

    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const audioStream = fs.createReadStream(audioFilePath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'text',
      temperature: 0.0,
    });

    const result: TranscribeVoiceOutput = {
      text: transcription,
      inputType: 'voice',
      currentDate: inputData.currentDate,
      currentTime: inputData.currentTime,
      yesterday: inputData.yesterday,
      userId: inputData.userId,
      username: inputData.username,
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      messageId: inputData.messageId,
      voiceFilePath: audioFilePath,
      photoFilePath: inputData.photoFilePath,
    };
    return result;
  },
});

/**
 * STEP 2B: Extract text from receipt photo
 */
const extractFromPhotoOutputSchema = z.object({
  text: z.string(),
  inputType: z.literal('photo'),
  currentDate: z.string(),
  currentTime: z.string(),
  yesterday: z.string(),
  userId: z.number(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string(),
});

type ExtractFromPhotoOutput = z.infer<typeof extractFromPhotoOutputSchema>;

const extractFromPhotoStep = createStep({
  id: 'extract-from-photo',
  description: 'Extract text from photo using GPT-4o Vision',
  stateSchema: workflowStateSchema,
  inputSchema: determineInputTypeOutputSchema,
  outputSchema: extractFromPhotoOutputSchema,
  execute: async ({ inputData }) => {
    const imageFilePath = inputData.photoFilePath;
    if (!imageFilePath) {
      throw new Error('Photo file path missing for extraction');
    }

    if (!fs.existsSync(imageFilePath)) {
      throw new Error(`Image file not found: ${imageFilePath}`);
    }

    const imageBuffer = fs.readFileSync(imageFilePath);
    const mimeType = imageFilePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the text and transaction details from this image.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.0,
    });

    const extractedText = response.choices[0]?.message?.content;
    if (!extractedText) {
      throw new Error('No text extracted from the provided image');
    }

    const result: ExtractFromPhotoOutput = {
      text: extractedText,
      inputType: 'photo',
      currentDate: inputData.currentDate,
      currentTime: inputData.currentTime,
      yesterday: inputData.yesterday,
      userId: inputData.userId,
      username: inputData.username,
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      messageId: inputData.messageId,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: imageFilePath,
    };
    return result;
  },
});

/**
 * STEP 2C: Pass-through text input
 */
const passTextOutputSchema = z.object({
  text: z.string(),
  inputType: z.literal('text'),
  currentDate: z.string(),
  currentTime: z.string(),
  yesterday: z.string(),
  userId: z.number(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
});

type PassTextOutput = z.infer<typeof passTextOutputSchema>;

const passTextStep = createStep({
  id: 'pass-text',
  description: 'Pass-through text input',
  stateSchema: workflowStateSchema,
  inputSchema: determineInputTypeOutputSchema,
  outputSchema: passTextOutputSchema,
  execute: async ({ inputData }) => {
    const text = inputData.messageText;
    if (!text) {
      throw new Error('Message text missing for text input');
    }

    const result: PassTextOutput = {
      text,
      inputType: 'text',
      currentDate: inputData.currentDate,
      currentTime: inputData.currentTime,
      yesterday: inputData.yesterday,
      userId: inputData.userId,
      username: inputData.username,
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      messageId: inputData.messageId,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
    };
    return result;
  },
});

type ProcessedInput = TranscribeVoiceOutput | ExtractFromPhotoOutput | PassTextOutput;

const processedInputSchema = z.union([
  transcribeVoiceOutputSchema,
  extractFromPhotoOutputSchema,
  passTextOutputSchema,
]);

const branchOutputSchema = z.object({
  'transcribe-voice': transcribeVoiceOutputSchema.optional(),
  'extract-from-photo': extractFromPhotoOutputSchema.optional(),
  'pass-text': passTextOutputSchema.optional(),
});

type BranchOutput = z.infer<typeof branchOutputSchema>;

const unwrapProcessedInputStep = createStep({
  id: 'unwrap-processed-input',
  description: 'Normalize branch output into a unified processed input object',
  stateSchema: workflowStateSchema,
  inputSchema: branchOutputSchema,
  outputSchema: processedInputSchema,
  execute: async ({ inputData }) => {
    const candidates: Array<ProcessedInput | undefined> = [
      inputData['transcribe-voice'],
      inputData['extract-from-photo'],
      inputData['pass-text'],
    ];

    const match = candidates.find((entry): entry is ProcessedInput => !!entry);
    if (!match) {
      throw new Error('No branch output detected. Ensure the branch step returned a value.');
    }

    return match;
  },
});

type BranchConditionFn = ConditionFunction<
  any,
  DetermineInputOutput,
  unknown,
  unknown,
  DefaultEngineType
>;

const voiceCondition: BranchConditionFn = async ({ inputData }) => inputData.inputType === 'voice';

const photoCondition: BranchConditionFn = async ({ inputData }) => inputData.inputType === 'photo';

const textCondition: BranchConditionFn = async ({ inputData }) => inputData.inputType === 'text';

/**
 * STEP 3: Build context-enriched prompt
 */
const buildContextPromptOutputSchema = z.object({
  prompt: z.string(),
  text: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.number(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
});

type BuildContextOutput = z.infer<typeof buildContextPromptOutputSchema>;

const buildContextPromptStep = createStep({
  id: 'build-context-prompt',
  description: 'Build context-rich prompt for the supervisor agent',
  stateSchema: workflowStateSchema,
  inputSchema: processedInputSchema,
  outputSchema: buildContextPromptOutputSchema,
  execute: async ({ inputData }) => {
    const userMetadata = {
      userId: inputData.userId,
      telegramChatId: inputData.userId,
      username: inputData.username ?? null,
      firstName: inputData.firstName ?? null,
      lastName: inputData.lastName ?? null,
      messageId: inputData.messageId,
    };

    const contextLines = [
      `[Current Date: Today is ${inputData.currentDate}, Yesterday was ${inputData.yesterday}]`,
      `[User: ${inputData.firstName || 'Unknown'} (@${inputData.username || 'unknown'})]`,
      `[User ID: ${inputData.userId}]`,
      `[Message ID: ${inputData.messageId}]`,
      `[User Metadata JSON: ${JSON.stringify(userMetadata)}]`,
      `[Message Type: ${inputData.inputType}]`,
      '',
      inputData.text,
    ];

    console.log(
      `[workflow:build-context] Building prompt for supervisor with date context: today=${inputData.currentDate}, yesterday=${inputData.yesterday}`
    );
    console.log(`[workflow:build-context] User metadata: ${JSON.stringify(userMetadata)}`);

    const result: BuildContextOutput = {
      prompt: contextLines.join('\n'),
      text: inputData.text,
      inputType: inputData.inputType,
      userId: inputData.userId,
      username: inputData.username,
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      messageId: inputData.messageId,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
    };
    return result;
  },
});

/**
 * STEP 4: Response cache lookup
 */
const checkCacheOutputSchema = z.object({
  prompt: z.string(),
  text: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.number(),
  cachedResponse: z.string().optional(),
  isCached: z.boolean(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
});

type CheckCacheOutput = z.infer<typeof checkCacheOutputSchema>;

const checkCacheStep = createStep({
  id: 'check-cache',
  description: 'Check agent response cache',
  stateSchema: workflowStateSchema,
  inputSchema: buildContextPromptOutputSchema,
  outputSchema: checkCacheOutputSchema,
  execute: async ({ inputData }) => {
    const cached = await AgentResponseCache.get(inputData.userId, inputData.text);

    if (cached) {
      const result: CheckCacheOutput = {
        prompt: inputData.prompt,
        text: inputData.text,
        inputType: inputData.inputType,
        userId: inputData.userId,
        cachedResponse: cached.response,
        isCached: true,
        username: inputData.username,
        firstName: inputData.firstName,
        lastName: inputData.lastName,
        messageId: inputData.messageId,
        voiceFilePath: inputData.voiceFilePath,
        photoFilePath: inputData.photoFilePath,
      };
      return result;
    }

    const result: CheckCacheOutput = {
      prompt: inputData.prompt,
      text: inputData.text,
      inputType: inputData.inputType,
      userId: inputData.userId,
      isCached: false,
      username: inputData.username,
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      messageId: inputData.messageId,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
    };
    return result;
  },
});

/**
 * STEP 5: Call supervisor agent
 */
const supervisorAgentOutputSchema = z.object({
  agentResponse: z.string(),
  text: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.number(),
  isCached: z.boolean(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  messageId: z.number(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  telegramMarkup: z
    .object({
      inline_keyboard: z.array(
        z.array(
          z.object({
            text: z.string(),
            callback_data: z.string(),
          })
        )
      ),
    })
    .optional(),
});

type SupervisorAgentOutput = z.infer<typeof supervisorAgentOutputSchema>;

const supervisorAgentStep = createStep({
  id: 'supervisor-agent',
  description: 'Invoke supervisor agent when cache misses',
  stateSchema: workflowStateSchema,
  inputSchema: checkCacheOutputSchema,
  outputSchema: supervisorAgentOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (inputData.isCached && inputData.cachedResponse) {
      const result: SupervisorAgentOutput = {
        agentResponse: inputData.cachedResponse,
        text: inputData.text,
        inputType: inputData.inputType,
        userId: inputData.userId,
        isCached: true,
        username: inputData.username,
        firstName: inputData.firstName,
        lastName: inputData.lastName,
        messageId: inputData.messageId,
        voiceFilePath: inputData.voiceFilePath,
        photoFilePath: inputData.photoFilePath,
      };
      return result;
    }

    const supervisorAgent = mastra.getAgent('supervisor');
    if (!supervisorAgent) {
      throw new Error('Supervisor agent is not registered in Mastra');
    }

    const generation = await supervisorAgent.generate(inputData.prompt, {
      memory: {
        thread: `user-${inputData.userId}`, // Single thread per user for all messages
        resource: inputData.userId.toString(), // Resource ID for resource-scoped memory
      },
    });

    const rawResponse = generation.text ?? 'Sorry, I encountered an issue processing that.';

    // Parse JSON response if it contains markup (from query executor agent)
    let agentResponse: string = rawResponse;
    let telegramMarkup: SupervisorAgentOutput['telegramMarkup'] = undefined;

    try {
      // Try to parse as JSON (agent may return JSON with text and markup)
      const parsed = JSON.parse(rawResponse.trim());
      if (parsed.text && parsed.markup) {
        agentResponse = parsed.text;
        telegramMarkup = parsed.markup;
        console.log('[workflow:supervisor-agent] Parsed JSON response with markup');
      }
    } catch {
      // Not JSON - try to extract transaction IDs from response and generate markup
      // Look for patterns like [ID: 123] in the text
      const transactionIdPattern = /\[ID:\s*(\d+)\]/gi;
      const matches = Array.from(rawResponse.matchAll(transactionIdPattern));
      
      // Also check if response contains transaction lists (has multiple transactions)
      // Look for patterns that suggest transaction listing (e.g., numbered lists, dates, amounts)
      const hasTransactionList = 
        /\d+\.\s+.*-.*\d+.*\(.*\d{4}-\d{2}-\d{2}\)/i.test(rawResponse) ||
        (rawResponse.match(/\d{4}-\d{2}-\d{2}/g)?.length ?? 0) > 1 ||
        matches.length > 0;
      
      if (hasTransactionList && matches.length > 0) {
        // Extract transaction IDs from matches
        const transactionIds: number[] = [];
        for (const match of matches) {
          const id = parseInt(match[1], 10);
          if (!isNaN(id) && !transactionIds.includes(id)) {
            transactionIds.push(id);
          }
        }
        
        // If we found transaction IDs, generate markup
        if (transactionIds.length > 0) {
          telegramMarkup = {
            inline_keyboard: transactionIds.map((id) => [
              { text: 'Edit', callback_data: `edit_${id}` },
              { text: 'Delete', callback_data: `delete_${id}` },
            ]),
          };
          console.log(`[workflow:supervisor-agent] Generated markup for ${transactionIds.length} transactions: ${transactionIds.join(', ')}`);
        }
      }
      
      agentResponse = rawResponse;
    }

    const result: SupervisorAgentOutput = {
      agentResponse,
      text: inputData.text,
      inputType: inputData.inputType,
      userId: inputData.userId,
      isCached: false,
      username: inputData.username,
      firstName: inputData.firstName,
      lastName: inputData.lastName,
      messageId: inputData.messageId,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
      telegramMarkup,
    };
    return result;
  },
});

/**
 * STEP 6: Cache reusable responses
 */
const cacheResponseOutputSchema = z.object({
  response: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  userId: z.number(),
  cached: z.boolean(),
  voiceFilePath: z.string().optional(),
  photoFilePath: z.string().optional(),
  telegramMarkup: z
    .object({
      inline_keyboard: z.array(
        z.array(
          z.object({
            text: z.string(),
            callback_data: z.string(),
          })
        )
      ),
    })
    .optional(),
});

type CacheResponseOutput = z.infer<typeof cacheResponseOutputSchema>;

const cacheResponseStep = createStep({
  id: 'cache-response',
  description: 'Cache query/help responses for faster follow-ups',
  stateSchema: workflowStateSchema,
  inputSchema: supervisorAgentOutputSchema,
  outputSchema: cacheResponseOutputSchema,
  execute: async ({ inputData }) => {
    if (!inputData.isCached && shouldCacheResponse(inputData.text)) {
      await AgentResponseCache.set(inputData.userId, inputData.text, {
        response: inputData.agentResponse,
        metadata: {
          inputType: inputData.inputType,
          cachedAt: new Date().toISOString(),
        },
      });

      const result: CacheResponseOutput = {
        response: inputData.agentResponse,
        inputType: inputData.inputType,
        userId: inputData.userId,
        cached: true,
        voiceFilePath: inputData.voiceFilePath,
        photoFilePath: inputData.photoFilePath,
        telegramMarkup: inputData.telegramMarkup,
      };
      return result;
    }

    const result: CacheResponseOutput = {
      response: inputData.agentResponse,
      inputType: inputData.inputType,
      userId: inputData.userId,
      cached: inputData.isCached,
      voiceFilePath: inputData.voiceFilePath,
      photoFilePath: inputData.photoFilePath,
      telegramMarkup: inputData.telegramMarkup,
    };
    return result;
  },
});

/**
 * STEP 7: Cleanup temporary files and format final result
 */
const cleanupInputSchema = workflowInputSchema.extend({
  response: z.string(),
  inputType: z.enum(['text', 'voice', 'photo']),
  cached: z.boolean(),
  telegramMarkup: z
    .object({
      inline_keyboard: z.array(
        z.array(
          z.object({
            text: z.string(),
            callback_data: z.string(),
          })
        )
      ),
    })
    .optional(),
});

const cleanupOutputSchema = workflowOutputSchema;

const cleanupFilesStep = createStep({
  id: 'cleanup-files',
  description: 'Clean up temporary voice/photo files',
  stateSchema: workflowStateSchema,
  inputSchema: cleanupInputSchema,
  outputSchema: cleanupOutputSchema,
  execute: async ({ inputData }) => {
    const deletions: Promise<void>[] = [];

    if (inputData.voiceFilePath) {
      deletions.push(
        deleteFile(inputData.voiceFilePath).catch((error) => {
          console.warn('[workflow:message-processing] Voice cleanup failed', {
            error,
          });
        })
      );
    }

    if (inputData.photoFilePath) {
      deletions.push(
        deleteFile(inputData.photoFilePath).catch((error) => {
          console.warn('[workflow:message-processing] Photo cleanup failed', {
            error,
          });
        })
      );
    }

    await Promise.all(deletions);

    const result: WorkflowOutput = {
      response: inputData.response,
      metadata: {
        inputType: inputData.inputType,
        cached: inputData.cached,
      },
      telegramMarkup: inputData.telegramMarkup,
    };
    return result;
  },
});

/**
 * MAIN WORKFLOW
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
  .branch([
    [voiceCondition, transcribeVoiceStep],
    [photoCondition, extractFromPhotoStep],
    [textCondition, passTextStep],
  ])
  .then(unwrapProcessedInputStep)
  .then(buildContextPromptStep)
  .then(checkCacheStep)
  .then(supervisorAgentStep)
  .then(cacheResponseStep)
  .then(
    createStep({
      id: 'cleanup-router',
      description: 'Attach original file paths for cleanup',
      stateSchema: workflowStateSchema,
      inputSchema: cacheResponseOutputSchema,
      outputSchema: cleanupInputSchema,
      execute: async ({ inputData, getInitData }) => {
        const init = getInitData<typeof workflowInputSchema>();
        return {
          ...init,
          response: inputData.response,
          inputType: inputData.inputType,
          cached: inputData.cached,
          telegramMarkup: inputData.telegramMarkup,
        };
      },
    })
  )
  .then(cleanupFilesStep)
  .commit();
