# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

hilm.ai is an AI-powered financial management platform, currently consisting of:

- **Astro waitlist landing page** (production)
- **Telegram bot** (in development) using Mastra.ai framework

## Project Structure

```
hilm.ai/
├── .claude/          # Claude Code configuration
├── .vscode/          # VS Code settings
├── web/              # Astro website (waitlist landing page)
│   ├── src/
│   │   ├── components/    # Astro components (.astro)
│   │   ├── layouts/       # Base layouts
│   │   ├── pages/         # File-based routing
│   │   ├── content/       # Content collections (blog, pages)
│   │   └── styles/        # Global styles + Tailwind
│   ├── public/            # Static assets
│   ├── astro.config.mjs   # Astro configuration
│   └── package.json
├── CLAUDE.md              # This file
├── product-roadmap.md     # Telegram bot roadmap
└── README.md
```

---

## Astro Website Development

### Development Commands

Run all commands from the `web/` directory:

```bash
cd web

# Development
npm install           # Install dependencies
npm run dev          # Start dev server (localhost:4321)
npm run build        # Build for production
npm run preview      # Preview production build

# Astro CLI
npm run astro        # Run Astro CLI commands
```

### Project Architecture

This is an **Astro v5** static site with:

- **Cloudflare Pages** deployment target
- **Tailwind CSS v4** via Vite plugin
- **Content Collections** for blog and pages
- **TypeScript** for type safety

### File-Based Routing

Astro uses file-based routing in `src/pages/`:

```
src/pages/
├── index.astro           → /
├── blog/
│   ├── index.astro       → /blog
│   └── [slug].astro      → /blog/post-slug
└── 404.astro             → 404 page
```

### Component Patterns

**Page Component:**

```astro
---
// Frontmatter (JavaScript/TypeScript)
import Layout from '../layouts/Layout.astro';

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<Layout title={title}>
  <h1>{title}</h1>
  <!-- HTML template -->
</Layout>
```

**Reusable Component:**

```astro
---
// src/components/Hero.astro
interface Props {
  heading: string;
  description?: string;
}

const { heading, description } = Astro.props;
---

<section class="hero">
  <h1>{heading}</h1>
  {description && <p>{description}</p>}
</section>

<style>
  .hero {
    padding: 2rem;
  }
</style>
```

### Content Collections

Located in `src/content/`:

```typescript
// src/content/blog/my-post.md
---
title: "My Blog Post"
description: "Post description"
pubDate: 2025-01-15
author: "Author Name"
tags: ["tag1", "tag2"]
---

Post content here...
```

Query collections:

```astro
---
import { getCollection } from 'astro:content';

const posts = await getCollection('blog');
---
```

### Layouts

Base layout pattern:

```astro
---
// src/layouts/Layout.astro
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

---

## Tailwind CSS v4

This project uses **Tailwind CSS v4** with the new Vite plugin:

### Configuration

**astro.config.mjs:**

```javascript
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
```

**src/styles/global.css:**

```css
@import "tailwindcss";

@theme {
  --color-lime: #d4ff2a;
  --font-sans: system-ui, -apple-system, sans-serif;
}

@layer base {
  /* Base styles */
}
```

### Usage

Use Tailwind utility classes directly in templates:

```astro
<div class="bg-black text-white p-8 rounded-lg">
  <h1 class="text-4xl font-bold">Hello</h1>
