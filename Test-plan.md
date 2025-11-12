# 🧪 HilmAI Agent - Production Test Plan

**Version:** 2.0 Beta  
**Last Updated:** November 11, 2025  
**Status:** Pre-Launch Testing

---

## Test Categories Overview

1. **Functional Tests** - Core features work correctly
2. **Integration Tests** - External services communicate properly
3. **Performance Tests** - System handles load and responds quickly
4. **Security & Privacy Tests** - User data is protected
5. **Error Handling & Recovery** - Graceful degradation
6. **User Experience Tests** - Real-world usage scenarios
7. **Subscription & Billing Tests** - Payment flows work correctly
8. **Data Integrity Tests** - Database operations are reliable
9. **Deployment & Infrastructure Tests** - Production environment is stable

---

## 1. FUNCTIONAL TESTS

### 1.1 Command Tests

#### Basic Commands
- [ ] `/start` - Creates new user, displays welcome message
- [ ] `/start` (existing user) - Shows returning user message
- [ ] `/help` - Displays all available commands and instructions
- [ ] `/menu` - Shows main menu with inline keyboard

#### Mode Management
- [ ] `/mode` - Displays current mode and mode options
- [ ] `/mode_logger` - Switches to logger mode
- [ ] `/mode_chat` - Switches to chat mode
- [ ] `/mode_query` - Switches to query mode
- [ ] Mode persistence - Selected mode persists across sessions

#### User Settings
- [ ] `/currency` - Shows current default currency
- [ ] `/currency USD` - Changes default currency to USD
- [ ] `/currency EUR` - Changes to EUR
- [ ] `/currency GBP` - Changes to GBP
- [ ] `/currency XYZ` - Handles invalid currency gracefully
- [ ] `/timezone` - Shows current timezone
- [ ] `/timezone America/New_York` - Changes timezone successfully
- [ ] `/timezone Europe/London` - Changes timezone successfully
- [ ] `/timezone invalid` - Handles invalid timezone with helpful error

#### Data Access Commands
- [ ] `/recent` - Shows recent 10 transactions with formatting
- [ ] `/recent` (no transactions) - Shows appropriate "no data" message
- [ ] `/subscribe` - Shows subscription plans with pricing
- [ ] `/billing` - Shows subscription status (active user)
- [ ] `/billing` - Shows trial status (trial user)
- [ ] `/billing` - Shows upgrade prompt (expired trial)
- [ ] `/clear` - Clears response cache, shows confirmation

### 1.2 Text Message Processing

#### Logger Mode Tests
- [ ] "Spent $45 at Trader Joe's" - Extracts amount, merchant, saves transaction
- [ ] "Paid 200 AED for groceries at Carrefour" - Multi-currency handling
- [ ] "Coffee 5.50" - Handles minimal input with defaults
- [ ] "Taxi home 15 dollars yesterday" - Handles relative dates correctly
- [ ] "Lunch 25 on Monday" - Handles day names
- [ ] "Movie tickets 60 on 2025-11-05" - Handles explicit dates
- [ ] "Split dinner $80 with friends" - Handles natural language
- [ ] "Gas station $40" - Simple transaction
- [ ] "Breakfast 12.50 at Starbucks this morning" - Time references
- [ ] "Dinner last night 75" - Past time references
- [ ] Multiple transactions in one message - Extracts all or asks for clarification
- [ ] Non-transaction text in logger mode - Politely prompts for transaction format
- [ ] Transaction with emoji - "☕ Coffee $5" - Handles correctly
- [ ] Transaction with notes - "Lunch $20 (with John)" - Preserves description

#### Query Mode Tests
- [ ] "How much did I spend on groceries this month?" - Returns accurate total
- [ ] "Show me all Starbucks transactions" - Hybrid search finds results
- [ ] "What did I buy yesterday?" - Date filtering works correctly
- [ ] "Total spending last week" - Date range calculation accurate
- [ ] "Most expensive transaction" - Sorting works, shows highest amount
- [ ] "Show transactions over $100" - Amount filtering accurate
- [ ] "Coffee shops in November" - Category + date filtering combined
- [ ] "Where did I spend most money?" - Aggregation by merchant
- [ ] "List all transactions in USD" - Currency filtering
- [ ] "Groceries this year" - Long date range query
- [ ] "Average daily spending" - Calculation query
- [ ] "Show me restaurants" - Semantic category search
- [ ] Query with no results - Appropriate "no matches" message
- [ ] Follow-up question - "What about last month?" - Memory maintains context
- [ ] Refinement query - "Only over $50" - Context from previous query
- [ ] Ambiguous query - "Show spending" - Asks for clarification

#### Chat Mode Tests
- [ ] "Hello!" - Friendly greeting response
- [ ] "Hi there" - Alternative greeting
- [ ] "What can you do?" - Explains capabilities clearly
- [ ] "How do I add a transaction?" - Provides step-by-step help
- [ ] "Tell me a joke" - Stays on-brand but helpful redirect
- [ ] "What's my balance?" - Helpful redirect to query mode
- [ ] "Thank you" - Polite acknowledgment
- [ ] Conversational follow-up 1 - Maintains context
- [ ] Conversational follow-up 2 - Maintains context
- [ ] Conversational follow-up 3 - Maintains context (3 message limit)

### 1.3 Voice Message Processing

#### Voice Transcription Tests
- [ ] Clear voice message - Transcribes accurately
- [ ] Voice with transaction - "I spent 45 dollars at Target" - Extracts and saves
- [ ] Voice with query - "How much did I spend yesterday?" - Responds correctly
- [ ] Voice with multiple sentences - Handles complete message
- [ ] Voice with background noise - Handles gracefully or asks to retry
- [ ] Voice with accent - Processes correctly
- [ ] Non-English voice (if supported) - Appropriate handling
- [ ] Very short voice message (<2 seconds) - Processes correctly
- [ ] Long voice message (>1 min) - Handles or provides length limit message
- [ ] Voice file cleanup - Temporary .oga files deleted after processing
- [ ] Voice transcription error - Provides helpful error message

### 1.4 Photo Message Processing

#### Receipt OCR Tests
- [ ] Clear receipt photo - OCR extracts text accurately
- [ ] Receipt with transaction - Saves amount, merchant, date correctly
- [ ] Supermarket receipt - Handles multiple line items appropriately
- [ ] Restaurant receipt with tip - Extracts total correctly
- [ ] Tilted/angled receipt - Still processes successfully
- [ ] Low quality photo - Handles gracefully or asks for better photo
- [ ] Receipt in different language - Handles if supported
- [ ] Non-receipt image (selfie, landscape) - Appropriate error message
- [ ] Photo without text - Provides helpful error
- [ ] Blurry receipt - Asks for clearer image
- [ ] Dark/shadowed receipt - Processes or asks for better lighting
- [ ] Photo file cleanup - Temporary .jpg/.png files deleted after processing
- [ ] Very large photo file - Handles or provides size limit message

### 1.5 Callback Query Tests

#### Menu Navigation
- [ ] Main menu button "📊 View Stats" - Shows statistics
- [ ] Main menu button "➕ Add Transaction" - Guides transaction entry
- [ ] Main menu button "🔍 Search" - Switches to query mode
- [ ] Main menu button "⚙️ Settings" - Shows settings options
- [ ] Back button in submenus - Returns to previous menu

