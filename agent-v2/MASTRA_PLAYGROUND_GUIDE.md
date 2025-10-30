# Mastra Playground Guide - HilmAI Agent V2

**How to use the Mastra playground for debugging and testing agents**

---

## 🎮 What is Mastra Playground?

The Mastra playground is a web-based UI for:
- **Testing agents** interactively
- **Debugging workflows** step-by-step
- **Viewing logs** in real-time
- **Monitoring observability** data
- **Inspecting tool calls** and responses

---

## 🚀 Quick Start

### 1. Start the Mastra Server

```bash
cd agent-v2

# Development mode (recommended)
yarn dev

# Or use Mastra CLI directly
npx mastra dev
```

**Expected output:**
```
INFO [Mastra CLI]: Analyzing dependencies...
INFO [Mastra CLI]: Bundling Mastra application
INFO [Mastra CLI]: Starting dev server...
INFO: HilmAI V2 initialized
{
  "agents": ["supervisor", "transactionLogger", "queryExecutor", "conversation"],
  "tools": ["extractReceipt", "transcribeVoice", "extractTransaction", "saveTransaction", "hybridQuery"],
  "environment": "development",
  "port": 4111
}

🚀 Server running on http://localhost:4111
```

### 2. Open the Playground

**Open in browser:** [http://localhost:4111](http://localhost:4111)

---

## 📊 Mastra Configuration

Our Mastra instance includes:

### **Agents** (4)
1. `supervisor` - Main orchestrator (routes to sub-agents)
2. `transactionLogger` - Transaction extraction and saving
3. `queryExecutor` - Financial query answering
4. `conversation` - Chitchat and help

### **Tools** (5)
1. `extractReceipt` - GPT-4o Vision for receipt OCR
2. `transcribeVoice` - Whisper API for audio transcription
3. `extractTransaction` - Text parsing for transactions
4. `saveTransaction` - Save with embedding generation
5. `hybridQuery` - SQL + pgvector search

### **Storage**
- **LibSQL** (local file or Turso)
- Stores observability data and logs
- Location: `agent-v2/mastra.db` (if using local file)

### **Logger**
- **Pino Logger** with structured logging
- Level: `debug` (development) or `info` (production)
- Name: `HilmAI-V2`

### **Server**
- **Port:** 4111 (configurable via `MASTRA_PORT`)
- **Auth:** Disabled in development
- **Endpoints:**
  - `GET /health` - Health check
  - `GET /api/status` - Detailed status

---

## 🎯 How to Use the Playground

### Testing an Agent

1. **Navigate to Agents tab** in the playground
2. **Select an agent:**
   - `supervisor` - For full flow testing
   - `transactionLogger` - For transaction extraction
   - `queryExecutor` - For query testing
   - `conversation` - For chitchat

3. **Enter a test message:**
   ```
   Example for transactionLogger:
   "I spent 50 AED at Carrefour yesterday"

   Example for queryExecutor:
   "How much did I spend on groceries?"

   Example for conversation:
   "What can you do?"
   ```

4. **Add context (optional):**
   ```json
   {
     "resourceId": "123456",
     "userId": 123456
   }
   ```

5. **Click "Run"**

6. **View results:**
   - Agent response
   - Tool calls made
   - Execution time
   - Logs

### Testing the Supervisor Flow

**Best practice:** Test via the `supervisor` agent to simulate real bot behavior.

**Example message:**
```
[Current Date: Today is 2025-10-29, Yesterday was 2025-10-28]
[User: John (@john_doe)]
[Message Type: text]

I spent 50 AED at Carrefour yesterday
```

**What happens:**
1. Supervisor analyzes intent → Routes to `transactionLogger`
2. Transaction Logger extracts details
3. Calls `saveTransaction` tool
4. Generates embedding (with cache)
5. Saves to Supabase
6. Returns confirmation

### Viewing Logs

1. **Navigate to Logs tab**
2. **Filter by:**
   - Agent name
   - Tool name
   - Log level (debug/info/warn/error)
   - Time range

3. **View structured logs:**
   ```json
   {
     "level": "info",
     "time": "2025-10-29T19:48:33.000Z",
     "msg": "HilmAI V2 initialized",
     "agents": ["supervisor", "transactionLogger", ...],
     "port": 4111
   }
   ```

### Inspecting Tool Calls

1. **Navigate to Tools tab**
2. **Select a tool** (e.g., `saveTransaction`)
3. **View:**
   - Input schema
   - Output schema
   - Recent executions
   - Success/failure rates

4. **Test directly:**
   ```json
   Input:
   {
     "userId": 123456,
     "amount": 50,
     "currency": "AED",
     "merchant": "Carrefour",
     "category": "Groceries",
     "transactionDate": "2025-10-28"
   }
   ```

### Monitoring Observability

1. **Navigate to Observability tab**
2. **View traces:**
   - Agent execution traces
   - Tool call traces
   - Timing breakdown
   - Error traces

3. **Analyze performance:**
   - Average response time
   - Success rate
   - Tool usage patterns

---

## 🔍 Debugging Tips

### 1. Test Agents Individually

**Start simple:**
```
Test order:
1. conversation (no tools) → simplest
2. queryExecutor (1 tool) → moderate
3. transactionLogger (4 tools) → complex
4. supervisor (3 sub-agents) → full flow
```

### 2. Use Structured Input

Always include date context when testing:
```
[Current Date: Today is 2025-10-29, Yesterday was 2025-10-28]
Your message here
```

### 3. Check Logs Immediately

After each test:
1. Go to Logs tab
2. Filter by agent name
3. Look for errors or warnings

### 4. Verify Tool Execution

If agent seems stuck:
1. Check Tools tab
2. Verify tool was called
3. Check tool input/output
4. Look for errors in tool execution

### 5. Test with resourceId

To test conversation memory:
```json
Context:
{
  "resourceId": "test-user-123"
}

Message 1: "How much on groceries?"
Message 2: "What about this week?" (should remember "groceries")
```

---

## 🌐 API Endpoints

### Health Check

```bash
curl http://localhost:4111/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "hilm-ai-agent-v2",
  "version": "2.0.0",
  "timestamp": "2025-10-29T19:48:33.000Z",
  "uptime": 123.45
}
```

### Detailed Status

```bash
curl http://localhost:4111/api/status
```

**Response:**
```json
{
  "status": "ok",
  "service": "hilm-ai-agent-v2",
  "version": "2.0.0",
  "environment": "development",
  "agents": ["supervisor", "transactionLogger", "queryExecutor", "conversation"],
  "tools": ["extractReceipt", "transcribeVoice", "extractTransaction", "saveTransaction", "hybridQuery"],
  "features": {
    "pgvector": true,
    "responseCache": true,
    "conversationMemory": true
  }
}
```

---

## 🛠️ Configuration

### Environment Variables

```bash
# Mastra Server
MASTRA_PORT=4111                    # Server port (default: 4111)
NODE_ENV=development                # Enable debug logging

# Storage (LibSQL)
LIBSQL_URL=file:./mastra.db        # Local file (or Turso URL)
LIBSQL_AUTH_TOKEN=                 # Only for Turso

# Optional: Telemetry
OTEL_SERVICE_NAME=hilm-agent-v2    # Service name for traces
OTEL_EXPORTER_OTLP_ENDPOINT=       # OpenTelemetry endpoint

# Optional: Auth (production only)
MASTRA_DASHBOARD_TOKEN=            # Token for production access
```

### Storage Locations

**Local development:**
```
agent-v2/mastra.db                 # SQLite database
agent-v2/.mastra/output/           # Build output
```

**Turso (recommended for production):**
```bash
# Setup Turso
turso db create hilm-mastra
turso db show hilm-mastra --url
turso db tokens create hilm-mastra

# Add to .env
LIBSQL_URL=libsql://xxx.turso.io
LIBSQL_AUTH_TOKEN=eyJhbG...
```

---

## 📝 Example Debugging Session

### Scenario: Transaction not saving

**Steps:**

1. **Start Mastra playground:**
   ```bash
   yarn dev
   ```

2. **Open:** http://localhost:4111

3. **Test transactionLogger agent:**
   ```
   Input: "I spent 50 AED at Carrefour"
   ```

4. **Check Logs tab:**
   ```
   Look for:
   - "[embeddings] Cache hit: Carrefour"
   - "[save-transaction] Saved transaction ID: 123"
   - "[supabase] Insert error" (if failing)
   ```

5. **Check Tools tab → saveTransaction:**
   - View recent executions
   - Check input data
   - Check error messages

6. **If tool fails:**
   - Check Supabase connection
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Test Supabase directly:
     ```bash
     curl -H "apikey: $SUPABASE_ANON_KEY" \
          "$SUPABASE_URL/rest/v1/transactions?limit=1"
     ```

7. **Fix and retest**

---

## 🎓 Advanced Features

### Custom Test Scenarios

Create test files:

```typescript
// test-scenarios.ts
export const testCases = [
  {
    name: "Simple transaction",
    agent: "transactionLogger",
    input: "I spent 50 AED at Starbucks",
    expected: "Saved! 50 AED",
  },
  {
    name: "Query with typo",
    agent: "queryExecutor",
    input: "How much at starbuks?", // typo
    expected: "Starbucks", // should find correct name
  },
];
```

### Performance Testing

Use the playground to:
1. Test response times
2. Identify slow tools
3. Optimize agent flows

**Look for:**
- Response time > 3s → Investigate
- Tool calls > 5 → Simplify flow
- Errors > 10% → Fix urgently

---

## 🐛 Troubleshooting

### Playground won't start

```bash
# Check port 4111 is available
lsof -i :4111

# Kill if needed
kill -9 $(lsof -t -i:4111)

# Restart
yarn dev
```

### Agents not showing

```bash
# Check build
yarn build

# Check logs
yarn dev | grep "initialized"
# Should see: "HilmAI V2 initialized"
```

### Tools not executing

1. Check environment variables
2. Verify API keys (OPENAI_API_KEY)
3. Check Supabase connection
4. View error logs in playground

---

## 📚 Resources

- **Mastra Docs:** https://mastra.ai/docs
- **Playground Guide:** https://mastra.ai/docs/playground
- **Agent Debugging:** https://mastra.ai/docs/debugging

---

## ✅ Checklist

Before debugging with playground:

- [ ] Built successfully (`yarn build`)
- [ ] All env vars set (`.env` file)
- [ ] Database schema created (Supabase)
- [ ] Port 4111 available
- [ ] Started server (`yarn dev`)
- [ ] Opened http://localhost:4111

---

**Happy debugging! 🎉**

---

**Document Version:** 1.0
**Last Updated:** October 29, 2025
