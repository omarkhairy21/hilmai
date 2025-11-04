import { createTool } from "@mastra/core";
import { z } from "zod";
import { openai } from "../../lib/openai";

export const extractReceiptTool = createTool({
  id: "extract-receipt",
  description:
    "Extract transaction details from receipt image using GPT-4o Vision OCR",
  inputSchema: z.object({
    imageUrl: z.string().url().describe("URL of the receipt image"),
    telegramChatId: z
      .number()
      .optional()
      .describe("Telegram chat ID of the user"),
    telegramUsername: z.string().optional().describe("Telegram username"),
    firstName: z.string().optional().describe("User first name"),
    lastName: z.string().optional().describe("User last name"),
  }),
  outputSchema: z.object({
    amount: z.number().describe("Total transaction amount"),
    currency: z
      .string()
      .describe("Currency code (USD, EUR, GBP, AED, SAR, etc.)"),
    merchant: z.string().describe("Merchant or store name"),
    category: z.string().describe("Spending category"),
    date: z.string().describe("Transaction date in ISO format"),
    items: z
      .array(
        z.object({
          name: z.string(),
          price: z.number(),
        }),
      )
      .optional()
      .describe("Individual items from receipt"),
    confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  }),
  execute: async (input: any) => {
    const { imageUrl, telegramChatId, telegramUsername, firstName, lastName } =
      input;

    console.log("🔍 extract-receipt-tool called:", {
      imageUrlLength: imageUrl?.length || 0,
      imageUrlPrefix: imageUrl?.substring(0, 50) || "none",
      hasTelegramChatId: !!telegramChatId,
      telegramUsername,
    });

    try {
      console.log("📡 Calling GPT-4o Vision API...");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a receipt OCR system. Extract transaction details from receipt images.

Extract the following information:
- **Total amount** (REQUIRED - look for "Total", "Amount Due", "Grand Total", "Balance Due")
- **Currency** (detect from symbols: $=USD, €=EUR, £=GBP, AED, SAR, etc. If unclear, assume USD)
- **Merchant/store name** (usually at the top of the receipt)
- **Date of purchase** (convert to ISO format YYYY-MM-DD)
- **Individual items and prices** (if clearly visible and readable)
- **Category** (infer from merchant or items):
  * Groceries (supermarkets, grocery stores)
  * Dining (restaurants, cafes, fast food, coffee shops)
  * Transportation (gas stations, parking, tolls, uber, taxi)
  * Shopping (retail stores, clothing, electronics, amazon)
  * Healthcare (pharmacies, clinics, hospitals, CVS, Walgreens)
  * Entertainment (movies, events, games, streaming)
  * Bills (utilities, services, subscriptions)
  * Education (books, courses, tuition)
  * Other (if unclear)

**Confidence scoring:**
- 1.0: All text is crystal clear, no ambiguity
- 0.8-0.9: Minor blur but all key info readable
- 0.6-0.7: Some difficulty reading, missing some details
- < 0.6: Very unclear, missing critical data

**IMPORTANT:**
- DO NOT convert currencies - keep the original currency from the receipt
- If date is unclear, use today's date
- If merchant is unclear, use "Unknown Store"
- Be conservative with confidence scores

Return ONLY valid JSON matching this schema:
{
  "amount": number,
  "currency": string,
  "merchant": string,
  "category": string,
  "date": "YYYY-MM-DD",
  "items": [{"name": string, "price": number}] (optional),
  "confidence": number
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all transaction details from this receipt image.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");

      console.log("✅ Vision API response received:", {
        amount: result.amount,
        merchant: result.merchant,
        category: result.category,
        confidence: result.confidence,
        hasItems: !!result.items,
      });

      // Validate required fields
      if (!result.amount || !result.merchant || !result.category) {
        console.error("❌ Missing required fields in vision response:", {
          hasAmount: !!result.amount,
          hasMerchant: !!result.merchant,
          hasCategory: !!result.category,
          fullResponse: result,
        });

        throw new Error(
          `Vision API returned incomplete data. Missing: ${!result.amount ? "amount " : ""}${!result.merchant ? "merchant " : ""}${!result.category ? "category" : ""}`,
        );
      }

      // Check confidence threshold
      const finalConfidence = Math.max(
        0,
        Math.min(1, result.confidence || 0.5),
      );
      if (finalConfidence < 0.6) {
        console.warn("⚠️ Low confidence score:", {
          confidence: finalConfidence,
          amount: result.amount,
          merchant: result.merchant,
        });

        throw new Error(
          `Receipt image quality is too low (confidence: ${(finalConfidence * 100).toFixed(0)}%). Please provide a clearer image with better lighting.`,
        );
      }

      // Ensure confidence is between 0 and 1
      result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));

      console.log("✅ Receipt extraction successful:", {
        amount: result.amount,
        currency: result.currency,
        merchant: result.merchant,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      console.error("❌ Error extracting receipt:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        imageUrlPrefix: imageUrl?.substring(0, 50),
      });

      throw new Error(
        `Failed to extract receipt: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },
});