#### Mode Selection
- [ ] Mode selection via inline button - Logger mode - Switches and confirms
- [ ] Mode selection via inline button - Query mode - Switches and confirms
- [ ] Mode selection via inline button - Chat mode - Switches and confirms

#### Transaction Management
- [ ] Transaction edit button - Shows edit interface with current values
- [ ] Edit amount - Updates correctly
- [ ] Edit merchant - Updates correctly
- [ ] Edit category - Shows category options
- [ ] Edit date - Allows date change
- [ ] Transaction delete button - Shows confirmation dialog
- [ ] Delete confirmation "Yes" - Deletes and confirms
- [ ] Delete confirmation "No" - Cancels operation
- [ ] Transaction details button - Shows full transaction info

#### Subscription
- [ ] Subscription plan selection - Monthly - Shows Stripe checkout URL
- [ ] Subscription plan selection - Annual - Shows correct pricing
- [ ] "Manage Billing" button - Links to Stripe portal (if implemented)

---

## 2. INTEGRATION TESTS

### 2.1 Supabase Database Integration

#### User Operations
- [ ] User creation on `/start` - Record inserted with correct fields
- [ ] User profile update - Changes saved and persisted
- [ ] User timezone update - Saved correctly
- [ ] User currency update - Saved and applied to future transactions
- [ ] User mode update - Persisted across sessions
- [ ] Duplicate user handling - Doesn't create duplicate records

#### Transaction Operations
- [ ] Transaction insert - All fields saved correctly (amount, currency, merchant, category, date)
- [ ] Transaction with original currency - Conversion fields populated
- [ ] Transaction update via edit - Changes reflected immediately
- [ ] Transaction delete - Record removed or soft-deleted
- [ ] Transaction query by user_id - Returns only user's transactions
- [ ] Transaction query by date range - Filtering works correctly
- [ ] Transaction query by category - Filtering accurate
- [ ] Transaction query by merchant - Returns matches

#### Vector Embeddings
- [ ] Merchant embedding generation - Creates 1536-dim vector
- [ ] Embedding storage - Saved to merchant_embedding column
- [ ] Embedding cache lookup - Finds existing merchant embeddings
- [ ] Embedding cache insert - New merchants cached
- [ ] Embedding cache update - Usage count incremented

#### RLS (Row Level Security)
- [ ] User A cannot see User B's transactions - RLS enforced
- [ ] User can see own transactions - RLS allows access
- [ ] Service role bypasses RLS - Bot can access all data
- [ ] Unauthenticated access blocked - Returns empty results

#### Connection & Error Handling
- [ ] Database connection pool - Multiple concurrent requests handled
- [ ] Connection failure - Graceful error handling, retry logic
- [ ] Query timeout - Doesn't crash bot, returns error message
- [ ] Transaction rollback - Atomic operations maintained
- [ ] Constraint violation - User-friendly error message

### 2.2 OpenAI API Integration

#### Text Completion (GPT-4o)
- [ ] Agent generation - Returns coherent response
- [ ] Transaction extraction - Accurately parses natural language
- [ ] Query processing - Understands and responds correctly
- [ ] Context handling - Maintains conversation context
- [ ] Response formatting - Markdown/plain text appropriate
- [ ] Token usage - Logged for monitoring

#### Vision API (GPT-4o-vision)
- [ ] Receipt OCR - Extracts text from image
- [ ] Image quality handling - Works with various photo qualities
- [ ] Image format support - JPEG and PNG both work
- [ ] Base64 encoding - Correctly encodes image data
- [ ] Vision API timeout - Handles gracefully
- [ ] Vision API error - Provides helpful message

#### Whisper (Transcription)
- [ ] Audio transcription - Converts speech to text accurately
- [ ] Audio format support - .oga format works
- [ ] Audio file streaming - File stream reads correctly
- [ ] Transcription quality - High accuracy with clear audio
- [ ] Transcription timeout - Handles long audio appropriately
- [ ] Language detection - Handles if supported

#### Embeddings API (text-embedding-3-small)
- [ ] Embedding generation - Returns 1536-dimensional vector
- [ ] Batch embedding - Multiple texts processed efficiently
- [ ] Embedding consistency - Same text produces same embedding
- [ ] Embedding normalization - Vector magnitudes appropriate

#### Error Handling
- [ ] Rate limiting (429) - Exponential backoff retry
- [ ] API timeout - Retries with backoff
- [ ] Invalid API key - Clear error logged, doesn't expose key
- [ ] Service unavailable (500) - Graceful degradation
- [ ] Token limit exceeded - Truncates or splits request
- [ ] Content policy violation - Handles refusal gracefully

### 2.3 Stripe Integration

#### Checkout & Payments
- [ ] Checkout session creation - Returns valid Stripe URL
- [ ] Monthly plan checkout - Correct price ($10/month)
- [ ] Annual plan checkout - Correct price ($100/year)
- [ ] Checkout completion - User redirected correctly
- [ ] Payment success - Subscription activated immediately
- [ ] Payment failure - User notified with retry option
- [ ] 3D Secure authentication - SCA flow works
- [ ] Multiple payment methods - Card, bank transfer (if enabled)

#### Webhook Processing
- [ ] `checkout.session.completed` - Subscription activated in database
- [ ] `customer.subscription.created` - User record updated
- [ ] `customer.subscription.updated` - Status changes reflected
- [ ] `customer.subscription.deleted` - Cancellation processed
- [ ] `invoice.payment_succeeded` - Billing period extended
- [ ] `invoice.payment_failed` - Status updated to past_due
- [ ] `customer.updated` - Customer info synced
- [ ] Duplicate webhook - Idempotent processing (same webhook ID)
- [ ] Invalid signature - Rejected with 401
- [ ] Webhook retry - Handles Stripe retries correctly

#### Subscription Management
- [ ] Active subscription check - User has full access
- [ ] Trial period check - Trial days calculated correctly
- [ ] Expired trial - Access restricted appropriately
- [ ] Past due subscription - Grace period or restriction
- [ ] Canceled subscription - Access until period end
- [ ] Subscription reactivation - Can resubscribe after cancellation

#### Customer Portal (if implemented)
- [ ] Portal session creation - Returns valid URL
- [ ] User can update payment method - Changes reflected
- [ ] User can cancel subscription - Processed correctly
- [ ] User can view invoices - History accessible

### 2.4 Telegram Bot API Integration

#### Message Sending
- [ ] Text message delivery - Reaches user successfully
- [ ] Inline keyboard rendering - Buttons display correctly
- [ ] Message formatting - Markdown renders properly
- [ ] Bold/italic text - Formatting works
- [ ] Code blocks - Monospace formatting works
- [ ] Links - Clickable and correct
- [ ] Long messages (>4096 chars) - Splits into multiple messages
- [ ] Unicode/emoji - Displays correctly
- [ ] Message editing - Updates existing message
- [ ] Message deletion - Removes message (if used)