</div>
```

---

## Deployment

### Cloudflare Pages

**Build settings:**

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `web`

**Deploy via Wrangler:**

```bash
cd web
npm run build
npx wrangler pages deploy dist
```

**Deploy via Cloudflare Dashboard:**

1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set build output: `dist`
4. Set root directory: `web`

---

## Mastra.ai Integration (Telegram Bot)

The Telegram bot (in development) uses **Mastra.ai** - a TypeScript-first agent framework.

### Technology Stack

- **Framework:** Mastra.ai
- **Bot API:** node-telegram-bot-api
- **LLM:** OpenAI GPT-4o
- **Database:** Supabase (PostgreSQL + pgvector)
- **Vector DB:** Pinecone
- **Language:** TypeScript

### Mastra.ai Architecture

**Core Concepts:**

- **Agents**: AI agents with specific roles (transaction extraction, insights, etc.)
- **Tools**: Functions agents can call (OCR, voice transcription, database queries)
- **Workflows**: Multi-step automated processes (budget alerts, summaries)
- **RAG**: Retrieval-Augmented Generation for semantic search
- **Memory**: Conversation context and history

### Project Structure (Current Implementation)

```
src/
├── bot.ts                            # Bot initialization (89 lines, minimal)
├── handlers/
│   ├── index.ts                      # Central handler registration
│   ├── commands/                     # Command handlers (/start, /help, etc.)
│   │   ├── start.handler.ts
│   │   ├── help.handler.ts
│   │   ├── menu.handler.ts
│   │   ├── mode.handler.ts           # All mode commands
│   │   ├── currency.handler.ts
│   │   ├── timezone.handler.ts
│   │   ├── recent.handler.ts
│   │   ├── subscribe.handler.ts
│   │   ├── billing.handler.ts
│   │   ├── setemail.handler.ts
│   │   └── clear.handler.ts
│   ├── callbacks/                    # Callback query handlers
│   │   ├── mode.callback.ts          # Mode switching callbacks
│   │   ├── menu.callback.ts          # Menu button callbacks
│   │   ├── transaction.callback.ts   # Edit/delete callbacks
│   │   └── subscription.callback.ts  # Subscription/billing callbacks
│   └── messages/
│       └── message.handler.ts        # Main message handler (text/voice/photo)
├── mastra/
│   ├── index.ts                      # Mastra instance
│   ├── agents/
│   │   ├── transaction-logger-agent.ts
│   │   ├── query-executor-agent.ts
│   │   ├── conversation-agent.ts
│   │   ├── supervisor-agent.ts
│   │   └── transaction-manager-agent.ts
│   ├── tools/
│   │   ├── extract-transaction-tool.ts
│   │   ├── extract-receipt-tool.ts
│   │   ├── transcribe-voice-tool.ts
│   │   ├── hybrid-query-tool.ts
│   │   ├── save-transaction-tool.ts
│   │   ├── edit-transaction-tool.ts
│   │   └── delete-transaction-tool.ts
│   └── workflows/
│       └── message-processing-workflow.ts
├── services/
│   ├── user.service.ts               # User management
│   ├── subscription.service.ts       # Stripe integration
│   └── progress.service.ts           # Progress messages
└── lib/
    ├── messages.ts                   # Centralized message templates
    ├── user-mode.ts                  # Mode management
    ├── currency.ts                   # Currency utilities
    ├── timezone-parser.ts            # Timezone parsing
    ├── embeddings.ts                 # Vector search
    ├── supabase.ts                   # Supabase client
    └── file-utils.ts                 # File operations
```

---

## Telegram Bot Handler Architecture

### Overview

The bot uses a **modular handler system** to keep code organized and maintainable. All handlers are separated into individual files by type (commands, callbacks, messages).

### Handler Directory Structure

```
src/handlers/
├── index.ts                      # Central registration point
├── commands/                     # Command handlers (/command)
│   ├── start.handler.ts
│   ├── help.handler.ts
│   └── ...
├── callbacks/                    # Callback query handlers (button clicks)
│   ├── mode.callback.ts
│   ├── menu.callback.ts
│   └── ...
└── messages/                     # Message handlers (text, voice, photo)
    └── message.handler.ts
```

### Handler Pattern

Each handler file exports a registration function that takes `bot` and `mastra` as parameters:

```typescript
// handlers/commands/example.handler.ts
import type { Bot } from "grammy";
import type { Mastra } from "@mastra/core/mastra";
import { messages } from "../../lib/messages";

export function registerExampleCommand(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();

  bot.command("example", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply(messages.errors.noUser());
      return;
    }

    logger.info("command:example", { userId });

    try {
      // Handler logic here
      await ctx.reply("Example response");
    } catch (error) {
      logger.error("command:example:error", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply(messages.errors.generic());
    }
  });
}
```

### Central Registration

The `handlers/index.ts` file imports and registers all handlers:

```typescript
// handlers/index.ts
import type { Bot } from "grammy";
import type { Mastra } from "@mastra/core/mastra";
import { registerStartCommand } from "./commands/start.handler";
import { registerHelpCommand } from "./commands/help.handler";
// ... other imports

export function registerAllHandlers(bot: Bot, mastra: Mastra): void {
  const logger = mastra.getLogger();
  logger.info("handlers:registration_started");

  // Register command handlers
  registerStartCommand(bot, mastra);
  registerHelpCommand(bot, mastra);
  // ... other command handlers

  // Register callback handlers
  registerModeCallbacks(bot, mastra);
  registerMenuCallbacks(bot, mastra);
  // ... other callback handlers

  // Register message handler (must be last)
  registerMessageHandler(bot, mastra);

  logger.info("handlers:registration_completed");
}
```

### Bot Initialization

The `bot.ts` file is kept minimal (89 lines) and only handles initialization:

```typescript
// bot.ts
import { Bot } from 'grammy';
import type { Mastra } from '@mastra/core/mastra';
import { initializeTelegramApi } from './services/subscription.service';
import { registerAllHandlers } from './handlers';

