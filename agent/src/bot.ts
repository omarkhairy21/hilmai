import TelegramBot, { Update } from 'node-telegram-bot-api';
import { mastra } from './mastra/index.js';
import { downloadFile, deleteFile, getTempFilePath } from './lib/file-utils.js';
import { supabase } from './lib/supabase.js';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

// Toggle polling for DX: use polling in dev/local, webhooks in production
const usePolling = process.env.TELEGRAM_POLLING === 'true' || process.env.NODE_ENV !== 'production';

export const bot = new TelegramBot(token, { polling: usePolling });


export async function handleUpdate(update: Update) {
  await bot.processUpdate(update);
}


// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `Welcome to Hilm.ai! 🤖\n\nI'm your personal financial assistant. I can help you:\n\n` +
      `💰 Track expenses\n` +
      `📊 Analyze spending patterns\n` +
      `💡 Get financial insights\n\n` +
      `Try sending me a transaction like: "Spent $50 on groceries at Walmart"`
  );
});

// Handle /help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `📚 How to use Hilm.ai:\n\n` +
      `• Send transaction text: "Bought coffee for $5"\n` +
      `• Send a receipt photo 📷\n` +
      `• Send a voice message 🎤\n` +
      `• Ask questions about your spending\n\n` +
      `Commands:\n` +
      `/start - Start the bot\n` +
      `/help - Show this help message`
  );
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const fromUser = msg.from;
  console.log('fromUser', fromUser);

  // Ignore commands
  if (!text || text.startsWith('/')) {
    return;
  }

  try {
    // Send typing indicator
    await bot.sendChatAction(chatId, 'typing');

    // Classify the message using the classifier agent
    const classifierAgent = mastra.getAgent('messageClassifier');

    if (!classifierAgent) {
      console.error('Classifier agent not found');
      await bot.sendMessage(chatId, '❌ System error. Please try again.');
      return;
    }

    const classificationResult = await classifierAgent.generate(text, {
      onStepFinish: (step) => {
        console.log('Classification step:', step);
      },
    });

    // Extract classification from the agent's tool results
    let classification: { type: string; confidence: string; reason: string } = {
      type: 'other',
      confidence: 'low',
      reason: 'No classification performed',
    };

    // The tool result is in classificationResult.toolResults[0].payload.result
    if (classificationResult.toolResults && classificationResult.toolResults.length > 0) {
      const toolResult = classificationResult.toolResults[0];
      if (
        toolResult &&
        'payload' in toolResult &&
        toolResult.payload &&
        'result' in toolResult.payload
      ) {
        classification = toolResult.payload.result as typeof classification;
      }
    }

    console.log('Message classification:', classification);

    // Gather user information
    const userInfo = {
      chatId,
      username: msg.from?.username || '',
      firstName: msg.from?.first_name || '',
      lastName: msg.from?.last_name || '',
    };

    // Route to appropriate agent based on classification
    if (classification.type === 'query') {
      // Get user_id from database for query filtering
      const { data: userData } = await supabase
        .schema('public')
        .from('users')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .single();

      if (!userData?.id) {
        await bot.sendMessage(
          chatId,
          '💡 I can answer questions about your spending, but you need to log some transactions first!\n\n' +
            'Try: "Spent $50 on groceries at Walmart"'
        );
        return;
      }

      // Use finance insights agent for queries
      const agent = mastra.getAgent('financeInsights');

      if (!agent) {
        await bot.sendMessage(chatId, 'Query agent not found. Please check configuration.');
        return;
      }

      const result = await agent.generate(
        `User ID: ${userData.id}\n\nUser Question: ${text}\n\n[Context: User ${userInfo.firstName} (Chat ID: ${userInfo.chatId}) is asking about their spending history]`,
        {
          onStepFinish: (step) => {
            console.log('Query step finished:', step);
          },
          resourceId: chatId.toString(),
        }
      );

      // Send response
      await bot.sendMessage(chatId, result.text, { parse_mode: 'Markdown' });
    } else if (classification.type === 'transaction') {
      // Use transaction extractor agent for transactions
      const agent = mastra.getAgent('transactionExtractor');

      if (!agent) {
        await bot.sendMessage(chatId, 'Transaction agent not found. Please check configuration.');
        return;
      }

      const result = await agent.generate(
        `${text}\n\n[User Info: Chat ID: ${userInfo.chatId}, Username: @${userInfo.username || 'unknown'}, Name: ${userInfo.firstName} ${userInfo.lastName}]`,
        {
          onStepFinish: (step) => {
            console.log('Transaction step finished:', step);
          },
          resourceId: chatId.toString(),
        }
      );

      // Send response
      await bot.sendMessage(chatId, `✅ Transaction recorded!\n\n${result.text}`, {
        parse_mode: 'Markdown',
      });
    } else {
      // Handle other message types
      await bot.sendMessage(
        chatId,
        `I can help you with:\n\n` +
          `💰 Logging transactions: "Spent $50 at Target"\n` +
          `📊 Answering questions: "How much did I spend on groceries?"\n` +
          `📷 Scanning receipts (send a photo)\n` +
          `🎤 Voice notes (send a voice message)\n\n` +
          `What would you like to do?`
      );
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await bot.sendMessage(
      chatId,
      `❌ Sorry, I encountered an error processing your message. Please try again.`
    );
  }
});

