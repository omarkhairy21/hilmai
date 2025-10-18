# Before & After Code Comparison

This document shows side-by-side comparisons of how your code was transformed during migration.

## 1. Tools Definition

### ❌ BEFORE: Inline Tool Objects

```typescript
// agent/index.ts
const extractStatementDataTool = {
  label: 'Extract Bank Statement Data',
  schema: z.object({
    fileContent: z.string().describe('The content of the bank statement file'),
    fileType: z.enum(['pdf', 'csv', 'excel']).describe('Type of the statement file'),
  }),
  executor: async ({ fileContent, fileType }: { fileContent: string; fileType: string }) => {
    return {
      success: true,
      data: {
        transactions: [
          { date: '2024-01-15', description: 'Payment', amount: -150.00, balance: 5000.00 },
          { date: '2024-01-20', description: 'Deposit', amount: 2000.00, balance: 7000.00 },
        ],
        summary: {
          openingBalance: 5150.00,
          closingBalance: 7000.00,
          totalDebits: -150.00,
          totalCredits: 2000.00,
        }
      }
    };
  }
};
```

### ✅ AFTER: Proper Tool Factory Pattern

```typescript
// my-first-agent/src/mastra/tools/financial-tools.ts
export const extractStatementDataTool = createTool({
  id: 'extract-statement-data',
  description: 'Extract and parse data from bank statements',
  inputSchema: z.object({
    fileContent: z.string().describe('The content of the bank statement file'),
    fileType: z.enum(['pdf', 'csv', 'excel']).describe('Type of the statement file'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.object({
      transactions: z.array(z.object({
        date: z.string(),
        description: z.string(),
        amount: z.number(),
        balance: z.number(),
      })),
      summary: z.object({
        openingBalance: z.number(),
        closingBalance: z.number(),
        totalDebits: z.number(),
        totalCredits: z.number(),
      }),
    }),
  }),
  execute: async ({ context }) => {
    const { fileContent, fileType } = context;
    // Implementation
  },
});
```

**Key Improvements:**
- ✅ Uses `createTool()` factory function
- ✅ Separate `inputSchema` and `outputSchema` for type safety
- ✅ Tool ID for registration and identification
- ✅ Better TypeScript inference with Zod schemas
- ✅ Cleaner context parameter handling

---

## 2. Agent Configuration

### ❌ BEFORE: Monolithic Initialization

```typescript
// agent/index.ts
const mastra = new Mastra({
  agents: {
    financialAnalystAgent: new Agent({
      name: 'Financial Analyst Agent',
      instructions: `You are an expert...`,
      model: {
        provider: 'ANTHROPIC',
        name: 'claude-3-5-sonnet-20241022',
        toolChoice: 'auto',
      },
      tools: {
        extractStatementData: extractStatementDataTool,
        categorizeTransactions: categorizeTransactionsTool,
        detectAnomalies: detectAnomalesTool,
        generateInsights: generateInsightsTool,
      },
    }),
  },
});
```

### ✅ AFTER: Modular Agent Definition

```typescript
// my-first-agent/src/mastra/agents/financial-analyst-agent.ts
export const financialAnalystAgent = new Agent({
  name: 'Financial Analyst Agent',
  instructions: `You are an expert...`,
  model: 'anthropic/claude-3-5-sonnet-20241022',
  tools: {
    extractStatementData: extractStatementDataTool,
    categorizeTransactions: categorizeTransactionsTool,
    detectAnomalies: detectAnomaliesToolConfig,
    generateInsights: generateInsightsToolConfig,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
```

**Key Improvements:**
- ✅ Separate file for agent definition
- ✅ Simpler model string format (Mastra handles provider resolution)
- ✅ Added memory support with LibSQLStore
- ✅ Reusable across multiple files
- ✅ Easier to test and maintain

---

## 3. Initialization & Export

### ❌ BEFORE: Everything in One File

```typescript
// agent/index.ts
import { Agent, Mastra } from '@mastra/core';
import { z } from 'zod';
import 'dotenv/config';

// All tools defined here
const extractStatementDataTool = { ... };
const categorizeTransactionsTool = { ... };
const detectAnomaliesTool = { ... };
const generateInsightsTool = { ... };

// Agent defined here
const mastra = new Mastra({
  agents: { financialAnalystAgent: new Agent({ ... }) },
});

// Test code directly in index.ts
async function testAgent() { ... }

if (import.meta.url === `file://${process.argv[1]}`) {
  testAgent().catch(console.error);
}

export { mastra };
```

### ✅ AFTER: Clean Separation of Concerns

```typescript
// my-first-agent/src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { financialAnalystAgent } from './agents/financial-analyst-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, financialAnalystAgent },
  storage: new LibSQLStore({ url: ":memory:" }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: { enabled: false },
  observability: { default: { enabled: true } },
});
```

**Key Improvements:**
- ✅ Clean separation: index.ts only handles initialization
- ✅ Proper logger configuration (PinoLogger)
- ✅ Storage layer for persistence and observability
- ✅ Telemetry and observability settings
- ✅ Test code in separate file
- ✅ Easy to scale with new agents and workflows

---

## 4. File Organization

### ❌ BEFORE: Monolithic Structure

```
agent/
├── index.ts (225 lines)
│   ├── All 4 tools
│   ├── Agent definition
│   ├── Test function
│   └── Module export
├── package.json
└── tsconfig.json
```

**Problems:**
- Hard to maintain (225 lines in one file)
- Difficult to test (mixed concerns)
- Hard to reuse tools in other agents
- Not scalable for adding more agents

### ✅ AFTER: Modular Structure

```
my-first-agent/src/mastra/
├── index.ts (27 lines)
│   └── Mastra initialization only
│
├── agents/
│   ├── weather-agent.ts (29 lines)
│   ├── financial-analyst-agent.ts (29 lines)
│   └── financial-analyst-agent.test.ts (109 lines)
│
├── tools/
│   ├── weather-tool.ts (102 lines)
│   └── financial-tools.ts (139 lines)
│
└── workflows/
    └── weather-workflow.ts (185 lines)
