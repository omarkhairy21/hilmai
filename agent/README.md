# Hilm.ai Telegram Bot

AI-powered financial management Telegram bot built with Mastra.ai.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit `.env` and add your tokens:

```bash
OPENAI_API_KEY=your_openai_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

**Get a Telegram Bot Token:**
1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the token and add it to `.env`

### 3. Run the Bot

```bash
# Development mode (with auto-reload)
npm run bot:dev

# Production mode
npm run bot
```

## Project Structure

```
agent/
├── src/
│   ├── bot.ts                           # Telegram bot entry point
│   └── mastra/
│       ├── index.ts                      # Mastra configuration
│       ├── agents/
│       │   ├── transaction-extractor-agent.ts   # Transaction NLU agent
│       │   └── weather-agent.ts          # Example weather agent
│       ├── tools/
│       │   ├── extract-transaction-tool.ts      # Transaction extraction tool
│       │   └── weather-tool.ts           # Example weather tool
│       └── workflows/
│           └── weather-workflow.ts       # Example workflow
├── .env                                  # Environment variables
├── package.json
└── tsconfig.json
```

## Features

### Current
- ✅ Transaction extraction from natural language
- ✅ Smart categorization
- ✅ OpenAI GPT-4o integration
- ✅ Telegram bot interface

### Coming Soon
- 📸 Receipt OCR scanning
- 🎤 Voice message transcription
- 💾 Database storage (Supabase)
- 📊 Spending insights
- 🔔 Budget alerts
- 🔍 Semantic search (RAG)

## Commands

Bot commands:
- `/start` - Start the bot
- `/help` - Show help message

## Example Usage

Send messages like:
- "Spent $50 on groceries at Walmart"
- "Bought coffee for $5"
- "Paid $120 for electricity bill"

The bot will extract and categorize your transactions automatically.

## Development

### Mastra Dev Server

Run the Mastra development server for testing agents and workflows:

```bash
npm run dev
```

This starts the Mastra playground at http://localhost:4111

### Available Scripts

```bash
npm run dev       # Start Mastra dev server
npm run bot:dev   # Start Telegram bot with hot reload
npm run bot       # Start Telegram bot
npm run build     # Build the project
npm run start     # Start built project
```

## Mastra.ai Architecture

This project uses Mastra.ai, a TypeScript-first agent framework:

- **Agents**: AI agents with specific roles (transaction extraction, insights)
- **Tools**: Functions agents can call (OCR, transcription, queries)
- **Workflows**: Multi-step automated processes (alerts, summaries)
- **Storage**: LibSQL for observability and logs
- **Logging**: Pino logger for structured logging

## Next Steps

1. **Add Database**: Integrate Supabase for persistent storage
2. **Add RAG**: Implement Pinecone for semantic search
3. **Receipt OCR**: Add GPT-4o Vision for receipt scanning
4. **Voice Input**: Integrate Whisper API for voice transcription
5. **Budget Tracking**: Create budget alerts and insights
6. **Analytics**: Build spending analysis tools

## Resources

- [Mastra.ai Docs](https://mastra.ai)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [OpenAI API](https://platform.openai.com/docs)

## License

ISC
