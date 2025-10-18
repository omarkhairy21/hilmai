# hilm.ai Telegram Bot: Product Roadmap & Implementation Plan
## Built with Mastra.ai + TypeScript

## Executive Summary

hilm.ai is an AI-powered personal finance advisor delivered through Telegram. Users can log expenses via text, voice, or images and ask natural language questions about their spending. The bot uses Mastra.ai framework with GPT-4o for understanding and RAG (Retrieval-Augmented Generation) for accurate financial insights.

**Core Value Proposition:** "Chat with your money - Track expenses naturally, get intelligent insights instantly"

**Technology Stack:**
- **Framework:** Mastra.ai (TypeScript agent framework)
- **Bot Platform:** Telegram Bot API (node-telegram-bot-api)
- **LLM:** OpenAI GPT-4o (via Mastra.ai model router)
- **Voice:** OpenAI Whisper API
- **Vision:** GPT-4o Vision for receipt OCR
- **Database:** Supabase (PostgreSQL + pgvector)
- **Vector DB:** Pinecone (for semantic search)
- **Deployment:** Vercel / Railway / AWS Lambda
- **Language:** TypeScript

**Target Users:** 
- Young professionals (25-40) who prefer messaging over apps
- Users frustrated with traditional budgeting apps requiring bank connections
- People who want quick financial insights without complex dashboards
- Privacy-conscious users who don't want to connect bank accounts

**Why Telegram Bot + Mastra.ai:**
- Launch in weeks, not months (no app store approval)
- Single codebase works everywhere (iOS, Android, Desktop, Web)
- Built-in viral distribution (sharing, forwarding)
- Native support for multimodal input (text, voice, images)
- Mastra.ai provides production-ready workflows, RAG, and memory
- Free infrastructure (Telegram handles delivery and storage)
- Instant updates without user downloads
- TypeScript-first development with excellent tooling

---

