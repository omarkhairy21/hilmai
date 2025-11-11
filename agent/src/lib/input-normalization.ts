/**
 * Input Normalization Library for HilmAI Agent V2
 *
 * Unified input processing for all message types:
 * - Text messages (pass-through)
 * - Voice messages (transcribe with Whisper)
 * - Photo messages (extract with Vision API)
 *
 * Adds contextual information:
 * - Current date/time
 * - Yesterday's date
 * - User metadata
 */

import type { Context } from 'grammy';
import { openai } from './openai';
import { downloadFile, getTempFilePath, deleteFile } from './file-utils';
import { getUserTimezone } from '../services/user.service';
import { format as formatDate } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import fs from 'fs';

/**
 * Normalized input structure
 */
export interface NormalizedInput {
  /** Normalized text (original, transcribed, or extracted) */
  text: string;

  /** Input metadata */
  metadata: {
    /** Input type */
    inputType: 'text' | 'voice' | 'photo';

    /** Current date (ISO format) in user's timezone */
    currentDate: string;

    /** Current time (ISO format) in user's timezone */
    currentTime: string;

    /** Yesterday's date (ISO format) in user's timezone */
    yesterday: string;

    /** User's timezone (IANA format) */
    timezone: string;

    /** Telegram user ID */
    userId: number;

    /** Telegram username (optional) */
    username?: string;

    /** User's first name (optional) */
    firstName?: string;

    /** User's last name (optional) */
    lastName?: string;

    /** Message ID */
    messageId: number;
  };
}

/**
 * Generate date context strings in user's timezone
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 */
function getDateContext(timezone: string) {
  const now = new Date();

  // Convert to user's timezone
  const zonedTime = toZonedTime(now, timezone);

  // Current date and time in user's timezone
  const currentDate = formatDate(zonedTime, 'yyyy-MM-dd'); // YYYY-MM-DD
  const currentTime = zonedTime.toISOString(); // Full ISO timestamp

  // Yesterday in user's timezone
  const yesterdayDate = new Date(zonedTime);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatDate(yesterdayDate, 'yyyy-MM-dd');

  return {
    currentDate,
    currentTime,
    yesterday,
  };
}

/**
 * Extract user metadata from context
 */
function getUserMetadata(ctx: Context) {
  return {
    userId: ctx.from!.id,
    username: ctx.from?.username,
    firstName: ctx.from?.first_name,
    lastName: ctx.from?.last_name,
    messageId: ctx.message!.message_id,
  };
}

/**
 * Transcribe voice message using Whisper API
 */