// Handle photo messages (receipts)
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Send processing message
    await bot.sendMessage(chatId, '📷 Scanning receipt...');
    await bot.sendChatAction(chatId, 'typing');

    // Get highest quality photo
    const photos = msg.photo;
    if (!photos || photos.length === 0) {
      await bot.sendMessage(chatId, '❌ No photo found. Please try again.');
      return;
    }

    // Get the largest photo (highest resolution)
    const photo = photos[photos.length - 1];
    const fileId = photo.file_id;

    // Get file info and construct URL
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Gather user information
    const userInfo = {
      chatId,
      username: msg.from?.username || '',
      firstName: msg.from?.first_name || '',
      lastName: msg.from?.last_name || '',
    };

    // Use the transaction extractor agent with receipt extraction
    const agent = mastra.getAgent('transactionExtractor');

    if (!agent) {
      await bot.sendMessage(chatId, 'Agent not found. Please check configuration.');
      return;
    }

    // Create a prompt for the agent to extract and save the receipt
    const prompt = `Extract transaction details from this receipt image and save it to the database.

Image URL: ${fileUrl}

[User Info: Chat ID: ${userInfo.chatId}, Username: @${userInfo.username || 'unknown'}, Name: ${userInfo.firstName} ${userInfo.lastName}]

Use the extract-receipt tool to analyze this receipt image, then save the transaction using the save-transaction tool.`;

    const result = await agent.generate(prompt, {
      onStepFinish: (step) => {
        console.log('Step finished:', step);
      },
      resourceId: chatId.toString(),
    });

    // Send response
    await bot.sendMessage(chatId, `✅ Receipt processed!\n\n${result.text}`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Error processing photo:', error);
    await bot.sendMessage(
      chatId,
      `❌ Sorry, I couldn't process that receipt. Try:\n` +
        `• Better lighting\n` +
        `• Clearer photo\n` +
        `• Or just type the amount!`
    );
  }
});