## Technology Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER EXPERIENCE                         │
│                                                                 │
│  Input Methods          →    Processing      →    Output       │
│  • Text messages             • NLU/NLP           • Text replies│
│  • Voice notes               • OCR               • Formatted   │
│  • Receipt photos            • Speech-to-text     messages     │
│  • Commands                  • Transaction       • Insights    │
│                               extraction         • Charts      │
│                             • AI analysis                      │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TELEGRAM BOT LAYER                         │
│                                                                 │
│  • node-telegram-bot-api (TypeScript)                          │
│  • Webhook-based message handling                              │
│  • Command routing (/start, /help, /budget, etc.)             │
│  • Inline keyboards and buttons                                │
│  • File download and upload                                    │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      MASTRA.AI FRAMEWORK                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Agents     │  │  Workflows   │  │     RAG      │        │
│  │ (Transaction │  │ (Budget      │  │ (Semantic    │        │
│  │  Extractor,  │  │  Alerts,     │  │  Search,     │        │
│  │  Insights)   │  │  Summaries)  │  │  Memory)     │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │    Tools     │  │    Memory    │  │   Streaming  │        │
│  │ (OCR, Voice, │  │ (Conversation│  │   (Real-time │        │
│  │  Search,     │  │  History,    │  │   responses) │        │
│  │  Budget)     │  │  Context)    │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   OpenAI     │  │  Supabase    │  │   Pinecone   │        │
│  │   GPT-4o     │  │  PostgreSQL  │  │Vector Store  │        │
│  │   Whisper    │  │  + pgvector  │  │  (Semantic   │        │
│  │   Vision     │  │              │  │   Search)    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│                                                                 │
│  • User profiles and preferences (Supabase)                    │
│  • Transaction history with metadata (Supabase)                │
│  • Transaction embeddings (Pinecone)                           │
│  • Budget settings and alerts (Supabase)                       │
│  • AI-generated insights cache (Supabase)                      │
│  • Usage analytics and metrics (Supabase)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
hilm-ai/
├── src/
│   ├── mastra/
│   │   ├── index.ts                 # Mastra instance initialization
│   │   ├── agents/
│   │   │   ├── transaction-extractor.ts   # Transaction NLU agent
│   │   │   ├── finance-insights.ts        # Query/insights agent
│   │   │   └── budget-advisor.ts          # Budget recommendations
│   │   ├── tools/
│   │   │   ├── extract-transaction.ts     # Text transaction parsing
│   │   │   ├── extract-receipt.ts         # OCR for receipts
│   │   │   ├── transcribe-voice.ts        # Whisper integration
│   │   │   ├── search-transactions.ts     # RAG semantic search
│   │   │   ├── check-budget.ts            # Budget status check
│   │   │   └── get-insights.ts            # Generate spending insights
│   │   ├── workflows/
│   │   │   ├── process-transaction.ts     # Transaction processing flow
│   │   │   ├── budget-alert.ts            # Daily budget checks
│   │   │   └── weekly-summary.ts          # Weekly spending report
│   │   └── rag/
│   │       ├── vector-store.ts            # Pinecone configuration
│   │       └── embeddings.ts              # Embedding generation
│   ├── telegram/
│   │   ├── bot.ts                   # Telegram bot initialization
│   │   ├── handlers/
│   │   │   ├── start.ts             # /start command
│   │   │   ├── help.ts              # /help command
│   │   │   ├── text.ts              # Text message handler
│   │   │   ├── voice.ts             # Voice note handler
│   │   │   ├── photo.ts             # Receipt photo handler
│   │   │   ├── budget.ts            # /budget command
│   │   │   └── summary.ts           # /summary command
│   │   └── utils/
│   │       ├── keyboards.ts         # Inline keyboards
│   │       └── formatters.ts        # Message formatting
│   ├── database/
│   │   ├── supabase.ts              # Supabase client
│   │   ├── schema.sql               # Database schema
│   │   └── repositories/
│   │       ├── users.ts             # User CRUD operations
│   │       ├── transactions.ts      # Transaction CRUD
│   │       └── budgets.ts           # Budget CRUD
│   ├── services/
│   │   ├── transaction-service.ts   # Business logic for transactions
│   │   ├── budget-service.ts        # Budget calculations
│   │   └── analytics-service.ts     # Usage analytics
│   └── index.ts                     # Application entry point
├── .env.example
├── package.json
├── tsconfig.json
├── mastra.config.ts                 # Mastra configuration
└── README.md
```

---

## Development Phases Timeline

### Phase 0: Project Setup (Week 0 - 3 days)
**Goal:** Setup development environment and basic infrastructure

**Tasks:**
- [ ] Initialize TypeScript project with Mastra.ai
- [ ] Setup Telegram bot with BotFather
- [ ] Configure Supabase project (PostgreSQL + pgvector)
- [ ] Setup Pinecone account and create index
- [ ] Get OpenAI API keys
- [ ] Create environment configuration
- [ ] Setup Git repository and version control
- [ ] Configure ESLint, Prettier, and TypeScript
- [ ] Setup basic project structure

**Dependencies Installation:**
```bash
npm init -y
npm install @mastra/core telegram openai @supabase/supabase-js
npm install @pinecone-database/pinecone zod
npm install -D typescript @types/node ts-node nodemon
npm install -D eslint prettier @typescript-eslint/parser
```

**Deliverables:**
- ✅ Working TypeScript + Mastra.ai project
- ✅ All API keys configured
- ✅ Basic bot responds to /start

---

### Phase 1: Text Transaction Input (Week 1)
**Goal:** Users can log expenses via text messages

**Tasks:**
- [ ] Create transaction database schema (Supabase)
- [ ] Implement `extractTransactionTool` using GPT-4o
- [ ] Create `TransactionExtractorAgent` in Mastra
- [ ] Build transaction saving service with embeddings
- [ ] Implement Pinecone vector storage
- [ ] Create text message handler in Telegram bot
- [ ] Add transaction confirmation messages
- [ ] Implement inline edit/delete buttons
- [ ] Add error handling for unclear inputs
- [ ] Test with 20+ transaction examples

**Mastra.ai Components:**
- **Tool:** `extract-transaction` (NLU parsing)
- **Agent:** Transaction Extractor Agent
- **Integration:** Supabase for storage
- **Integration:** Pinecone for embeddings

**Example Transactions to Test:**
- "Spent $50 at Target"
- "Coffee was $6.50 this morning"
- "Paid 200 for car insurance yesterday"
- "Lunch 25 dollars"
- "Groceries: $150 at Whole Foods"

**Success Criteria:**
- ✅ 90%+ accuracy on common transaction phrases
- ✅ <3 second response time
- ✅ Proper handling of edge cases (missing date, unclear amount)
- ✅ Transaction saved with correct embedding in Pinecone

**Deliverable:**
Users can send text messages like "Spent $50 at Target" and bot extracts and saves the transaction.

---

### Phase 2: Voice & Image Support (Week 2)
**Goal:** Add multimodal input (voice notes and receipt photos)

**Tasks:**

**Voice Support:**
- [ ] Implement `transcribeVoiceTool` with Whisper API
- [ ] Add voice message handler in Telegram
- [ ] Download and process OGG/MP3 files
- [ ] Integrate transcription with transaction extraction
- [ ] Add loading states for voice processing
- [ ] Test with 10+ voice samples

**Image/Receipt Support:**
- [ ] Implement `extractReceiptTool` using GPT-4o Vision
- [ ] Add photo message handler in Telegram
- [ ] Download and process receipt images
- [ ] Parse multiple items from receipts (optional)
- [ ] Handle low-quality images gracefully
- [ ] Add confidence scoring for OCR results
- [ ] Test with 15+ receipt images

**Mastra.ai Components:**
- **Tool:** `transcribe-voice` (Whisper)
- **Tool:** `extract-receipt` (GPT-4o Vision)
- **Workflow:** Multi-input processing pipeline

**Success Criteria:**
- ✅ Voice transcription accuracy >95%
- ✅ Receipt OCR accuracy >85% for clear images
- ✅ Graceful degradation for poor quality inputs
- ✅ Feedback when OCR confidence is low

**Deliverable:**
Users can send voice notes or receipt photos and bot accurately extracts transaction details.

---

### Phase 3: RAG Query System (Week 3)
**Goal:** Users can ask natural language questions about their spending

**Tasks:**
- [ ] Implement `searchTransactionsTool` with Pinecone
- [ ] Create `FinanceInsightsAgent` in Mastra
- [ ] Build RAG pipeline (query → embedding → search → context → LLM)
- [ ] Add query message handler (detect questions vs transactions)
- [ ] Implement conversation memory in Mastra
- [ ] Add source citations in responses
- [ ] Build spending analysis functions
- [ ] Test with 30+ query examples
- [ ] Add multi-turn conversation support
- [ ] Implement query result caching

**Mastra.ai Components:**
- **Tool:** `search-transactions` (RAG)
- **Agent:** Finance Insights Agent (with memory)
- **Memory:** Conversation context management
- **RAG:** Pinecone semantic search

**Example Queries to Test:**
- "How much have I spent on food?"
- "What's my total spending this month?"
- "Show me my biggest expenses"
- "How much did I spend at Starbucks?"
- "Compare my spending this month vs last month"
- "Why is my spending up?"

**Success Criteria:**
- ✅ Relevant transaction retrieval (>90% accuracy)
- ✅ Natural language answers with insights
- ✅ Proper source attribution (cite transactions)
- ✅ Multi-turn conversation support
- ✅ <4 second response time

**Deliverable:**
Users can ask questions like "How much on groceries?" and get intelligent answers with citations.

---

### Phase 4: Budget Tracking & Alerts (Week 4)
**Goal:** Users can set budgets and receive proactive alerts

**Tasks:**

**Budget Management:**
- [ ] Create budget database schema
- [ ] Implement `/budget` command handler
- [ ] Create `checkBudgetTool` in Mastra
- [ ] Build budget setting interface
- [ ] Add budget viewing and editing
- [ ] Create budget status display with progress bars

**Budget Alerts:**
- [ ] Create `budgetAlertWorkflow` in Mastra
- [ ] Implement scheduled workflow (check budgets daily)
- [ ] Calculate spending percentage for each budget
- [ ] Send alerts at 75%, 100%, and when exceeded
- [ ] Add AI-generated spending insights in alerts
- [ ] Create spending pattern analysis
- [ ] Test workflow execution

**Mastra.ai Components:**
- **Tool:** `check-budget`
- **Workflow:** Budget Alert Workflow (scheduled, runs daily)
- **Agent:** Budget Advisor Agent (recommendations)

**Budget Alert Thresholds:**
- 75% - Warning message with encouragement
- 100% - Budget limit reached notification
- >100% - Overspending alert with suggestions

**Success Criteria:**
- ✅ Accurate budget tracking
- ✅ Timely alerts (within 1 minute of threshold)
- ✅ Useful spending insights
- ✅ Clear progress visualization
- ✅ Workflow runs reliably every day

**Deliverable:**
Users can set budgets, track progress, and receive automatic alerts when approaching limits.

---

### Phase 5: Insights & Summaries (Week 5)
**Goal:** Proactive insights and automated summaries

**Tasks:**

**Weekly Summary Workflow:**
- [ ] Create `weeklySummaryWorkflow` in Mastra
- [ ] Schedule to run Monday mornings
- [ ] Generate spending breakdown by category
- [ ] Calculate week-over-week changes
- [ ] Identify top merchants
- [ ] Create formatted summary message
- [ ] Test workflow with sample data

**Spending Insights:**
- [ ] Implement pattern detection (high spending days)
- [ ] Build anomaly detection
- [ ] Create spending predictions
- [ ] Add comparison insights (vs last month/week)
- [ ] Generate actionable recommendations
- [ ] Test with diverse spending patterns

**Commands:**
- [ ] Implement `/summary` - current month summary
- [ ] Implement `/recent` - last 10 transactions
- [ ] Implement `/help` - comprehensive help
- [ ] Add quick action buttons

**Mastra.ai Components:**
- **Workflow:** Weekly Summary Workflow (scheduled)
- **Workflow:** Monthly Report Workflow
- **Agent:** Insights Generator Agent
- **Tools:** Analytics and pattern detection

**Success Criteria:**
- ✅ Accurate summaries with breakdowns
- ✅ Useful pattern detection
- ✅ Actionable insights
- ✅ Workflows run reliably
- ✅ Engaging presentation

**Deliverable:**
Users receive weekly summaries and can generate on-demand reports with intelligent insights.

---

### Phase 6: Polish, Testing & Launch (Week 6)
**Goal:** Production-ready, tested, and launched

**Tasks:**

**Polish:**
- [ ] Improve error messages and user feedback
- [ ] Add loading states and progress indicators
- [ ] Enhance message formatting (emojis, structure)
- [ ] Optimize response times (<3s target)
- [ ] Add rate limiting and abuse prevention
- [ ] Implement proper logging with Mastra's tracing

**Testing:**
- [ ] Unit tests for all tools and services
- [ ] Integration tests for workflows
- [ ] End-to-end testing of user flows
- [ ] Load testing (simulate 100+ concurrent users)
- [ ] Beta testing with 10-20 real users
- [ ] Bug fixing and refinement

**Documentation:**
- [ ] User guide (commands, features, examples)
- [ ] Developer documentation
- [ ] API documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide

**Analytics & Monitoring:**
- [ ] Setup usage tracking (Supabase analytics)
- [ ] Implement error tracking (Sentry optional)
- [ ] Create Mastra observability dashboard
- [ ] Setup alerts for system health
- [ ] Track key metrics (DAU, transactions/user, retention)

**Deployment:**
- [ ] Choose deployment platform (Vercel/Railway/AWS)
- [ ] Setup production environment
- [ ] Configure environment variables
- [ ] Setup CI/CD pipeline
- [ ] Deploy to production
- [ ] Monitor initial hours closely

**Launch Preparation:**
- [ ] Prepare launch announcement
- [ ] Create demo video (60 seconds)
- [ ] Setup landing page (optional)
- [ ] Identify launch communities
- [ ] Prepare social media posts

**Success Criteria:**
- ✅ <5% error rate
- ✅ <3 second average response time
- ✅ All critical bugs fixed
- ✅ Positive beta user feedback
- ✅ Production deployment successful

**Deliverable:**
Production-ready bot, tested with beta users, deployed and ready for public launch.

---

## Technical Implementation Details

### Mastra.ai Configuration

**mastra.config.ts:**
```typescript
import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