export function createBot(mastra: Mastra): Bot {
  const bot = new Bot(token!);
  const logger = mastra.getLogger();

  // Initialize Telegram API
  initializeTelegramApi(bot.api);

  // Set bot commands menu
  bot.api.setMyCommands([...]).catch(...);

  // Register all handlers
  registerAllHandlers(bot, mastra);

  // Error handler
  bot.catch((err) => {
    logger.error('bot:error', { ... });
  });

  return bot;
}
```

### Adding New Handlers

**To add a new command:**

1. Create new file: `src/handlers/commands/mycommand.handler.ts`
2. Export registration function: `registerMyCommandHandler(bot, mastra)`
3. Import and call in `src/handlers/index.ts`

**To add a new callback:**

1. Create new file: `src/handlers/callbacks/mycallback.callback.ts`
2. Export registration function: `registerMyCallbacks(bot, mastra)`
3. Import and call in `src/handlers/index.ts`

### Handler Best Practices

1. **Always validate userId** - Check if `ctx.from?.id` exists
2. **Use structured logging** - Log with context: `logger.info('command:name', { userId })`
3. **Use centralized messages** - Import from `lib/messages.ts`
4. **Wrap in try-catch** - Handle errors gracefully
5. **Import shared utilities** - Use services from `services/` and utils from `lib/`
6. **Keep handlers focused** - One responsibility per handler file
7. **Group related commands** - Mode commands can be in one file (e.g., `mode.handler.ts` handles `/mode`, `/mode_logger`, etc.)

### Benefits of This Architecture

- ✅ **Separation of concerns** - Each handler in its own file
- ✅ **Easy to locate** - Find specific handlers quickly
- ✅ **Better for teams** - Multiple developers can work on different handlers
- ✅ **Easier testing** - Test handlers independently
- ✅ **Code reusability** - Shared utilities across handlers
- ✅ **Minimal bot.ts** - Main file reduced from 1,333 lines to 89 lines

---

### Mastra.ai Configuration Pattern

```typescript
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  name: "hilm-ai",

  agents: {
    transactionExtractor: "./agents/transaction-extractor",
    financeInsights: "./agents/finance-insights",
  },

  workflows: {
    processTransaction: "./workflows/process-transaction",
    budgetAlert: "./workflows/budget-alert",
  },

  tools: {
    extractTransaction: "./tools/extract-transaction",
    searchTransactions: "./tools/search-transactions",
  },

  rag: {
    vectorStore: {
      provider: "pinecone",
      config: {
        apiKey: process.env.PINECONE_API_KEY,
        index: "hilm-transactions",
      },
    },
    embeddings: {
      provider: "openai",
      model: "text-embedding-3-large",
    },
  },

  memory: {
    provider: "supabase",
    config: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_KEY,
    },
  },

  models: {
    default: {
      provider: "openai",
      name: "gpt-4o",
    },
  },
});
```

### Agent Pattern

```typescript
import { Agent } from "@mastra/core";
import { extractTransactionTool } from "../tools/extract-transaction";

export const transactionExtractorAgent = new Agent({
  name: "transaction-extractor",
  instructions: "Extract transaction details from natural language.",
  tools: [extractTransactionTool],
  model: {
    provider: "openai",
    name: "gpt-4o",
  },
});
```

### Tool Pattern

```typescript
import { createTool } from "@mastra/core";
import { z } from "zod";

export const extractTransactionTool = createTool({
  id: "extract-transaction",
  description: "Extract transaction details from text",
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    amount: z.number(),
    merchant: z.string(),
    category: z.string(),
    date: z.string(),
  }),
  execute: async ({ context, input }) => {
    // Implementation
  },
});
```

### Workflow Pattern

```typescript
import { Workflow } from "@mastra/core";