#### File Operations
- [ ] Voice file download - Bot downloads .oga file
- [ ] Photo file download - Bot downloads image
- [ ] File download timeout - Handles gracefully
- [ ] Large file handling - Size limits respected
- [ ] File download error - Provides helpful message

#### Bot Commands
- [ ] Command menu - Shows in Telegram command list
- [ ] Command descriptions - Display correctly
- [ ] Command execution - Triggers correct handler
- [ ] Unknown command - Provides helpful response

#### Error Handling
- [ ] Network timeout - Retries appropriately
- [ ] Telegram API error - Logs and handles gracefully
- [ ] Bot blocked by user - Handles error without crashing
- [ ] Invalid chat ID - Error handled gracefully
- [ ] Rate limiting - Respects Telegram flood limits

### 2.5 Mastra Framework Integration

#### Workflow Execution
- [ ] Message processing workflow - Completes successfully
- [ ] Workflow step execution - All steps run in order
- [ ] Workflow branching - Correct branch taken based on input type
- [ ] Workflow error handling - Failures logged and handled
- [ ] Workflow output - Returns expected result

#### Agent Invocation
- [ ] Transaction logger agent - Returns response
- [ ] Query executor agent - Returns response
- [ ] Conversation agent - Returns response
- [ ] Agent tool usage - Tools called correctly
- [ ] Agent memory - Context maintained (3 messages)

#### Tool Execution
- [ ] Save transaction tool - Inserts record correctly
- [ ] Hybrid query tool - Returns search results
- [ ] Edit transaction tool - Updates record
- [ ] Delete transaction tool - Removes record
- [ ] Tool error handling - Failures managed gracefully

#### Memory System
- [ ] Memory persistence - Messages stored in database
- [ ] Memory retrieval - Context loaded correctly
- [ ] Memory limits - Only last 3 messages loaded (query/chat modes)
- [ ] Logger mode - No memory used (by design)
- [ ] Memory cleanup - Old messages managed appropriately

#### Logging & Observability
- [ ] Pino logger - Structured logs output
- [ ] Log levels - Info, warn, error appropriate
- [ ] Log context - User ID, operation included
- [ ] Performance logging - Duration tracked
- [ ] Mastra playground - Accessible on port 4111 (dev mode)

---

## 3. PERFORMANCE TESTS

### 3.1 Response Time Benchmarks

#### Text Processing
- [ ] Simple text transaction (logger mode) - **< 3 seconds**
- [ ] Complex natural language transaction - **< 4 seconds**
- [ ] Text query without embeddings - **< 2 seconds**
- [ ] Text query with hybrid search - **< 5 seconds**
- [ ] Chat mode simple question - **< 2 seconds**

#### Voice Processing
- [ ] Short voice message (5 sec) - **< 10 seconds** total
- [ ] Medium voice message (30 sec) - **< 15 seconds** total
- [ ] Long voice message (60 sec) - **< 25 seconds** total
- [ ] Voice transcription only (no processing) - **< 8 seconds**

#### Photo Processing
- [ ] Clear receipt photo (1MB) - **< 15 seconds** total
- [ ] Large photo (5MB) - **< 20 seconds** total
- [ ] OCR extraction only (no processing) - **< 10 seconds**

#### Cache Performance
- [ ] Cache hit response - **< 500ms** (40x faster)
- [ ] Cache miss response - Normal processing time
- [ ] Cache write operation - **< 100ms**

#### Database Queries
- [ ] Simple transaction lookup - **< 200ms**
- [ ] Recent transactions query - **< 300ms**
- [ ] Complex query with filters - **< 1 second**
- [ ] Hybrid search (vector + SQL) - **< 3 seconds**
- [ ] Aggregation query (monthly totals) - **< 2 seconds**

### 3.2 Concurrent Users

#### Load Testing
- [ ] 10 simultaneous users - All requests processed successfully
- [ ] 25 simultaneous users - Response times acceptable
- [ ] 50 simultaneous users - No degradation
- [ ] 100 simultaneous users - Acceptable performance maintained
- [ ] Burst traffic (50 requests in 10 sec) - System handles gracefully

#### Resource Usage Under Load
- [ ] Memory usage - Stays under 512MB
- [ ] CPU usage - Doesn't spike above 80%
- [ ] Database connections - Pool not exhausted
- [ ] API rate limits - Not exceeded

### 3.3 Database Performance

#### Query Performance
- [ ] User with 100 transactions - Queries remain fast (<500ms)
- [ ] User with 1,000 transactions - Performance acceptable (<1s)
- [ ] User with 10,000 transactions - Vector search still performant (<3s)
- [ ] 100 concurrent queries - Database handles load

#### Vector Search Performance
- [ ] Similarity search - **< 2 seconds** with 10,000 vectors
- [ ] IVFFlat index usage - Query plan confirms index used
- [ ] Cache efficiency - 80-90% of merchant lookups hit cache
- [ ] Embedding generation batching - Multiple merchants processed efficiently

#### Write Performance
- [ ] Transaction insert - **< 200ms**
- [ ] Transaction update - **< 200ms**
- [ ] Concurrent writes - No deadlocks or race conditions
- [ ] Bulk insert (if used) - Efficient processing

### 3.4 Caching Effectiveness

#### Response Cache (LibSQL)
- [ ] Cache hit rate - **> 30%** for repeated queries
- [ ] Cache lookup speed - **< 100ms**
- [ ] Cache storage efficiency - No memory bloat
- [ ] Cache invalidation - Works correctly on data changes

#### Merchant Embeddings Cache
- [ ] Embedding cache hit rate - **> 80%** for common merchants
- [ ] Cache lookup - **< 50ms**
- [ ] Cache usage count - Increments correctly
- [ ] Cache benefits - Reduces OpenAI API calls significantly

#### Memory Usage
- [ ] Cache size growth - Bounded and predictable
- [ ] Memory leaks - None detected after extended use
- [ ] Cache eviction - Old entries removed (if LRU implemented)

### 3.5 Memory & Resource Usage

#### Long-Running Stability
- [ ] 1-hour uptime - No memory leaks
- [ ] 24-hour uptime - Memory stable
- [ ] 7-day uptime - No degradation
- [ ] Process restart recovery - Clean shutdown and startup

#### File Management
- [ ] Temporary voice files - Deleted after processing
- [ ] Temporary photo files - Deleted after processing
- [ ] Disk space usage - Doesn't grow unbounded
- [ ] File descriptor limits - No leaks

#### Connection Pooling
- [ ] Database connections - Properly pooled and reused
- [ ] HTTP connections - Keep-alive works
- [ ] Connection limits - Not exceeded
- [ ] Connection cleanup - Closed on errors

---

## 4. SECURITY & PRIVACY TESTS

### 4.1 User Data Protection

#### Row Level Security (RLS)
- [ ] User A queries - Cannot see User B's transactions
- [ ] User B queries - Cannot see User A's transactions
- [ ] Direct SQL injection attempt - RLS blocks access
- [ ] Service role operations - Can access all data (as designed)
- [ ] Anonymous access - Blocked completely

#### Data Isolation
- [ ] User ID validation - All operations check user_id
- [ ] Transaction ownership - Verified before edit/delete
- [ ] Query filtering - Always includes user_id filter
- [ ] Merchant cache - Shared data doesn't leak user info