export const mastra = new Mastra({
  name: 'hilm-ai',
  
  // Agents
  agents: {
    transactionExtractor: './src/mastra/agents/transaction-extractor',
    financeInsights: './src/mastra/agents/finance-insights',
    budgetAdvisor: './src/mastra/agents/budget-advisor',
  },
  
  // Workflows
  workflows: {
    processTransaction: './src/mastra/workflows/process-transaction',
    budgetAlert: './src/mastra/workflows/budget-alert',
    weeklySummary: './src/mastra/workflows/weekly-summary',
  },
  
  // Tools
  tools: {
    extractTransaction: './src/mastra/tools/extract-transaction',
    extractReceipt: './src/mastra/tools/extract-receipt',
    transcribeVoice: './src/mastra/tools/transcribe-voice',
    searchTransactions: './src/mastra/tools/search-transactions',
    checkBudget: './src/mastra/tools/check-budget',
  },
  
  // RAG Configuration
  rag: {
    vectorStore: {
      provider: 'pinecone',
      config: {
        apiKey: process.env.PINECONE_API_KEY,
        index: 'hilm-transactions',
        environment: process.env.PINECONE_ENVIRONMENT,
      },
    },
    embeddings: {
      provider: 'openai',
      model: 'text-embedding-3-large',
    },
  },
  
  // Memory Configuration
  memory: {
    provider: 'supabase',
    config: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_KEY,
    },
  },
  
  // Logging & Observability
  logger: createLogger({
    level: 'info',
    serviceName: 'hilm-ai',
  }),
  
  // Model Configuration
  models: {
    default: {
      provider: 'openai',
      name: 'gpt-4o',
    },
  },
});
```

---

### Database Schema (Supabase)

**schema.sql:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  category VARCHAR(50) NOT NULL,
  merchant VARCHAR(255),
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category);

-- Budgets table
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  limit_amount DECIMAL(10, 2) NOT NULL,
  period VARCHAR(20) DEFAULT 'monthly', -- daily, weekly, monthly
  current_spent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, period)
);

-- Conversation memory table (for Mastra)
CREATE TABLE conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
```