```

**Benefits:**
- ✅ Each concern in its own file
- ✅ Easy to find and modify code
- ✅ Simple to test (separate test file)
- ✅ Reusable tools and agents
- ✅ Easy to add new agents

---

## 5. Model Configuration

### ❌ BEFORE: Complex Object Format

```typescript
model: {
  provider: 'ANTHROPIC',
  name: 'claude-3-5-sonnet-20241022',
  toolChoice: 'auto',  // Explicitly set
}
```

### ✅ AFTER: Simple String Format

```typescript
model: 'anthropic/claude-3-5-sonnet-20241022'
```

**Why it's better:**
- ✅ Simpler and more readable
- ✅ Mastra automatically resolves the provider
- ✅ Less configuration needed
- ✅ `toolChoice` is handled automatically by the agent

---

## 6. Memory Management

### ❌ BEFORE: No Memory Support

```typescript
// agent/index.ts
const mastra = new Mastra({
  agents: {
    financialAnalystAgent: new Agent({
      // No memory configuration
      tools: { ... }
    })
  }
});
```

### ✅ AFTER: Full Memory Support

```typescript
// my-first-agent/src/mastra/agents/financial-analyst-agent.ts
export const financialAnalystAgent = new Agent({
  tools: { ... },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
```

**New Capabilities:**
- ✅ Persists conversation history
- ✅ Builds context over multiple interactions
- ✅ Stores user preferences
- ✅ Enables multi-turn conversations
- ✅ Can use `:memory:` for in-memory or `file:../mastra.db` for persistence

---

## 7. Testing

### ❌ BEFORE: Test Code Embedded in Main File

```typescript
// agent/index.ts
async function testAgent() {
  console.log('🚀 Starting Mastra Agent Test...\n');
  try {
    const agent = mastra.getAgent('financialAnalystAgent');
    // ... test code ...
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testAgent().catch(console.error);
}
```

### ✅ AFTER: Separate Test File

```typescript
// my-first-agent/src/mastra/agents/financial-analyst-agent.test.ts
import { mastra } from '../index';

async function testFinancialAgent() {
  console.log('🚀 Starting Financial Analyst Agent Test...\n');
  try {
    const agent = mastra.getAgent('financialAnalystAgent');
    // ... test code ...
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testFinancialAgent().catch(console.error);
}

export { testFinancialAgent };
```

**Benefits:**
- ✅ Separate from main code
- ✅ Can be run independently
- ✅ Easier to maintain
- ✅ Can be integrated into CI/CD pipelines
- ✅ Reusable test function

---

## 8. Dependencies

### ❌ BEFORE: Minimal Setup

```json
{
  "dependencies": {
    "@mastra/core": "latest",
    "dotenv": "^16.4.7"
  }
}
```

### ✅ AFTER: Production-Ready Setup

```json
{
  "dependencies": {
    "@mastra/core": "^0.21.1",
    "@mastra/libsql": "^0.15.2",
    "@mastra/loggers": "^0.10.16",
    "@mastra/memory": "^0.15.7",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@types/node": "^24.8.1",
    "mastra": "^0.17.0",
    "typescript": "^5.9.3"
  }
}
```

**New Features:**
- ✅ LibSQL for persistent storage
- ✅ Pino logger for structured logging
- ✅ Memory support for conversations
- ✅ Mastra CLI tools (dev, build, start)

---

## 9. Commands Comparison

### ❌ BEFORE

```bash
npm run dev      # tsx watch index.ts
npm start        # tsx index.ts
```

### ✅ AFTER

```bash
npm run dev      # mastra dev (dev server with hot reload)
npm run build    # mastra build (production build)
npm run start    # mastra start (run production build)
```

**Improvements:**
- ✅ Hot reload development
- ✅ Proper production builds
- ✅ CLI-based management
- ✅ Better development experience

---

## Summary Table

| Aspect | Before | After |
|--------|--------|-------|
| **Files** | 1 | 5+ |
| **Lines per file** | ~225 | 20-140 |
| **Code organization** | Monolithic | Modular |
| **Tools pattern** | Inline objects | `createTool()` |
| **Memory** | ❌ None | ✅ LibSQL |
| **Logger** | ❌ None | ✅ Pino |
| **Observability** | Manual | Built-in |
| **Testing** | Embedded | Separate file |
| **CLI support** | ❌ None | ✅ Full |
| **Scalability** | Limited | Excellent |
| **Type safety** | Partial | Full |

---

## Migration Path

```
agent/index.ts (225 lines)
    ↓
    ├─→ my-first-agent/src/mastra/index.ts (27 lines)
    ├─→ my-first-agent/src/mastra/agents/financial-analyst-agent.ts (29 lines)
    ├─→ my-first-agent/src/mastra/tools/financial-tools.ts (139 lines)
    └─→ my-first-agent/src/mastra/agents/financial-analyst-agent.test.ts (109 lines)
```

**Result:** Same functionality, better organization, more features! 🎉
