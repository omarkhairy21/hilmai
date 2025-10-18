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
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  }
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

### Project Structure (When Implemented)

```
src/
├── mastra/
│   ├── index.ts                      # Mastra instance
│   ├── agents/
│   │   ├── transaction-extractor.ts  # NLU for expense logging
│   │   ├── finance-insights.ts       # Query answering agent
│   │   └── budget-advisor.ts         # Budget recommendations
│   ├── tools/
│   │   ├── extract-transaction.ts    # Parse text transactions
│   │   ├── extract-receipt.ts        # OCR with GPT-4o Vision
│   │   ├── transcribe-voice.ts       # Whisper API
│   │   ├── search-transactions.ts    # RAG semantic search
│   │   └── check-budget.ts           # Budget calculations
│   ├── workflows/
│   │   ├── process-transaction.ts    # Transaction pipeline
│   │   ├── budget-alert.ts           # Daily budget checks
│   │   └── weekly-summary.ts         # Weekly reports
│   └── rag/
│       ├── vector-store.ts           # Pinecone config
│       └── embeddings.ts             # Embedding generation
├── telegram/
│   ├── bot.ts                        # Bot initialization
│   └── handlers/                     # Message handlers
└── database/
    ├── supabase.ts                   # Supabase client
    └── repositories/                 # Data access layer
```

### Mastra.ai Configuration Pattern

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  name: 'hilm-ai',

  agents: {
    transactionExtractor: './agents/transaction-extractor',
    financeInsights: './agents/finance-insights',
  },

  workflows: {
    processTransaction: './workflows/process-transaction',
    budgetAlert: './workflows/budget-alert',
  },

  tools: {
    extractTransaction: './tools/extract-transaction',
    searchTransactions: './tools/search-transactions',
  },

  rag: {
    vectorStore: {
      provider: 'pinecone',
      config: {
        apiKey: process.env.PINECONE_API_KEY,
        index: 'hilm-transactions',
      },
    },
    embeddings: {
      provider: 'openai',
      model: 'text-embedding-3-large',
    },
  },

  memory: {
    provider: 'supabase',
    config: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_KEY,
    },
  },

  models: {
    default: {
      provider: 'openai',
      name: 'gpt-4o',
    },
  },
});
```

### Agent Pattern

```typescript
import { Agent } from '@mastra/core';
import { extractTransactionTool } from '../tools/extract-transaction';

export const transactionExtractorAgent = new Agent({
  name: 'transaction-extractor',
  instructions: 'Extract transaction details from natural language.',
  tools: [extractTransactionTool],
  model: {
    provider: 'openai',
    name: 'gpt-4o',
  },
});
```

### Tool Pattern

```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';

export const extractTransactionTool = createTool({
  id: 'extract-transaction',
  description: 'Extract transaction details from text',
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
import { Workflow } from '@mastra/core';

export const budgetAlertWorkflow = new Workflow({
  name: 'budget-alert',
  trigger: {
    type: 'schedule',
    schedule: '0 20 * * *', // Daily at 8 PM
  },
  steps: [
    {
      id: 'check-budgets',
      tool: 'check-budget',
    },
    {
      id: 'send-alerts',
      action: async ({ context, previousStepOutput }) => {
        // Send Telegram messages
      },
    },
  ],
});
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

### Mastra.ai Bot (Future)

5. ❌ **Never** create static database connections
6. ❌ **Never** expose backend secrets to frontend
7. ❌ **Never** use synchronous blocking operations
8. ❌ **Never** skip error handling for external APIs

### General

9. ❌ **Never** use non-null assertions - use optional chaining
10. ❌ **Never** commit unless explicitly asked by user

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
import { Button } from '@/components/Button';

// ❌ Avoid
import { Button } from '../../../components/Button';
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