---

### Environment Variables

**.env.example:**
```bash
# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX=hilm-transactions

# App Config
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Optional: Analytics
SENTRY_DSN=your_sentry_dsn
```

---

## Feature Breakdown by Version

### Version 1.0 - MVP (6 Weeks)
**Goal:** Validate core value proposition with early users

**Features:**
✅ Text transaction logging with NLU
✅ Voice note support (Whisper)
✅ Receipt photo scanning (GPT-4o Vision)
✅ Natural language queries with RAG
✅ Category-based budgets with alerts
✅ Transaction management (view, edit, delete)
✅ Conversation memory
✅ Basic insights and summaries

**Commands:**
- `/start` - Onboarding
- `/help` - Show capabilities
- `/budget [category] [amount]` - Set budget
- `/summary` - Monthly summary
- `/recent` - Recent transactions

**Success Metrics:**
- 100+ active users within first month
- 70%+ retention after 7 days
- 80%+ successful transaction captures
- <3 second average response time
- 50+ interactions per user per month

---

### Version 1.5 - Enhanced Intelligence (8 weeks)
**Goal:** Improve AI insights based on user feedback

**New Features:**
- Weekly spending summaries (automated)
- Spending pattern detection
- Anomaly alerts (unusual charges)
- Month-over-month trends
- Spending predictions
- Multi-category queries
- Date range flexibility
- Merchant-specific analysis
- Smart merchant normalization
- Subcategory support
- Split transactions
- Recurring transaction detection
- Inline keyboards for quick actions
- Custom categories
- Multi-currency support
- Language selection (English, Spanish)