async function transcribeVoice(audioFilePath: string): Promise<string> {
  try {
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    const audioStream = fs.createReadStream(audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'text', // Simple text response
      temperature: 0.0, // Deterministic
    });

    return transcription;
  } catch (error) {
    console.error('[input-normalization] Transcription error:', error);
    throw new Error(
      `Failed to transcribe voice: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract text from photo using GPT-4o Vision
 */
async function extractFromPhoto(imageFilePath: string): Promise<string> {
  try {
    if (!fs.existsSync(imageFilePath)) {
      throw new Error(`Image file not found: ${imageFilePath}`);
    }

    // Read image as base64
    const imageBuffer = fs.readFileSync(imageFilePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imageFilePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // Call Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "Extract ALL text from this image. If it's a receipt, extract: merchant name, total amount, currency, date, and items. If it's a screenshot or other text, extract all visible text. Return the information clearly.",
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.0, // Deterministic
    });

    const extractedText = response.choices[0]?.message?.content || '';

    if (!extractedText) {
      throw new Error('No text extracted from image');
    }

    return extractedText;
  } catch (error) {
    console.error('[input-normalization] Photo extraction error:', error);
    throw new Error(
      `Failed to extract from photo: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Normalize input from Grammy context
 *
 * Handles all input types and adds contextual information
 *
 * @param ctx - Grammy context
 * @returns Normalized input with text and metadata
 */
export async function normalizeInput(ctx: Context): Promise<NormalizedInput> {
  const userId = ctx.from!.id;

  // Fetch user's timezone (defaults to UTC if not set)
  const timezone = await getUserTimezone(userId);

  // Generate date context in user's timezone
  const dateContext = getDateContext(timezone);
  const userMetadata = getUserMetadata(ctx);

  try {
    // Case 1: Text message
    if (ctx.message?.text) {
      console.log('[input-normalization] Processing text message');

      return {
        text: ctx.message.text,
        metadata: {
          inputType: 'text',
          ...dateContext,
          timezone,
          ...userMetadata,
        },
      };
    }

    // Case 2: Voice message
    if (ctx.message?.voice) {
      console.log('[input-normalization] Processing voice message');

      const fileId = ctx.message.voice.file_id;
      const file = await ctx.api.getFile(fileId);

      if (!file.file_path) {
        throw new Error('Failed to get voice file path');
      }

      // Download voice file
      const tempFilePath = getTempFilePath('voice', 'ogg');
      await downloadFile(file.file_path, tempFilePath);

      try {
        // Transcribe
        const transcribedText = await transcribeVoice(tempFilePath);
        console.log('[input-normalization] Transcribed:', transcribedText);

        return {
          text: transcribedText,
          metadata: {
            inputType: 'voice',
            ...dateContext,
            timezone,
            ...userMetadata,
          },
        };
      } finally {
        // Cleanup temp file
        await deleteFile(tempFilePath);
      }
    }

    // Case 3: Photo message
    if (ctx.message?.photo && ctx.message.photo.length > 0) {
      console.log('[input-normalization] Processing photo message');

      // Get highest resolution photo (last in array)
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      const file = await ctx.api.getFile(fileId);

      if (!file.file_path) {
        throw new Error('Failed to get photo file path');
      }

      // Download photo
      const tempFilePath = getTempFilePath('photo', 'jpg');
      await downloadFile(file.file_path, tempFilePath);

      try {
        // Extract text from photo
        const extractedText = await extractFromPhoto(tempFilePath);
        console.log('[input-normalization] Extracted:', extractedText);

        return {
          text: extractedText,
          metadata: {
            inputType: 'photo',
            ...dateContext,
            timezone,
            ...userMetadata,
          },
        };
      } finally {
        // Cleanup temp file
        await deleteFile(tempFilePath);
      }
    }

    // Unsupported message type
    throw new Error('Unsupported message type. Please send text, voice, or photo.');
  } catch (error) {
    console.error('[input-normalization] Error:', error);
    throw error;
  }
}

/**
 * Build context-enriched prompt from normalized input
 *
 * Adds date context and user information to help the agent
 *
 * @param input - Normalized input
 * @returns Prompt string with context
 */
export function buildContextPrompt(input: NormalizedInput): string {
  const { text, metadata } = input;

  // Build context header
  const contextLines = [
    `[Current Date: Today is ${metadata.currentDate}, Yesterday was ${metadata.yesterday}]`,
    `[User Timezone: ${metadata.timezone}]`,
    `[User: ${metadata.firstName || 'Unknown'} (@${metadata.username || 'unknown'})]`,
    `[Message Type: ${metadata.inputType}]`,
    '',
    text,
  ];

  return contextLines.join('\n');
}

/**
 * Image content for Vision API requests
 */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high';
  };
}

/**
 * Get image content with proper typing for Vision API
 *
 * Handles both local file paths and URLs (HTTP/HTTPS/data URIs)
 *
 * @param imageUrl - Image URL, file path, or data URI
 * @returns Strongly-typed ImageContent object for Vision API
 * @throws Error if file path doesn't exist or URL is invalid
 */
export function getImageContent(imageUrl: string): ImageContent {
  // Handle HTTPS URLs - use directly
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return {
      type: 'image_url',
      image_url: {
        url: imageUrl,
      },
    };
  }

  // Handle local file paths - convert to base64
  if (fs.existsSync(imageUrl)) {
    const imageBuffer = fs.readFileSync(imageUrl);
    const mimeType = imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
        detail: 'high',
      },
    };
  }

  // Handle data URIs and other formats - pass through
  if (imageUrl.startsWith('data:')) {
    return {
      type: 'image_url',
      image_url: {
        url: imageUrl,
        detail: 'high',
      },
    };
  }

  // Invalid input
  throw new Error(
    `Invalid image source: must be an HTTP(S) URL, file path, or data URI. Received: ${imageUrl.substring(0, 50)}`
  );
}

/**
 * Check if message should be cached
 *
 * Don't cache transaction logging (dynamic)
 * Do cache queries and help requests (reusable)
 *
 * @param text - Message text
 * @returns true if should be cached
 */
export function shouldCacheResponse(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Don't cache transaction-related keywords
  const transactionKeywords = [
    'spent',
    'bought',
    'paid',
    'purchased',
    'cost',
    'expense',
    'receipt',
    'transaction',
  ];

  for (const keyword of transactionKeywords) {
    if (lowerText.includes(keyword)) {
      return false; // Likely a transaction log
    }
  }

  // Cache queries and help
  return true;
}