#### Sensitive Data Handling
- [ ] Transaction descriptions - Stored securely
- [ ] User email - Not exposed in logs
- [ ] Personal info - PII protected
- [ ] Financial data - Amounts/currencies secure

### 4.2 API Security

#### Authentication & Authorization
- [ ] Telegram bot token - Validated on webhook
- [ ] Telegram webhook signature - Verified (if using webhooks)
- [ ] Stripe webhook signature - Validated
- [ ] Service role key - Not exposed in client code
- [ ] API keys - Loaded from environment only

#### Secrets Management
- [ ] Environment variables - Not logged
- [ ] API keys - Not sent to users in error messages
- [ ] Database credentials - Secure storage
- [ ] Stripe keys - Test/live properly separated
- [ ] OpenAI key - Not exposed in responses

#### Transport Security
- [ ] HTTPS enforcement - All external API calls use HTTPS
- [ ] Webhook endpoints - HTTPS only
- [ ] No sensitive data in URLs - POST body or headers only

### 4.3 Input Validation & Sanitization

#### SQL Injection Prevention
- [ ] User input in queries - Parameterized queries used
- [ ] Merchant names with quotes - Handled safely
- [ ] Special SQL characters - Escaped properly
- [ ] UNION injection attempt - Blocked

#### XSS Prevention
- [ ] Merchant name with HTML - Sanitized before display
- [ ] Description with script tags - Sanitized
- [ ] Telegram message formatting - Escaped appropriately

#### Command Injection
- [ ] File paths - Validated and sanitized
- [ ] Shell command arguments - Not constructed from user input
- [ ] Path traversal attempt - Blocked

#### Input Size Limits
- [ ] Large text message - Truncated or rejected gracefully
- [ ] Large voice file - Size limit enforced
- [ ] Large photo file - Size limit enforced
- [ ] Extremely long merchant name - Truncated safely

### 4.4 Authentication & Access Control

#### Telegram User Verification
- [ ] Bot token validation - Ensures legitimate requests
- [ ] User ID authenticity - Verified via Telegram
- [ ] User impersonation - Not possible
- [ ] Bot API calls - Authenticated correctly

#### Session Management
- [ ] No session tokens needed - Telegram handles auth
- [ ] User context - Properly isolated per request
- [ ] Concurrent requests - No state leakage between users

---

## 5. ERROR HANDLING & RECOVERY TESTS

### 5.1 Network Failures

#### External Service Timeouts
- [ ] OpenAI timeout - User gets "Processing delay, please retry" message
- [ ] Supabase connection timeout - Retry with exponential backoff
- [ ] Stripe API timeout - Graceful error, user can retry
- [ ] Telegram API timeout - Message queued or retry
- [ ] Complete network loss - Bot recovers when network restored

#### Retry Logic
- [ ] Transient failure - Automatic retry succeeds
- [ ] Persistent failure - Eventually returns error to user
- [ ] Retry backoff - Exponential delays implemented
- [ ] Max retry limit - Doesn't retry infinitely

### 5.2 Invalid Input Handling

#### Malformed Input
- [ ] Malformed transaction - "I spent apples" - Asks for clarification
- [ ] Ambiguous transaction - "Spent 20" - Asks for merchant
- [ ] Invalid date - "Yesterday in 2030" - Asks for correct date
- [ ] Invalid currency - "100 XYZ" - Asks for valid currency

#### Unsupported Content
- [ ] Unsupported file type - Sticker, GIF, video - Polite error message
- [ ] Empty message - No text, no media - Prompt for input
- [ ] Only whitespace - Treated as empty message
- [ ] Binary data - Rejected gracefully

#### Unicode & Special Characters
- [ ] Emoji in transaction - Processed correctly
- [ ] Non-Latin characters - Arabic, Chinese, etc. - Handled
- [ ] Special symbols - $, €, £, ¥ - Recognized
- [ ] Zero-width characters - Sanitized

### 5.3 Database Errors

#### Constraint Violations
- [ ] Unique constraint violation - User-friendly message
- [ ] Foreign key violation - Appropriate error
- [ ] NOT NULL violation - Validation prevents
- [ ] Check constraint violation - Validation prevents

#### Transaction Failures
- [ ] Transaction rollback - Atomic operation maintained
- [ ] Deadlock detection - Retries transaction
- [ ] Concurrent update conflict - Handled gracefully

#### Connection Errors
- [ ] Connection pool exhausted - Waits or queues request
- [ ] Connection dropped mid-query - Retries
- [ ] Database unavailable - Clear error message to user

### 5.4 Agent & Workflow Failures

#### Tool Execution Errors
- [ ] Save transaction tool fails - User notified, can retry
- [ ] Query tool fails - Fallback to simpler query or error message
- [ ] Edit tool fails - Transaction remains unchanged, error shown
- [ ] Delete tool fails - Transaction preserved, error shown

#### Workflow Step Failures
- [ ] Transcription step fails - Asks user to send text instead
- [ ] OCR step fails - Asks user to manually type receipt info
- [ ] Agent invocation fails - Graceful error message
- [ ] Branch condition error - Default branch or error handling

#### LLM Failures
- [ ] LLM refusal - "I can't do that" - Alternative response provided
- [ ] Token limit exceeded - Truncates context or splits request
- [ ] Rate limit hit - Exponential backoff retry
- [ ] Model timeout - Retry or simplified request

### 5.5 Rate Limiting & Abuse Prevention

#### OpenAI Rate Limits
- [ ] 429 Too Many Requests - Exponential backoff, eventually succeeds
- [ ] Token per minute limit - Requests queued
- [ ] Concurrent request limit - Managed appropriately

#### User Rate Limiting (if implemented)
- [ ] Spam detection - Too many requests per minute - Cooldown message
- [ ] Burst protection - Max 10 requests in 10 seconds - Throttled
- [ ] User notification - "Please slow down" message

#### Telegram Flood Control
- [ ] Bot respects Telegram limits - Max 30 messages per second
- [ ] Per-chat limits - Max 1 message per second per chat
- [ ] Group chat limits - Appropriate throttling

---

## 6. USER EXPERIENCE TESTS

### 6.1 First-Time User Journey

#### Onboarding
- [ ] User starts bot - Receives welcome message explaining purpose
- [ ] First message explains modes - Logger, query, chat clearly described
- [ ] Tutorial offered - User can learn with examples
- [ ] Default settings - Sensible defaults (chat mode, UTC, AED)
- [ ] First transaction - Extra confirmation or guidance

#### Initial Setup
- [ ] Set currency prompt - Asks user for default currency
- [ ] Set timezone prompt - Asks user for timezone
- [ ] Quick start guide - Shows how to log first transaction
- [ ] Help availability - Clear how to get help

### 6.2 Daily Usage Scenarios

#### Morning Routine
- [ ] Log coffee purchase - "Coffee $5" - Quick and effortless
- [ ] Voice transaction while commuting - "Paid 10 dollars for parking" - Works
- [ ] Receipt photo while at store - Snaps and sends receipt - Processed

#### Midday Transactions
- [ ] Lunch transaction - "Lunch 20 at Chipotle" - Logged quickly
- [ ] Multiple purchases - Logs each transaction separately
- [ ] Quick query - "How much today?" - Fast response