---

### Version 2.0 - Advanced Features (12 weeks)
**Goal:** Complete feature parity with competitors

**New Features:**
- PDF bank statement upload
- Bulk transaction extraction
- Multi-page statement handling
- Duplicate detection
- Spending heatmaps
- Subscription detection
- Savings opportunities
- Cash flow forecasting
- Financial goals
- Debt payoff planning
- Export to CSV/Excel
- Import from other apps
- Shared budgets (couples/families)
- Group expense management
- Advanced analytics dashboard

---

## Key User Flows

### Flow 1: First Transaction

```
User: /start
Bot: "👋 Welcome! Try: 'Spent $50 at Target'"

User: "Spent $50 at Target"
Bot: "✅ 🛍️ Shopping · $50.00 · Today
      📍 Target
      
      Added to your spending
      
      Want to set a shopping budget? Try:
      /budget Shopping 400"

User: /budget Shopping 400
Bot: "🎯 Budget set: Shopping = $400/month
      
      Current: $50 (12% used)
      Remaining: $350
      Daily budget: $12.61
      
      You're on track! 👍"
```

### Flow 2: Spending Query

```
User: "How much have I spent on food this month?"
Bot: "🍔 Food & Dining - October 2025
      
      Total: $487.32 (18 transactions)
      
      Breakdown:
      • Groceries: $312.50 (8 trips)
      • Dining Out: $174.82 (10 meals)
      
      Top Merchants:
      1. Whole Foods: $156.20
      2. Chipotle: $67.50
      3. Starbucks: $45.30
      
      💡 Insight: You dine out 2.5x per week. 
      Meal prep Sundays could save ~$120/month."
```

