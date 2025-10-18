# Migration Guide: From Manual Setup to Mastra Best Practices

## Overview

This guide documents the migration of your financial analyst agent code from the manually configured `agent/` folder to the `my-first-agent/` folder, which follows Mastra's official best practices and conventions.

## What Changed

### Before (Manual Setup in `agent/`)
```
agent/
├── index.ts          # Everything in one file
├── package.json
└── tsconfig.json
```

**Issues with manual setup:**
- All tools, agents, and initialization in a single file
- Harder to maintain and scale
- Does not follow Mastra conventions
- Limited built-in observability

### After (Best Practice in `my-first-agent/`)
```
my-first-agent/
├── src/
│   └── mastra/
│       ├── index.ts                        # Main Mastra initialization
│       ├── agents/
│       │   ├── weather-agent.ts            # Weather agent (existing)
│       │   ├── financial-analyst-agent.ts  # Financial analyst agent (migrated)
│       │   └── financial-analyst-agent.test.ts
│       ├── tools/
│       │   ├── weather-tool.ts             # Weather tool (existing)
│       │   └── financial-tools.ts          # Financial tools (migrated)
│       └── workflows/
│           └── weather-workflow.ts         # Workflow example (existing)
├── package.json
└── tsconfig.json
```

**Benefits of the new structure:**
- ✅ Clear separation of concerns (tools, agents, workflows)
- ✅ Follows Mastra conventions and best practices
- ✅ Better scalability for multiple agents
- ✅ Built-in memory management with LibSQLStore
- ✅ Enhanced observability with PinoLogger
- ✅ Proper dependency management through Mastra CLI

## Migration Details

### 1. **Tools Migration**

**Before:** Tools defined inline as objects
```typescript
const extractStatementDataTool = {
  label: 'Extract Bank Statement Data',
  schema: z.object({ ... }),
  executor: async ({ fileContent, fileType }) => { ... }
};
```

**After:** Tools created with `createTool()` helper
```typescript
export const extractStatementDataTool = createTool({
  id: 'extract-statement-data',
  description: 'Extract and parse data from bank statements',
  inputSchema: z.object({ ... }),
  outputSchema: z.object({ ... }),
  execute: async ({ context }) => { ... }
});
```

**Files created:**
- `my-first-agent/src/mastra/tools/financial-tools.ts` - All financial tools

### 2. **Agent Migration**

**Before:** Agent initialization with inline tools
```typescript
const mastra = new Mastra({
  agents: {
    financialAnalystAgent: new Agent({
      name: 'Financial Analyst Agent',
      instructions: '...',
      model: { provider: 'ANTHROPIC', name: 'claude-3-5-sonnet-20241022' },
      tools: { ... }
    })
  }
});
```

**After:** Dedicated agent file with proper imports
```typescript
// src/mastra/agents/financial-analyst-agent.ts
export const financialAnalystAgent = new Agent({
  name: 'Financial Analyst Agent',
  instructions: '...',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  tools: { ... },
  memory: new Memory({ storage: new LibSQLStore({ url: 'file:../mastra.db' }) })
});
```

**Files created:**
- `my-first-agent/src/mastra/agents/financial-analyst-agent.ts` - Financial analyst agent with memory support

### 3. **Initialization Migration**

**Before:** Everything in one index.ts
```typescript
const mastra = new Mastra({
  agents: { financialAnalystAgent: new Agent({ ... }) }
});

// Test code directly in index.ts
export { mastra };
```

**After:** Modular initialization with multiple components
```typescript
// src/mastra/index.ts
export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, financialAnalystAgent },
  storage: new LibSQLStore({ url: ":memory:" }),
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  observability: { default: { enabled: true } }
});
```

**Key improvements:**
- ✅ Logger configuration for better debugging
- ✅ Storage layer for persistence and observability
- ✅ Telemetry and observability settings
- ✅ Modular agent and workflow registration

### 4. **Package.json Updates**

**New dependencies added:**
- `@mastra/libsql` - Database storage for memory and observability
- `@mastra/loggers` - Structured logging with Pino
- `@mastra/memory` - Memory management for agents
- `zod` - Schema validation (already in your code)

**New scripts added:**
```json
{
  "scripts": {
    "dev": "mastra dev",      // Development mode with hot reload
    "build": "mastra build",  // Build for production
    "start": "mastra start"   // Run in production
  }
}
```

## How to Use the Migrated Code

### Running the Development Server

```bash
cd my-first-agent
npm install  # If dependencies haven't been installed
npm run dev  # Starts the development server
```

### Testing the Financial Analyst Agent

```bash
# Run the test file
cd my-first-agent
npx tsx src/mastra/agents/financial-analyst-agent.test.ts
```

### Accessing Agents

```typescript
import { mastra } from './src/mastra/index';

// Get the financial analyst agent
const agent = mastra.getAgent('financialAnalystAgent');

// Use it
const result = await agent.generate({
  messages: [{
    role: 'user',
    content: 'Analyze this bank statement...'
  }]
});
```

## Model Configuration Changes

**Before:**
```typescript
model: {
  provider: 'ANTHROPIC',
  name: 'claude-3-5-sonnet-20241022',
  toolChoice: 'auto',
}
```

**After:**
```typescript
model: 'anthropic/claude-3-5-sonnet-20241022'
```

The new format is simpler and leverages Mastra's model resolver. The `toolChoice` is handled automatically by the agent.

## Memory Management

The migrated financial analyst agent now includes memory support:

```typescript
memory: new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db'  // Change to ':memory:' for in-memory storage
  })
})
```

This allows the agent to:
- Remember conversation history
- Build context over multiple interactions
- Store user preferences and insights

## Next Steps

1. ✅ **Remove old `agent/` folder** (when ready to clean up)
   ```bash
   rm -rf agent/
   ```

2. **Configure environment variables** for production
   - Copy `.env.example` to `.env.local` if needed
   - Add your Anthropic API key: `ANTHROPIC_API_KEY=your_key_here`

3. **Deploy with Mastra CLI**
   ```bash
   mastra deploy
   ```

4. **Extend with more agents**
   - Add additional agents to `src/mastra/agents/`
   - Register them in `src/mastra/index.ts`

5. **Add workflows** if needed
   - Create workflow files in `src/mastra/workflows/`
   - See `weather-workflow.ts` for an example

## Comparison: Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| File Organization | Single file | Modular structure |
| Tools Definition | Inline objects | `createTool()` helper |
| Agent Memory | None | LibSQLStore support |
| Logging | No built-in logger | PinoLogger configured |
| Observability | Manual setup | Built-in support |
| CLI Commands | None | dev, build, start |
| Scalability | Limited | Designed for multiple agents |
| Type Safety | Partial | Full Zod schema support |

## Troubleshooting

### Issue: "Cannot find module '@mastra/...'"
**Solution:** Install dependencies
```bash
cd my-first-agent
npm install
```

### Issue: "Agent not found"
**Solution:** Ensure the agent is registered in `src/mastra/index.ts`
```typescript
agents: { weatherAgent, financialAnalystAgent }  // Include your agent here
```

### Issue: "ANTHROPIC_API_KEY not found"
**Solution:** Set environment variable
```bash
export ANTHROPIC_API_KEY=your_key_here
```

## Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [Agent Guide](https://mastra.ai/docs/agents)
- [Tools Guide](https://mastra.ai/docs/tools)
- [Workflows Guide](https://mastra.ai/docs/workflows)
- [Memory Guide](https://mastra.ai/docs/memory)