#### Evening Review
- [ ] Daily spending check - "What did I spend today?" - Comprehensive list
- [ ] Weekly review - "Show last week" - Formatted results
- [ ] Monthly budgeting - "Total this month?" - Accurate sum

#### Weekend Activities
- [ ] Multiple entertainment expenses - Movies, dining, shopping - All logged
- [ ] Different categories - System categorizes correctly
- [ ] Receipt photos from restaurants - OCR works in various lighting

### 6.3 Edge Cases

#### Date & Time Edge Cases
- [ ] Very old transaction - "Spent $50 on 2020-01-01" - Accepts or warns
- [ ] Future date transaction - "Spending $100 tomorrow" - Warns or corrects
- [ ] Transaction at midnight - Timezone boundary handled correctly
- [ ] "Yesterday" at 00:01 - Calculates correct date
- [ ] Timezone change affecting date - Historical dates preserved correctly

#### Amount Edge Cases
- [ ] Negative amount - Refund or credit - Handled appropriately
- [ ] Zero amount - "Free coffee" - Rejected or asks for confirmation
- [ ] Extremely large amount - "$1,000,000" - Accepts or asks confirmation
- [ ] Very small amount - "$0.01" - Processes correctly
- [ ] Fractional currency - "$5.999" - Rounds appropriately

#### Merchant & Description Edge Cases
- [ ] Special characters in merchant - "O'Reilly's Pub" - Saved correctly
- [ ] Very long merchant name - Truncates or saves fully
- [ ] Emoji in merchant - "☕ Coffee Shop" - Processes
- [ ] Numbers in merchant - "7-Eleven" - Saved correctly
- [ ] Merchant with punctuation - "Ben & Jerry's" - Handled

#### Currency Edge Cases
- [ ] Transaction in different currency - "100 EUR" - Converts to default
- [ ] Currency symbol vs code - "$100" vs "100 USD" - Both work
- [ ] Cryptocurrency - "0.01 BTC" - Rejects or handles specially
- [ ] Invalid currency code - "100 XYZ" - Asks for valid code

### 6.4 Multi-Currency Scenarios

#### Currency Conversion
- [ ] Transaction in VND - Large number - Converts to default currency
- [ ] Transaction in EUR - Conversion rate accurate
- [ ] Transaction in GBP - Conversion logged with rate
- [ ] Travel expenses - Multiple currencies in same day - All converted
- [ ] Conversion rate source - Reliable API or service used
- [ ] Original amount preserved - Shows both original and converted

#### Currency Display
- [ ] Query shows original currency - "100 USD (450 AED)" format
- [ ] Consistent currency display - All amounts use same default
- [ ] Currency change - Doesn't affect historical transactions
- [ ] Mixed currency query - Groups by default currency

### 6.5 Timezone Handling

#### Timezone-Aware Dates
- [ ] "Yesterday" in PST - Correct date calculated
- [ ] "Today" in JST - Correct date calculated
- [ ] "Last Monday" in EST - Correct date calculated
- [ ] Timezone change - Affects future transactions only
- [ ] Historical transactions - Preserve original timestamp

#### Boundary Cases
- [ ] Transaction at 23:59 - Correct date assignment
- [ ] Transaction at 00:01 - Correct date assignment
- [ ] Daylight saving time transition - Handled correctly
- [ ] Timezone offset display - Shows user's current offset

---

## 7. SUBSCRIPTION & BILLING TESTS

### 7.1 Trial Period

#### Trial Activation
- [ ] New user - Automatically gets 7-day trial
- [ ] Trial start date - Recorded correctly
- [ ] Trial end date - Calculated as start + 7 days
- [ ] Trial status display - Shows days remaining clearly

#### Trial Experience
- [ ] Full feature access - All features available during trial
- [ ] Trial countdown - "/billing" shows remaining days
- [ ] Trial reminder - Notification 3 days before expiry (if implemented)
- [ ] Trial reminder - Notification 1 day before expiry
- [ ] Trial expiring soon - Prominent upgrade prompts

#### Trial Expiration
- [ ] Trial expired - Access restricted to read-only or limited
- [ ] Expiration message - Clear prompt to subscribe
- [ ] Grace period (if any) - Clearly communicated
- [ ] Post-trial behavior - User can still access bot for subscription

#### Trial to Paid Transition
- [ ] Subscribe during trial - Seamless transition, trial extended if applicable
- [ ] Subscribe after trial - Immediate activation
- [ ] No duplicate charges - Trial doesn't charge

### 7.2 Payment Flow

#### Checkout Process
- [ ] Monthly plan selection - Shows correct price ($10/month or configured)
- [ ] Annual plan selection - Shows correct price ($100/year or configured)
- [ ] Checkout URL generation - Valid Stripe URL returned
- [ ] Checkout page loads - Stripe hosted page displays
- [ ] Payment form - All fields available (card, billing address)
- [ ] Prefilled info - Email prefilled if available

#### Payment Success
- [ ] Card payment success - Subscription activated within 30 seconds
- [ ] User notification - "Payment successful" message sent
- [ ] Database update - User record shows "active" status
- [ ] Access granted immediately - User can use bot without delay
- [ ] Receipt email - Stripe sends receipt (Stripe handles)

#### Payment Failure
- [ ] Card declined - User receives clear error message
- [ ] Insufficient funds - Appropriate error
- [ ] Retry option - User can attempt payment again
- [ ] Status remains trial/expired - No premature activation
- [ ] Multiple retry attempts - Each processed correctly

#### 3D Secure / SCA
- [ ] 3DS required card - Authentication flow works
- [ ] 3DS success - Payment completes after auth
- [ ] 3DS failure - Payment declined, user notified
- [ ] 3DS timeout - Handled gracefully

#### Alternative Payment Methods (if enabled)
- [ ] Bank transfer - Checkout supports (if configured)
- [ ] SEPA debit - Works (if supported)
- [ ] Other methods - Function as expected

### 7.3 Subscription Management

#### Active Subscription
- [ ] Active user - Full bot access
- [ ] `/billing` shows status - "Active until [date]"
- [ ] Next billing date - Displayed correctly
- [ ] Plan type - Shows monthly or annual
- [ ] Current period - Start and end dates clear

#### Billing Cycle
- [ ] Monthly renewal - Charges on correct date
- [ ] Annual renewal - Charges after 12 months
- [ ] Renewal notification - User notified before charge (optional)
- [ ] Renewal success - Period extended automatically

#### Subscription Status Changes
- [ ] Active → Past due - Payment fails, grace period starts
- [ ] Past due → Active - Payment retried and succeeds
- [ ] Past due → Canceled - After retry period expires
- [ ] Active → Canceled - User cancels subscription
- [ ] Canceled → Active - User resubscribes

#### Cancellation
- [ ] User cancels subscription - Processed correctly
- [ ] Cancellation effective date - Access until period end
- [ ] Immediate cancellation - If chosen, takes effect immediately (rare)
- [ ] Cancellation confirmation - User receives confirmation message
- [ ] Post-cancellation access - Read-only or limited features
- [ ] Resubscription - User can subscribe again

