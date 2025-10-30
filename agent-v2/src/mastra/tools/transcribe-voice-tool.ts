import { createTool } from "@mastra/core";
import { z } from "zod";
import { openai } from "../../lib/openai";
import fs from "fs";

export const transcribeVoiceTool = createTool({
  id: "transcribe-voice",
  description: "Transcribe voice message using OpenAI Whisper API",
  inputSchema: z.object({
    audioFilePath: z.string().describe("Local file path to the audio file"),
    language: z
      .string()
      .optional()
      .describe(
        "Language code (e.g., en, ar, es) - auto-detect if not provided",
      ),
  }),
  outputSchema: z.object({
    text: z.string().describe("Transcribed text from the audio"),
    language: z.string().optional().describe("Detected language"),
    duration: z.number().optional().describe("Audio duration in seconds"),
  }),
  execute: async ({ context }) => {
    const { audioFilePath, language } = context;

    try {
      // Check if file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      // Create read stream for the audio file
      const audioStream = fs.createReadStream(audioFilePath);

      // Call Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: "whisper-1",
        language: language || undefined, // Auto-detect if not provided
        response_format: "verbose_json", // Get additional metadata
        temperature: 0.0, // Deterministic output
      });

      return {
        text: transcription.text,
        language: transcription.language || language || "unknown",
        duration: transcription.duration,
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      throw new Error(
        `Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },
});
