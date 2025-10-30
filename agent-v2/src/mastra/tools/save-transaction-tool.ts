/**
 * Save Transaction Tool for HilmAI Agent V2
 *
 * Saves transaction to Supabase with merchant embedding generation
 * Uses embedding cache to reduce API calls
 */

import { createTool } from "@mastra/core";
import { z } from "zod";
import { supabase } from "../../lib/supabase";
import { getMerchantEmbedding } from "../../lib/embeddings";

export const saveTransactionTool = createTool({
  id: "save-transaction",
  description:
    "Save a transaction to the database with merchant embedding for fuzzy search",
  inputSchema: z.object({
    userId: z.number().describe("Telegram user ID"),
    amount: z.number().describe("Transaction amount"),
    currency: z
      .string()
      .default("AED")
      .describe("Currency code (e.g., AED, USD, SAR)"),
    merchant: z.string().describe("Merchant or vendor name"),
    category: z
      .string()
      .describe("Transaction category (e.g., Groceries, Dining, Transport)"),
    description: z
      .string()
      .optional()
      .describe("Optional transaction description or notes"),
    transactionDate: z
      .string()
      .describe("Transaction date in YYYY-MM-DD format"),
    telegramChatId: z.number().optional().describe("Telegram chat ID"),
    telegramUsername: z.string().optional().describe("Telegram username"),
    firstName: z.string().optional().describe("User first name"),
    lastName: z.string().optional().describe("User last name"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    transactionId: z.number().optional(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const {
      userId,
      amount,
      currency,
      merchant,
      category,
      description,
      transactionDate,
      telegramChatId,
      telegramUsername,
      firstName,
      lastName,
    } = context;

    try {
      console.log(
        `[save-transaction] Saving transaction for user ${userId}: ${amount} ${currency} at ${merchant}`,
      );

      // Step 1: Generate merchant embedding (with caching)
      const merchantEmbedding = await getMerchantEmbedding(merchant);
      console.log(
        `[save-transaction] Generated embedding (${merchantEmbedding.length} dimensions)`,
      );

      // Step 2: Insert transaction into Supabase
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          amount,
          currency,
          merchant,
          category,
          description: description || null,
          transaction_date: transactionDate,
          merchant_embedding: merchantEmbedding,
          telegram_chat_id: telegramChatId || userId,
          telegram_username: telegramUsername || null,
          first_name: firstName || null,
          last_name: lastName || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[save-transaction] Database error:", error);
        throw new Error(`Failed to save transaction: ${error.message}`);
      }

      const transactionId = data.id;
      console.log(
        `[save-transaction] ✅ Saved transaction ID: ${transactionId}`,
      );

      return {
        success: true,
        transactionId,
        message: `Transaction saved successfully (ID: ${transactionId})`,
      };
    } catch (error) {
      console.error("[save-transaction] Error:", error);

      return {
        success: false,
        message: `Failed to save transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