#### Upgrades & Downgrades (if supported)
- [ ] Monthly to annual upgrade - Prorated correctly
- [ ] Annual to monthly downgrade - Scheduled for next period
- [ ] Plan change notification - User informed of changes

### 7.4 Webhook Processing

#### Webhook Reception
- [ ] Webhook endpoint accessible - Stripe can reach it
- [ ] Webhook signature validation - Invalid signatures rejected
- [ ] Webhook logging - All webhooks logged for debugging
- [ ] Webhook acknowledgment - Returns 200 OK quickly

#### Webhook Events
- [ ] `checkout.session.completed` - Subscription activated, user notified
- [ ] `customer.subscription.created` - User record updated
- [ ] `customer.subscription.updated` - Status changes applied
- [ ] `customer.subscription.deleted` - Cancellation processed
- [ ] `invoice.payment_succeeded` - Billing period extended
- [ ] `invoice.payment_failed` - Status updated, user notified
- [ ] `invoice.payment_action_required` - User prompted (3DS, etc.)
- [ ] `customer.updated` - Customer info synced

#### Webhook Reliability
- [ ] Duplicate webhook - Same event ID processed once (idempotent)
- [ ] Out-of-order webhooks - Handled correctly
- [ ] Webhook retry - Stripe retries on 5xx, eventually succeeds
- [ ] Webhook backlog - Multiple webhooks processed in order

#### Error Handling
- [ ] Unknown event type - Logged, no crash
- [ ] Malformed webhook body - Rejected gracefully
- [ ] Database error during webhook - Returned 500, Stripe retries
- [ ] Webhook timeout - Processes async if long-running

### 7.5 Usage Tracking (if implemented)

#### Token Counting
- [ ] Transaction logging - Tokens counted
- [ ] Query processing - Tokens counted
- [ ] Chat responses - Tokens counted
- [ ] Total calculation - Accurate sum

#### Usage Limits (if applicable)
- [ ] Limit approaching - User notified at 80%
- [ ] Limit reached - Soft cap warning
- [ ] Overage handling - Additional charges or throttling
- [ ] Usage reset - Monthly cycle correct

#### Usage Display
- [ ] `/billing` shows usage - Tokens used / available
- [ ] Usage history - Past months accessible
- [ ] Usage breakdown - By operation type (if detailed)

---

## 8. DATA INTEGRITY TESTS

### 8.1 Transaction Accuracy

#### Amount Precision
- [ ] Decimal precision - Two decimal places maintained
- [ ] Rounding - Consistent rounding rules
- [ ] Large amounts - No overflow or precision loss
- [ ] Small amounts - Cents/paise handled correctly

#### Currency Codes
- [ ] Valid ISO 4217 codes - Accepted (USD, EUR, GBP, AED, etc.)
- [ ] Invalid codes - Rejected with helpful error
- [ ] Currency symbols - Converted to codes ($→USD, €→EUR)
- [ ] Case insensitivity - "usd" accepted as "USD"

#### Date Storage
- [ ] Date format - ISO 8601 (YYYY-MM-DD)
- [ ] Timezone awareness - Timestamps include timezone
- [ ] Date boundaries - Midnight transactions handled correctly
- [ ] Historical dates - Old dates stored accurately

#### Category Consistency
- [ ] Fixed category list - Categories from predefined set
- [ ] Category validation - Invalid categories rejected or defaulted
- [ ] Category inference - LLM suggests appropriate category
- [ ] Category override - User can change category (if feature exists)

#### Merchant Name
- [ ] Original merchant name - Preserved exactly as input
- [ ] Case preservation - "Starbucks" vs "STARBUCKS" maintained
- [ ] Whitespace - Leading/trailing spaces trimmed
- [ ] Special characters - Preserved correctly

### 8.2 Database Constraints

#### Primary Keys
- [ ] Transaction ID - Unique, auto-incrementing
- [ ] User ID - Unique for each user
- [ ] No duplicate IDs - Constraint enforced

#### Foreign Keys
- [ ] Transaction references user - FK enforced
- [ ] Invalid user ID - Insert rejected
- [ ] User deletion - Cascades to transactions (or prevented)

#### NOT NULL Constraints
- [ ] Required fields - Cannot be null (amount, merchant, user_id, date)
- [ ] Optional fields - Nullable (description, original_currency)
- [ ] Validation - Frontend and backend enforce

#### Check Constraints
- [ ] Amount > 0 - If constrained, enforced (or allow negatives for refunds)
- [ ] Valid currency codes - Check constraint (if used)
- [ ] Date range - Reasonable date range (not year 3000)

#### Unique Constraints
- [ ] User email - Unique across users
- [ ] Stripe customer ID - Unique per user
- [ ] Merchant cache entry - Unique merchant names

### 8.3 Vector Embeddings

#### Embedding Generation
- [ ] Consistent generation - Same merchant → same embedding
- [ ] Dimension check - Always 1536 dimensions
- [ ] Normalization - Vector norms appropriate
- [ ] Null handling - Embeddings always generated or null explicitly

#### Similarity Search
- [ ] Relevant results - Similar merchants returned
- [ ] Similarity threshold - Configurable (0.6 default)
- [ ] Result ordering - Sorted by similarity score descending
- [ ] No results below threshold - Filtered correctly

#### Cache Operations
- [ ] Cache lookup - Finds existing merchant embeddings
- [ ] Cache insert - New merchants added
- [ ] Cache update - Usage count incremented
- [ ] Cache hit tracking - Monitors cache effectiveness

### 8.4 Data Migration & Schema Changes

#### Backward Compatibility
- [ ] New columns - Default values for existing records
- [ ] Schema changes - Old data migrated correctly
- [ ] Version compatibility - Code works with schema version

#### Backfill Operations (if needed)
- [ ] Backfill embeddings - All transactions get embeddings
- [ ] Backfill conversions - Currency conversions calculated
- [ ] Backfill progress - Can resume if interrupted
- [ ] Backfill validation - Results verified

#### Data Export & Backup (if implemented)
- [ ] User data export - Complete data exported
- [ ] Export format - JSON or CSV, well-formed
- [ ] Database backup - Automated and scheduled
- [ ] Restore procedure - Backup can be restored

---

## 9. DEPLOYMENT & INFRASTRUCTURE TESTS

### 9.1 Docker Build & Run

#### Build Process
- [ ] `docker build` - Completes without errors
- [ ] Build time - Reasonable (<5 minutes)
- [ ] Image size - Reasonable (<500MB)
- [ ] Layer caching - Subsequent builds faster
- [ ] Dependencies installed - All npm packages present

#### Container Startup
- [ ] Container starts - `docker run` succeeds
- [ ] Port binding - Port 4111 accessible (or configured port)
- [ ] Environment variables - Loaded from .env or docker run args
- [ ] Logs output - Visible in docker logs
- [ ] Health check - Container reports healthy

#### Runtime Stability
- [ ] No immediate crashes - Runs for >5 minutes
- [ ] Memory limits - Respects docker memory constraints
- [ ] CPU limits - Respects docker CPU constraints
- [ ] Graceful shutdown - SIGTERM handled correctly

### 9.2 Production Environment