export const budgetAlertWorkflow = new Workflow({
  name: "budget-alert",
  trigger: {
    type: "schedule",
    schedule: "0 20 * * *", // Daily at 8 PM
  },
  steps: [
    {
      id: "check-budgets",
      tool: "check-budget",
    },
    {
      id: "send-alerts",
      action: async ({ context, previousStepOutput }) => {
        // Send Telegram messages
      },
    },
  ],
});
```

---

## Mastra.ai Best Practices

### ✅ When to Use Tools vs Agents

**Use a Tool when:**

- You need to perform a specific, well-defined operation
- The logic involves external API calls or database operations
- You want structured input/output with Zod schemas
- Examples: Extract transaction, search database, transcribe audio

**Use an Agent when:**

- You need LLM reasoning and decision-making
- The task requires using multiple tools
- You want the LLM to decide which tool to use
- Examples: Transaction extractor (uses multiple tools), Finance insights

**Use an Agent + Tool together when:**

- You need LLM-based classification/reasoning with structured output
- The agent calls the tool, which handles the LLM call and returns structured data
- Example: Message classifier (agent calls classify-message tool)

### 🔧 Creating Tools with LLM Integration

When you need LLM-based logic (like classification), create a tool that:

1. **Has proper schemas:**

```typescript
import { createTool } from "@mastra/core";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const classifyMessageTool = createTool({
  id: "classify-message",
  description: "Classify user messages (multilingual support)",
  inputSchema: z.object({
    text: z.string().describe("The user message to classify"),
  }),
  outputSchema: z.object({
    type: z.enum(["transaction", "query", "other"]),
    confidence: z.enum(["high", "medium", "low"]),
    reason: z.string(),
  }),
  execute: async ({ context }) => {
    const { text } = context;

    // Call LLM here
    const { text: response } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        /* ... */
      ],
    });

    // Parse and return structured data matching outputSchema
    return { type: "transaction", confidence: "high", reason: "..." };
  },
});
```

2. **Install required packages:**

```bash
npm install ai  # For generateText
```

3. **Create a simple agent wrapper:**

```typescript
import { Agent } from "@mastra/core/agent";
import { classifyMessageTool } from "../tools/classify-message-tool.js";

export const messageClassifierAgent = new Agent({
  name: "Message Classifier",
  instructions: "Use the classify-message tool to classify the user message.",
  model: openai("gpt-4o-mini"),
  tools: {
    classifyMessage: classifyMessageTool,
  },
});
```

4. **Register in Mastra:**

```typescript
// src/mastra/index.ts
import { messageClassifierAgent } from "./agents/message-classifier-agent.js";

export const mastra = new Mastra({
  agents: {
    messageClassifier: messageClassifierAgent,
    // ... other agents
  },
});
```

5. **Call from bot and extract result:**

```typescript
const classifierAgent = mastra.getAgent("messageClassifier");
const result = await classifierAgent.generate(text);

// Extract tool result from agent response
const classification = result.toolResults?.[0]?.payload?.result;
// classification = { type: 'transaction', confidence: 'high', reason: '...' }
```

### 🎯 Key Lessons

**❌ Don't do this:**

- Call tools directly with `.execute()` (hard to get context right)
- Parse JSON manually from agent text responses
- Use rule-based logic for multilingual classification

**✅ Do this:**

- Create tool with LLM call inside
- Use agent to call the tool
- Extract result from `toolResults[0].payload.result`
- Use Zod schemas for type safety
- Let LLM handle multilingual logic

### 📍 Accessing Tool Results

When an agent calls a tool, access the result like this:

```typescript
const result = await agent.generate(input);

// Tool result structure:
// result.toolResults[0].payload = {
//   toolName: 'classifyMessage',
//   args: { text: '...' },
//   result: { type: 'transaction', confidence: 'high', reason: '...' }
// }

if (result.toolResults && result.toolResults.length > 0) {
  const toolResult = result.toolResults[0];
  if (toolResult && "payload" in toolResult) {
    const data = toolResult.payload.result;
    // Use data here - it matches your outputSchema!
  }
}
```

### Important: NO AI Libraries in Web Project

For the **Astro website**, do NOT add:

- ❌ `openai` SDK
- ❌ `pdf-parse`
- ❌ `papaparse`
- ❌ `langchain`
- ❌ Vector database libraries

All AI features are handled by the **Mastra.ai Telegram bot** (separate project).

---

## Code Quality Standards

### ESLint & Prettier

**After ANY code changes, MUST run:**

```bash
npm run check      # Format + auto-fix lint errors
# OR
npx eslint <file> --fix
```

**Verify:**

```bash
npm run lint       # Check for errors
npm test           # Run tests (if applicable)
```

### TypeScript Standards

- ✅ Use proper interfaces for props
- ✅ Avoid `any` types
- ✅ Use optional chaining (`?.`) not non-null assertions (`!`)
- ✅ Import types: `import { type MyType } from './types'`

### Common ESLint Issues

- Unused variables → Remove or prefix with `_`
- Missing types → Add TypeScript interfaces
- Non-null assertions → Use optional chaining

---

## Git Workflow & Commits

### Committing Changes

Only create commits when **explicitly requested** by the user.

**Git Safety Protocol:**

- ✅ NEVER update git config
- ✅ NEVER run destructive commands (force push, hard reset)
- ✅ NEVER skip hooks (--no-verify)
- ✅ NEVER force push to main/master
- ✅ NEVER commit unless user explicitly asks

**Commit Process:**

1. Run `git status` and `git diff` in parallel
2. Analyze changes and draft commit message
3. Add relevant files to staging
4. Create commit with message ending in:

   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

**Commit Message Format:**

```bash
git commit -m "$(cat <<'EOF'
Add waitlist landing page with Astro

