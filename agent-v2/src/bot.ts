import { Bot } from "grammy";
import type { Mastra } from "@mastra/core/mastra";
import { downloadFile, getTempFilePath } from "./lib/file-utils";
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

  // Main message handler - ultra-simple using message-processing workflow
  bot.on("message", async (ctx) => {
    const userId = ctx.from?.id;
    ctx.message.chat.id
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
      // Step 1: Prepare workflow input from Grammy context
      logger.info("message:preparing_workflow_input", { userId });

      const workflowInput: any = {
        userId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        messageId: ctx.message!.message_id,
      };

      // Handle text
      if (ctx.message?.text) {
        workflowInput.messageText = ctx.message.text;
      }

      // Handle voice
      if (ctx.message?.voice) {
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.api.getFile(fileId);

        if (!file.file_path) {
          throw new Error("Failed to get voice file path");
        }

        const tempFilePath = getTempFilePath("voice", "ogg");
        await downloadFile(file.file_path, tempFilePath);
        workflowInput.voiceFilePath = tempFilePath;
      }

      // Handle photo
      if (ctx.message?.photo && ctx.message.photo.length > 0) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileId = photo.file_id;
        const file = await ctx.api.getFile(fileId);

        if (!file.file_path) {
          throw new Error("Failed to get photo file path");
        }

        const tempFilePath = getTempFilePath("photo", "jpg");
        await downloadFile(file.file_path, tempFilePath);
        workflowInput.photoFilePath = tempFilePath;
      }

      logger.debug("message:workflow_input_prepared", { userId });

      // Step 2: Run message-processing workflow (handles ALL processing)
      logger.info("message:running_workflow", { userId });

      const workflow = mastra.getWorkflow("message-processing");
      const run = await workflow.createRunAsync();
      const workflowResult = await run.start({ inputData: workflowInput });

      if (workflowResult.status === "failed") {
        throw workflowResult.error;
      }

      if (workflowResult.status !== "success") {
        throw new Error(`Workflow did not complete successfully: ${workflowResult.status}`);
      }

      const { response, metadata } = workflowResult.result;

      logger.info("message:workflow_completed", {
        userId,
        inputType: metadata.inputType,
        cached: metadata.cached,
      });

      // Step 3: Send response
      await ctx.reply(response, { parse_mode: "Markdown" });
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