#### Configuration
- [ ] `.env` file - All required variables present
- [ ] Secret management - Sensitive vars not in repo
- [ ] Environment detection - Dev/prod distinguished
- [ ] Feature flags - Configured appropriately (if used)

#### Network & Ports
- [ ] Port binding - Configured port open and accessible
- [ ] Webhook URL - Publicly reachable (if using webhooks)
- [ ] SSL/TLS - HTTPS enabled for webhooks
- [ ] Firewall rules - Appropriate ports allowed

#### Process Management
- [ ] Process supervisor - PM2, systemd, or Docker restarts
- [ ] Auto-restart on crash - Process comes back up
- [ ] Crash loop prevention - Backoff or alerting
- [ ] Graceful shutdown - Handles SIGTERM/SIGINT

#### Logging
- [ ] Log destination - Stdout, file, or log service
- [ ] Log rotation - Old logs archived or deleted
- [ ] Log levels - Configurable (info, debug, error)
- [ ] Structured logs - JSON format for parsing

### 9.3 Health Checks & Monitoring

#### Health Endpoints (if implemented)
- [ ] `/health` endpoint - Returns 200 OK when healthy
- [ ] Database check - Health includes DB connectivity
- [ ] External API check - Health includes API reachability (optional)
- [ ] Response time - Health check responds quickly (<1s)

#### Bot Status
- [ ] Bot running - Responds to messages
- [ ] Bot username - Correct bot username
- [ ] Bot commands - Command menu displays
- [ ] Bot info - `/start` shows version or build info

#### Database Connectivity
- [ ] Connection pool - Healthy connections available
- [ ] Query execution - Test query succeeds
- [ ] Latency - Database response time acceptable
- [ ] Connection failures - Alerted

#### External Services
- [ ] OpenAI API - Reachable and responsive
- [ ] Stripe API - Reachable and responsive
- [ ] Telegram API - Reachable and responsive
- [ ] Service degradation - Graceful handling when service slow

### 9.4 Monitoring & Observability

#### Application Logging
- [ ] Pino logs - Structured JSON logs output
- [ ] Log context - User ID, operation, timestamp included
- [ ] Error logging - Stack traces captured
- [ ] Performance logging - Duration metrics logged

#### Error Tracking (if integrated)
- [ ] Sentry integration - Errors sent to Sentry (if configured)
- [ ] Error grouping - Similar errors grouped
- [ ] Error alerts - Critical errors trigger notifications
- [ ] Error context - User ID, request details included

#### Performance Metrics (if integrated)
- [ ] Response times - Tracked per operation
- [ ] Throughput - Requests per minute tracked
- [ ] Error rates - Percentage of failed requests
- [ ] Resource usage - CPU, memory, disk monitored

#### Mastra Playground (Development)
- [ ] Playground accessible - http://localhost:4111 works
- [ ] Agent testing - Can invoke agents manually
- [ ] Workflow testing - Can run workflows
- [ ] Logs visible - Debug logs displayed

### 9.5 Disaster Recovery

#### Backup & Restore
- [ ] Database backup - Automated daily backups
- [ ] Backup verification - Backups tested regularly
- [ ] Restore procedure - Documented and practiced
- [ ] Backup retention - 30-day retention (or policy defined)
- [ ] Point-in-time recovery - Supabase PITR available

#### Secrets Rotation
- [ ] Rotate bot token - Procedure documented
- [ ] Rotate OpenAI key - No downtime
- [ ] Rotate Stripe keys - Webhook updates
- [ ] Rotate database password - Connection string updated

#### Incident Response
- [ ] Rollback plan - Can revert to previous version
- [ ] Emergency contacts - Team contact list available
- [ ] Incident log - Incidents documented
- [ ] Post-mortem - Lessons learned captured

#### Data Recovery
- [ ] Accidental deletion - Can restore from backup
- [ ] Data corruption - Can restore clean data
- [ ] Partial data loss - Graceful degradation

---

## 10. REGRESSION TESTS (Post-Bug Fixes)

### Track Fixed Bugs
- [ ] Bug #1: [Description] - Verified fixed, no recurrence
- [ ] Bug #2: [Description] - Verified fixed, no recurrence
- [ ] Bug #3: [Description] - Verified fixed, no recurrence

### Related Functionality
- [ ] Fix didn't break related feature A
- [ ] Fix didn't break related feature B
- [ ] Fix didn't introduce new edge case

---

## TEST EXECUTION STRATEGY

### Phase 1: Pre-Beta (Manual Testing) - Week 1

**Day 1-2: Core Functionality**
- [ ] All command tests (1.1)
- [ ] Basic text message processing (1.2)
- [ ] Database integration (2.1)
- [ ] Basic security checks (4.1, 4.2)

**Day 3-4: Advanced Features**
- [ ] Voice and photo processing (1.3, 1.4)
- [ ] Query mode comprehensive tests (1.2)
- [ ] OpenAI integration (2.2)
- [ ] Stripe integration (2.3)

**Day 5: User Experience**
- [ ] First-time user journey (6.1)
- [ ] Daily usage scenarios (6.2)
- [ ] Edge cases (6.3)

**Day 6-7: Performance & Error Handling**
- [ ] Response time benchmarks (3.1)
- [ ] Error handling tests (5.1-5.5)
- [ ] Data integrity (8.1-8.2)

### Phase 2: Beta Testing - Weeks 2-4

**Week 2: Closed Beta (10 users)**
- [ ] Monitor all functional tests in production
- [ ] Track performance metrics
- [ ] Collect initial feedback
- [ ] Fix critical bugs (P0)

**Week 3: Extended Beta (20-30 users)**
- [ ] Subscription flow with real payments (test mode)
- [ ] Concurrent user testing
- [ ] Performance under load
- [ ] Fix high-priority bugs (P1)

**Week 4: Beta Refinement**
- [ ] Address all user feedback
- [ ] Optimize performance bottlenecks
- [ ] Security audit
- [ ] Documentation updates

### Phase 3: Automated Testing - Week 5

**Setup Automated Tests**
- [ ] Vitest suites for critical paths
- [ ] Mock OpenAI, Supabase, Stripe, Telegram
- [ ] CI/CD pipeline integration
- [ ] Coverage reporting (target: 70%+)

**Test Suites to Implement**
1. Transaction extraction parser tests
2. Currency conversion tests
3. Date/timezone handling tests
4. Database query tests
5. Workflow step tests
6. Agent invocation tests

### Phase 4: Pre-Launch - Week 6

**Final Validation**
- [ ] Full security audit by third party (if budget allows)
- [ ] Load testing with expected user count (50-100 concurrent)
- [ ] Disaster recovery dry run
- [ ] Final subscription billing test with real payment
- [ ] Documentation review
- [ ] Support materials prepared

---

## CRITICAL PATH (Must Pass Before Launch)

### ✅ P0 - Blocker Issues (Must be 100% passing)

- [ ] Users can log transactions via text
- [ ] Users can log transactions via voice
- [ ] Users can log transactions via photo
- [ ] Transactions saved correctly to database
- [ ] Users can query their transaction data
- [ ] Queries return only user's own data (RLS)
- [ ] Subscription payment flow works end-to-end
- [ ] Stripe webhooks activate subscriptions
- [ ] No data leakage between users
- [ ] No SQL injection vulnerabilities
- [ ] No exposed API keys or secrets
- [ ] Bot doesn't crash on common inputs
- [ ] Error messages are user-friendly, not technical
- [ ] Temporary files cleaned up
- [ ] Database connections don't leak