Implemented hero, features, FAQ, and footer sections.
Uses Tailwind CSS v4 and Cloudflare Pages deployment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Pull Requests

**Using GitHub CLI:**

```bash
# Check current state
git status
git diff main...HEAD

# Create PR
gh pr create --title "PR Title" --body "$(cat <<'EOF'
## Summary
- Bullet points

## Test plan
- [ ] Checklist items

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Development Best Practices

### Astro-Specific

1. ✅ Use `.astro` components for static content
2. ✅ Use Astro's built-in optimization for images
3. ✅ Keep JavaScript minimal (Astro is static-first)
4. ✅ Use content collections for blog/pages
5. ✅ Leverage Astro's partial hydration for interactivity

### General

6. ✅ Always use Tailwind utility classes
7. ✅ Add `data-testid` for testing
8. ✅ Handle errors gracefully
9. ✅ Show loading states
10. ✅ Run `npm run check` before committing

---

## Common Mistakes to Avoid

### Astro Website

1. ❌ **Never** add AI/RAG libraries to web project
2. ❌ **Never** use client-side JavaScript for content that can be static
3. ❌ **Never** forget to run from `web/` directory
4. ❌ **Never** commit without running lint + format

### Mastra.ai Bot

5. ❌ **Never** add command/callback handlers directly to `bot.ts` - use the modular handler system in `src/handlers/`
6. ❌ **Never** create static database connections
7. ❌ **Never** expose backend secrets to frontend
8. ❌ **Never** use synchronous blocking operations
9. ❌ **Never** skip error handling for external APIs

### General

10. ❌ **Never** use non-null assertions - use optional chaining
11. ❌ **Never** commit unless explicitly asked by user

---

## Environment Variables

### Astro Website (.env)

```bash
# Astro environment variables (VITE_ prefix for client-side)
VITE_API_URL=https://api.hilm.ai
```

### Mastra.ai Bot (.env - Future)

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your_token

# OpenAI
OPENAI_API_KEY=your_key

# Supabase
SUPABASE_URL=your_url
SUPABASE_KEY=your_key

# Pinecone
PINECONE_API_KEY=your_key
PINECONE_ENVIRONMENT=your_env
PINECONE_INDEX=hilm-transactions

# App
NODE_ENV=development
LOG_LEVEL=info
```

---

## Testing

**Astro Website:**

```bash
cd web
npm test              # Run tests (if configured)
npm run build         # Verify build works
```

**Future Mastra.ai Bot:**

- Unit tests for tools and agents
- Integration tests for workflows
- E2E tests for critical user flows

---

## Path Aliases

TypeScript path alias `@/*` maps to `./src/*`:

```typescript
// ✅ Good
import { Button } from "@/components/Button";

// ❌ Avoid
import { Button } from "../../../components/Button";
```

---

## Resources

### Astro

- [Astro Docs](https://docs.astro.build)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Cloudflare Pages Adapter](https://docs.astro.build/en/guides/deploy/cloudflare/)

### Mastra.ai

- [Mastra.ai LLM Guide](https://mastra.ai/llms-full.txt) - Comprehensive LLM integration guide

### Styling

- [Tailwind CSS v4](https://tailwindcss.com)
- [Tailwind Vite Plugin](https://tailwindcss.com/docs/installation/vite)

### Deployment

- [Cloudflare Pages](https://pages.cloudflare.com)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

---

**Key Takeaway**: This is an Astro-based static site with Tailwind CSS v4, deployed on Cloudflare Pages. Future AI features will be handled by a separate Mastra.ai-powered Telegram bot.
