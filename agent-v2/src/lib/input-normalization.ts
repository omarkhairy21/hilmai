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

import type { Context } from "grammy";
import { openai } from "./openai";
import { downloadFile, getTempFilePath, deleteFile } from "./file-utils";
import fs from "fs";

/**
 * Normalized input structure
 */
export interface NormalizedInput {
  /** Normalized text (original, transcribed, or extracted) */
  text: string;

  /** Input metadata */
  metadata: {
    /** Input type */
    inputType: "text" | "voice" | "photo";

    /** Current date (ISO format) */
    currentDate: string;

    /** Current time (ISO format) */
    currentTime: string;

    /** Yesterday's date (ISO format) */
    yesterday: string;

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
 * Generate date context strings
 */
function getDateContext() {
  const now = new Date();

  // Current date and time
  const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentTime = now.toISOString(); // Full ISO timestamp

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  return {
    currentDate,
    currentTime,
    yesterday: yesterdayStr,
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
      model: "whisper-1",
      response_format: "text", // Simple text response
      temperature: 0.0, // Deterministic
    });

    return transcription;
  } catch (error) {
    console.error("[input-normalization] Transcription error:", error);
    throw new Error(
      `Failed to transcribe voice: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    const base64Image = imageBuffer.toString("base64");
    const mimeType = imageFilePath.endsWith(".png")
      ? "image/png"
      : "image/jpeg";

    // Call Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text from this image. If it's a receipt, extract: merchant name, total amount, currency, date, and items. If it's a screenshot or other text, extract all visible text. Return the information clearly.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.0, // Deterministic
    });

    const extractedText = response.choices[0]?.message?.content || "";

    if (!extractedText) {
      throw new Error("No text extracted from image");
    }

    return extractedText;
  } catch (error) {
    console.error("[input-normalization] Photo extraction error:", error);
    throw new Error(
      `Failed to extract from photo: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  const dateContext = getDateContext();
  const userMetadata = getUserMetadata(ctx);

  try {
    // Case 1: Text message
    if (ctx.message?.text) {
      console.log("[input-normalization] Processing text message");

      return {
        text: ctx.message.text,
        metadata: {
          inputType: "text",
          ...dateContext,
          ...userMetadata,
        },
      };
    }

    // Case 2: Voice message
    if (ctx.message?.voice) {
      console.log("[input-normalization] Processing voice message");

      const fileId = ctx.message.voice.file_id;
      const file = await ctx.api.getFile(fileId);

      if (!file.file_path) {
        throw new Error("Failed to get voice file path");
      }

      // Download voice file
      const tempFilePath = getTempFilePath("voice", "ogg");
      await downloadFile(file.file_path, tempFilePath);

      try {
        // Transcribe
        const transcribedText = await transcribeVoice(tempFilePath);
        console.log("[input-normalization] Transcribed:", transcribedText);

        return {
          text: transcribedText,
          metadata: {
            inputType: "voice",
            ...dateContext,
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
      console.log("[input-normalization] Processing photo message");

      // Get highest resolution photo (last in array)
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      const file = await ctx.api.getFile(fileId);

      if (!file.file_path) {
        throw new Error("Failed to get photo file path");
      }

      // Download photo
      const tempFilePath = getTempFilePath("photo", "jpg");
      await downloadFile(file.file_path, tempFilePath);

      try {
        // Extract text from photo
        const extractedText = await extractFromPhoto(tempFilePath);
        console.log("[input-normalization] Extracted:", extractedText);

        return {
          text: extractedText,
          metadata: {
            inputType: "photo",
            ...dateContext,
            ...userMetadata,
          },
        };
      } finally {
        // Cleanup temp file
        await deleteFile(tempFilePath);
      }
    }

    // Unsupported message type
    throw new Error(
      "Unsupported message type. Please send text, voice, or photo.",
    );
  } catch (error) {
    console.error("[input-normalization] Error:", error);
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
    `[User: ${metadata.firstName || "Unknown"} (@${metadata.username || "unknown"})]`,
    `[Message Type: ${metadata.inputType}]`,
    "",
    text,
  ];

  return contextLines.join("\n");
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
    "spent",
    "bought",
    "paid",
    "purchased",
    "cost",
    "expense",
    "receipt",
    "transaction",
  ];

  for (const keyword of transactionKeywords) {
    if (lowerText.includes(keyword)) {
      return false; // Likely a transaction log
    }
  }

  // Cache queries and help
  return true;
}