### ✅ P1 - Critical Issues (Must be >90% passing)

- [ ] All commands work correctly
- [ ] All three modes (logger/query/chat) functional
- [ ] Currency conversion accurate (within 1% of real rate)
- [ ] Timezone handling correct for all timezones
- [ ] Cache improves performance (>10x for hits)
- [ ] No memory leaks over 24h uptime
- [ ] Stripe webhooks processed reliably (idempotent)
- [ ] Trial period enforced correctly
- [ ] Subscription expiration handled correctly
- [ ] Voice transcription accurate (>90%)
- [ ] Photo OCR accurate (>80% for clear receipts)

### ✅ P2 - Important Issues (Should be >80% passing)

- [ ] Performance under load acceptable (<5s response)
- [ ] Complex queries with filters work correctly
- [ ] Multi-currency handling robust
- [ ] Hybrid search returns relevant results
- [ ] Monitoring and logging comprehensive
- [ ] Error tracking captures all exceptions
- [ ] Documentation complete

---

## TESTING TOOLS & ENVIRONMENT

### Required Tools & Services

**Testing Infrastructure**
- [ ] Telegram test bot (separate bot token)
- [ ] Supabase test project (isolated database)
- [ ] Stripe test mode (test API keys)
- [ ] OpenAI API (separate project for testing)

**Development Tools**
- [ ] Docker & Docker Compose
- [ ] Postman or Thunder Client (API testing)
- [ ] PostgreSQL client (database inspection)
- [ ] Redis client (if using Redis for caching)

**Load Testing Tools**
- [ ] Artillery or k6 (HTTP load testing)
- [ ] Telegram bot load simulator (custom script)

**Monitoring Tools**
- [ ] Pino logs viewer (pino-pretty)
- [ ] Database query analyzer (Supabase dashboard)
- [ ] Stripe dashboard (webhook logs)

### Test Data Generation

**Test Data Script** (to be created)
```bash
# Generate sample transactions for testing
yarn run generate:test-data --users 10 --transactions 100
```

- [ ] Script generates realistic transaction data
- [ ] Multiple users with varied transaction patterns
- [ ] Different currencies, dates, merchants
- [ ] Edge cases included (old dates, large amounts, etc.)

### Test Accounts

**User Personas**
1. **Alice** - New user (first time, trial)
2. **Bob** - Active trial user (3 days remaining)
3. **Carol** - Paid subscriber (monthly)
4. **Dave** - Paid subscriber (annual)
5. **Eve** - Expired trial user
6. **Frank** - Canceled subscription (access until period end)
7. **Grace** - Power user (1000+ transactions)
8. **Hank** - Multi-currency user (travels frequently)

---

## DOCUMENTATION FOR BETA TESTERS

### Beta Tester Onboarding Package

**1. Welcome Email**
- Thank you for participating
- What to expect during beta
- How long beta will run (2-4 weeks)
- Support contact information

**2. Setup Guide**
- How to start the bot on Telegram
- Setting your currency and timezone
- Logging your first transaction
- Running your first query

**3. Feature Testing Checklist**
- List of features to test
- How to log transactions (text, voice, photo)
- How to query data
- How to switch modes
- How to test subscription (if applicable)

**4. Feedback Form** (Google Form or Typeform)
- What worked well?
- What was confusing?
- What features are missing?
- How would you rate ease of use? (1-5)
- Would you recommend to friends? (NPS score)
- Open feedback

**5. Known Issues Document**
- List of known bugs being worked on
- Workarounds for known issues
- Which features are still in development

**6. Bug Reporting Template**
```markdown
**Bug Description:** [What went wrong?]
**Steps to Reproduce:** [How to reproduce the bug?]
**Expected Behavior:** [What should have happened?]
**Actual Behavior:** [What actually happened?]
**Screenshots:** [If applicable]
**Device/OS:** [Telegram on iOS/Android/Desktop]
**Telegram User ID:** [Your user ID]
**Timestamp:** [When did it happen?]
```

**7. Support Channels**
- Telegram support group (for beta testers)
- Email support (response within 24h)
- GitHub issues (for technical users)

---

## TEST METRICS & SUCCESS CRITERIA

### Key Metrics to Track

**Reliability**
- [ ] Uptime: **>99%** during beta
- [ ] Error rate: **<1%** of all requests
- [ ] Crash rate: **<0.1%** of sessions

**Performance**
- [ ] P50 response time: **<2 seconds**
- [ ] P95 response time: **<5 seconds**
- [ ] P99 response time: **<10 seconds**

**User Satisfaction (Beta Feedback)**
- [ ] Overall satisfaction: **>4.0/5.0**
- [ ] Ease of use: **>4.0/5.0**
- [ ] Feature completeness: **>3.5/5.0**
- [ ] NPS score: **>40**

**Functional Coverage**
- [ ] P0 tests passing: **100%**
- [ ] P1 tests passing: **>95%**
- [ ] P2 tests passing: **>85%**
- [ ] Code coverage: **>70%** (when automated tests implemented)

**Business Metrics**
- [ ] Trial conversion rate: **>20%** (trial → paid)
- [ ] 30-day retention: **>60%**
- [ ] Transactions per user per week: **>10**

---

## LAUNCH READINESS CHECKLIST

### Final Pre-Launch Review

**Technical Readiness**
- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>95%)
- [ ] Security audit complete (no critical issues)
- [ ] Performance benchmarks met
- [ ] Automated tests in CI/CD
- [ ] Monitoring and alerting configured
- [ ] Disaster recovery plan tested

**Product Readiness**
- [ ] All core features working
- [ ] User documentation complete
- [ ] Help/FAQ available in bot
- [ ] Subscription pricing finalized
- [ ] Terms of service and privacy policy published

**Operational Readiness**
- [ ] Support team trained
- [ ] Runbook documented
- [ ] On-call rotation defined
- [ ] Incident response plan ready
- [ ] Backup and restore tested

**Marketing Readiness**
- [ ] Landing page live (web/)
- [ ] Launch announcement prepared
- [ ] Social media presence set up
- [ ] Initial user outreach plan
- [ ] Press kit (if applicable)

---

## POST-LAUNCH MONITORING (First 30 Days)

### Daily Checks (Days 1-7)
- [ ] Bot uptime and responsiveness
- [ ] Error logs review
- [ ] User sign-up rate
- [ ] Transaction logging success rate
- [ ] Payment success rate
- [ ] Critical bug reports

### Weekly Checks (Weeks 2-4)
- [ ] Performance metrics review
- [ ] User retention analysis
- [ ] Feature usage statistics
- [ ] Support ticket trends
- [ ] Security audit results
- [ ] Cost analysis (OpenAI, Stripe, Supabase)

### Monthly Review (Day 30)
- [ ] Overall health assessment
- [ ] User feedback analysis
- [ ] Feature prioritization for next release
- [ ] Technical debt review
- [ ] Cost optimization opportunities

---