### Flow 3: Budget Alert

```
[Automatic message at 8 PM]

Bot: "⚠️ Budget Alert: Dining

      You've used 78% of your $300 budget
      Spent: $234.50
      Remaining: $65.50 (6 days left)
      
      📊 Pattern I noticed:
      You order delivery Tuesday/Thursday nights 
      (your late work days). Each costs ~$35.
      
      💡 Tip: Prep freezer meals on Sunday for 
      those nights. Could save $140/month!
      
      Still hungry? Keep it under $11/day 🎯"
```

---

## Development Best Practices

### 1. Code Organization
- Keep Mastra agents, tools, and workflows in separate files
- Use TypeScript interfaces for all data types
- Implement repository pattern for database access
- Use dependency injection where appropriate
- Write small, focused functions

### 2. Error Handling
- Wrap all external API calls in try-catch
- Provide helpful error messages to users
- Log errors with Mastra's built-in tracing
- Implement retry logic for transient failures
- Gracefully degrade when services are unavailable

### 3. Testing Strategy
- Unit tests for all tools and services
- Integration tests for workflows
- E2E tests for critical user flows
- Use test data for consistent results
- Mock external APIs in tests

### 4. Performance Optimization
- Cache frequent queries
- Batch database operations
- Use Pinecone metadata filtering
- Optimize embedding generation
- Implement request debouncing
- Use Mastra's streaming for long operations

### 5. Security
- Validate all user inputs
- Sanitize data before database queries
- Use environment variables for secrets
- Implement rate limiting
- Enable Supabase RLS
- Regular security audits

---

## Deployment Strategy

### Development Workflow
```bash
# Local development
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Deploy
npm run deploy
```

### Recommended Hosting
1. **Vercel** (Easiest, free tier)
   - Serverless functions
   - Easy deployment from GitHub
   - Built-in monitoring

2. **Railway** (Simple, affordable)
   - Always-on container
   - PostgreSQL included
   - $5/month starter

3. **AWS Lambda** (Scalable)
   - Pay per use
   - Integrates with AWS services
   - More complex setup

### CI/CD Pipeline
- GitHub Actions for automated testing
- Deploy on merge to main branch
- Staging environment for testing
- Automatic rollback on errors

---

## Success Metrics & Analytics

### User Metrics
- **Daily Active Users (DAU)**
- **Weekly Active Users (WAU)**
- **7-day retention rate**
- **30-day retention rate**
- **Average transactions per user**
- **Average queries per user**

### Technical Metrics
- **Average response time**
- **Error rate**
- **Transaction extraction accuracy