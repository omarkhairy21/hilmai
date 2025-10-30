import { Bot } from "grammy";
import type { Mastra } from "@mastra/core/mastra";
import { supervisor } from "./mastra";
import {
  normalizeInput,
  buildContextPrompt,
  shouldCacheResponse,
} from "./lib/input-normalization";
import { AgentResponseCache } from "./lib/prompt-cache";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required in .env");
}

export function createBot(mastra: Mastra): Bot {
  const bot = new Bot(token!);
  const logger = mastra.getLogger();

  // Handle /start command
  bot.command("start", async (ctx) => {
    logger.info("command:start", { userId: ctx.from?.id });

    await ctx.reply(
      `Welcome to HilmAI! 🤖\n\n` +
        `I'm your personal financial assistant. I can help you:\n\n` +
        `💰 Track expenses (text, voice, or photo)\n` +
        `📊 Answer questions about your spending\n` +
        `📈 Analyze patterns and trends\n\n` +
        `Try saying:\n` +
        `• "I spent 50 AED at Carrefour"\n` +
        `• "How much on groceries this week?"\n` +
        `• Or just send a receipt photo!`,
      { parse_mode: "Markdown" },
    );
  });

  // Handle /help command
  bot.command("help", async (ctx) => {
    logger.info("command:help", { userId: ctx.from?.id });

    await ctx.reply(
      `*HilmAI Commands & Features*\n\n` +
        `*Track Expenses:*\n` +
        `• Type: "I spent 50 AED at Starbucks"\n` +
        `• Voice: Send a voice message\n` +
        `• Photo: Send a receipt photo\n\n` +
        `*Ask Questions:*\n` +
        `• "How much did I spend on groceries?"\n` +
        `• "Show my Starbucks spending"\n` +
        `• "Total expenses this month"\n\n` +
        `*Features:*\n` +
        `✅ Fuzzy search (handles typos)\n` +
        `✅ Conversation memory\n` +
        `✅ Multiple languages (English & Arabic)\n\n` +
        `Just start chatting naturally!`,
      { parse_mode: "Markdown" },
    );
  });

  // Handle /clear command (clear cache for user)
  bot.command("clear", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      const deleted = await AgentResponseCache.clearUser(userId);
      logger.info("command:clear", { userId, deleted });
      await ctx.reply(`✅ Cleared ${deleted} cached responses.`);
    }
  });

  // Main message handler - handles ALL message types
  bot.on("message", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      logger.warn("message:no_user_id");
      await ctx.reply("❌ Unable to identify user.");
      return;
    }

    logger.info("message:received", {
      userId,
      hasText: Boolean(ctx.message?.text),
      hasVoice: Boolean(ctx.message?.voice),
      hasPhoto: Boolean(ctx.message?.photo),
    });

    try {
      // Step 1: Normalize input
      const input = await normalizeInput(ctx);
      logger.debug("message:normalized", {
        userId,
        inputType: input.metadata.inputType,
        textPreview: input.text.substring(0, 100),
      });

      // Step 2: Check cache
      const cached = await AgentResponseCache.get(userId, input.text);
      if (cached) {
        logger.info("message:cache_hit", { userId });
        await ctx.reply(cached.response, { parse_mode: "Markdown" });
        return;
      }

      logger.info("message:cache_miss", { userId });

      // Step 3: Build context prompt
      const prompt = buildContextPrompt(input);

      // Step 4: Call supervisor agent with conversation memory
      logger.info("message:calling_supervisor", { userId });

      const result = await supervisor.generate(prompt, {
        resourceId: userId.toString(),
      });

      const responseText =
        result.text || "Sorry, I encountered an issue processing your request.";

      logger.info("message:supervisor_responded", {
        userId,
        responseLength: responseText.length,
      });

      // Step 5: Cache response if appropriate
      if (shouldCacheResponse(input.text)) {
        await AgentResponseCache.set(userId, input.text, {
          response: responseText,
          metadata: {
            inputType: input.metadata.inputType,
            timestamp: new Date().toISOString(),
          },
        });
        logger.debug("message:cached", { userId });
      } else {
        logger.debug("message:not_cached", {
          userId,
          reason: "transaction-related",
        });
      }

      // Step 6: Send response
      await ctx.reply(responseText, { parse_mode: "Markdown" });
      logger.info("message:sent", { userId });
    } catch (error) {
      logger.error("message:error", {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // User-friendly error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage.includes("Unsupported message type")) {
        await ctx.reply(
          "❌ Sorry, I can only process text messages, voice messages, and photos.",
        );
      } else if (errorMessage.includes("transcribe")) {
        await ctx.reply(
          "❌ Sorry, I had trouble transcribing your voice message. Please try again.",
        );
      } else if (errorMessage.includes("extract")) {
        await ctx.reply(
          "❌ Sorry, I couldn't read that image clearly. Please try a clearer photo.",
        );
      } else {
        await ctx.reply(
          "❌ Sorry, something went wrong. Please try again in a moment.",
        );
      }
    }
  });

  // Error handler for bot-level errors
  bot.catch((err) => {
    logger.error("bot:error", {
      error: err.error instanceof Error ? err.error.message : String(err.error),
      ctx: err.ctx,
    });
  });

  return bot;
}