// Handle voice messages
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  let tempFilePath: string | null = null;

  try {
    // Send processing message
    await bot.sendMessage(chatId, '🎤 Transcribing voice note...');
    await bot.sendChatAction(chatId, 'typing');

    // Get voice file info
    const voice = msg.voice;
    if (!voice) {
      await bot.sendMessage(chatId, '❌ No voice message found. Please try again.');
      return;
    }

    const fileId = voice.file_id;
    const duration = voice.duration;

    // Check duration (limit to 2 minutes to avoid high costs)
    if (duration > 120) {
      await bot.sendMessage(
        chatId,
        '⚠️ Voice message is too long (max 2 minutes). Please send a shorter message or type it out!'
      );
      return;
    }

    // Get file info and download
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    // Download to temp file
    tempFilePath = getTempFilePath('voice', 'ogg');
    await downloadFile(fileUrl, tempFilePath);

    // Gather user information
    const userInfo = {
      chatId,
      username: msg.from?.username || '',
      firstName: msg.from?.first_name || '',
      lastName: msg.from?.last_name || '',
    };

    // Step 1: Transcribe the voice message to text
    const transactionAgent = mastra.getAgent('transactionExtractor');

    if (!transactionAgent) {
      await bot.sendMessage(chatId, 'Agent not found. Please check configuration.');
      await deleteFile(tempFilePath);
      return;
    }

    // Transcribe using the transcribe-voice tool
    const transcribePrompt = `Transcribe this voice message to text.

Voice file path: ${tempFilePath}

Use the transcribe-voice tool to convert the audio to text. Only return the transcription, don't process it further.`;

    const transcriptionResult = await transactionAgent.generate(transcribePrompt, {
      onStepFinish: (step) => {
        console.log('Transcription step:', step);
      },
      resourceId: chatId.toString(),
    });

    // Extract transcribed text from tool results
    let transcribedText = '';
    if (transcriptionResult.toolResults && transcriptionResult.toolResults.length > 0) {
      const toolResult = transcriptionResult.toolResults[0];
      if (toolResult && 'payload' in toolResult && toolResult.payload && 'result' in toolResult.payload) {
        transcribedText = (toolResult.payload.result as { text: string }).text;
      }
    }

    // Fallback to text response if no tool result
    if (!transcribedText) {
      transcribedText = transcriptionResult.text;
    }

    console.log('Transcribed text:', transcribedText);

    // Clean up temp file (no longer needed)
    await deleteFile(tempFilePath);
    tempFilePath = null;

    if (!transcribedText || transcribedText.trim().length === 0) {
      await bot.sendMessage(
        chatId,
        '❌ Could not transcribe the voice note. Please try again or type your message.'
      );
      return;
    }

    // Step 2: Classify the transcribed text (same as text message handler)
    await bot.sendChatAction(chatId, 'typing');

    const classifierAgent = mastra.getAgent('messageClassifier');

    if (!classifierAgent) {
      console.error('Classifier agent not found');
      await bot.sendMessage(chatId, '❌ System error. Please try again.');
      return;
    }

    const classificationResult = await classifierAgent.generate(transcribedText, {
      onStepFinish: (step) => {
        console.log('Classification step:', step);
      },
    });

    // Extract classification from the agent's tool results
    let classification: { type: string; confidence: string; reason: string } = {
      type: 'other',
      confidence: 'low',
      reason: 'No classification performed',
    };

    if (classificationResult.toolResults && classificationResult.toolResults.length > 0) {
      const toolResult = classificationResult.toolResults[0];
      if (
        toolResult &&
        'payload' in toolResult &&
        toolResult.payload &&
        'result' in toolResult.payload
      ) {
        classification = toolResult.payload.result as typeof classification;
      }
    }

    console.log('Voice message classification:', classification);

    // Step 3: Route to appropriate agent based on classification
    if (classification.type === 'query') {
      // Get user_id from database for query filtering
      const { data: userData } = await supabase
        .schema('public')
        .from('users')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .single();

      if (!userData?.id) {
        await bot.sendMessage(
          chatId,
          '💡 I can answer questions about your spending, but you need to log some transactions first!\n\n' +
            'Try: "Spent $50 on groceries at Walmart"'
        );
        return;
      }

      // Use finance insights agent for queries
      const agent = mastra.getAgent('financeInsights');

      if (!agent) {
        await bot.sendMessage(chatId, 'Query agent not found. Please check configuration.');
        return;
      }

      const result = await agent.generate(
        `User ID: ${userData.id}\n\nUser Question: ${transcribedText}\n\n[Context: User ${userInfo.firstName} (Chat ID: ${userInfo.chatId}) asked via voice message]`,
        {
          onStepFinish: (step) => {
            console.log('Query step finished:', step);
          },
          resourceId: chatId.toString(),
        }
      );

      // Send response
      await bot.sendMessage(chatId, result.text, { parse_mode: 'Markdown' });
    } else if (classification.type === 'transaction') {
      // Use transaction extractor agent
      const agent = mastra.getAgent('transactionExtractor');

      if (!agent) {
        await bot.sendMessage(chatId, 'Transaction agent not found. Please check configuration.');
        return;
      }

      const result = await agent.generate(
        `${transcribedText}\n\n[User Info: Chat ID: ${userInfo.chatId}, Username: @${userInfo.username || 'unknown'}, Name: ${userInfo.firstName} ${userInfo.lastName}]`,
        {
          onStepFinish: (step) => {
            console.log('Transaction step finished:', step);
          },
          resourceId: chatId.toString(),
        }
      );

      // Send response
      await bot.sendMessage(chatId, `✅ Transaction recorded!\n\n${result.text}`, {
        parse_mode: 'Markdown',
      });
    } else {
      // Handle other message types
      await bot.sendMessage(
        chatId,
        `I can help you with:\n\n` +
          `💰 Logging transactions: "Spent $50 at Target"\n` +
          `📊 Answering questions: "How much did I spend on groceries?"\n` +
          `📷 Scanning receipts (send a photo)\n` +
          `🎤 Voice notes (send a voice message)\n\n` +
          `What would you like to do?`
      );
    }
  } catch (error) {
    console.error('Error processing voice:', error);

    // Clean up temp file if it exists
    if (tempFilePath) {
      await deleteFile(tempFilePath).catch(() => {});
    }

    await bot.sendMessage(
      chatId,
      `❌ Sorry, I couldn't process that voice note. Try:\n` +
        `• Recording again in a quiet place\n` +
        `• Speaking more clearly\n` +
        `• Or just type it out!`
    );
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Hilm.ai Telegram bot is running...');
