import { createTool } from "@mastra/core";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const extractTransactionTool = createTool({
  id: "extract-transaction",
  description:
    "Extract transaction details from natural language text using LLM",
  inputSchema: z.object({
    text: z.string().describe("Natural language text describing a transaction"),
    referenceDate: z
      .string()
      .optional()
      .describe("ISO datetime for resolving relative dates"),
  }),
  outputSchema: z.object({
    amount: z.number().describe("Transaction amount"),
    currency: z.string().describe("Currency code (e.g., USD, AED, EUR)"),
    merchant: z.string().describe("Merchant or vendor name"),
    category: z
      .string()
      .describe("Spending category (e.g., groceries, dining, transport)"),
    date: z.string().optional().describe("Transaction date if mentioned"),
    description: z
      .string()
      .optional()
      .describe("Additional transaction details"),
  }),
  execute: async (input: any) => {
    const { text, referenceDate } = input;

    // Use provided reference date or current date
    const refDate = referenceDate ? new Date(referenceDate) : new Date();
    const today = refDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const yesterday = new Date(refDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const prompt = `You are a financial transaction extraction expert. Extract the following details from this text:

REFERENCE DATE (TODAY): ${today}
YESTERDAY DATE: ${yesterdayStr}

Text: "${text}"

Extract:
1. amount (numeric value only, no symbols)
2. currency (USD, AED, EUR, GBP, etc. - if $ is used, assume USD. If no currency, assume USD)
3. merchant (the store/vendor name)
4. category (one of: groceries, dining, transport, shopping, bills, entertainment, healthcare, education, other)
5. description (brief summary of what was purchased)
6. date (format as YYYY-MM-DD):
   - If "today" → use ${today}
   - If "yesterday" → use ${yesterdayStr}
   - If specific date mentioned → parse it
   - If NOT mentioned → use ${today}

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{
  "amount": 50.00,
  "currency": "USD",
  "merchant": "Store Name",
  "category": "dining",
  "description": "brief description",
  "date": "${today}"
}`;

    try {
      const { text: response } = await generateText({
        model: openai("gpt-4o-mini"),
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0,
      });

      // Parse JSON response
      const cleanResponse = response
        .trim()
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");
      const extracted = JSON.parse(cleanResponse);

      return {
        amount: extracted.amount || 0,
        currency: extracted.currency || "USD",
        merchant: extracted.merchant || "Unknown",
        category: extracted.category || "other",
        description: extracted.description || text,
        date: extracted.date,
      };
    } catch (error) {
      console.error("Error extracting transaction:", error);
      // Return defaults if extraction fails
      return {
        amount: 0,
        currency: "USD",
        merchant: "Unknown",
        category: "other",
        description: text,
      };
    }
  },
});
