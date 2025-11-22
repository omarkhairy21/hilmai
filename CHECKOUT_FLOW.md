# HilmAI Checkout & Activation Flow Documentation

## Overview

This document describes the complete checkout and subscription activation flow implemented for HilmAI. The system supports web users (who don't have Telegram accounts initially) purchasing subscriptions and seamlessly activating them in the Telegram bot through link codes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Web (Astro)                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Pricing Page                                                 │   │
│  │  - Monthly: $16/month                                        │   │
│  │  - Annual: $150/year                                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓ (Click "Start Free Trial" or "Subscribe Now")           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ /api/checkout (Web Endpoint)                                 │   │
│  │  - Accepts: planTier, successUrl, cancelUrl, includeTrial    │   │
│  │  - NO userId required (guest checkout)                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓ (Calls agent backend)                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Agent Backend (Mastra)                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ /billing/checkout (Agent API)                                │   │
│  │  - Adds session ID placeholder to success URL                │   │
│  │  - Creates Stripe session (with or without customer ID)      │   │
│  │  - Returns checkout URL                                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Stripe Checkout                                              │   │
│  │  - User enters email & card details                          │   │
│  │  - Completes payment                                         │   │
│  │  - Sends webhook events                                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓ (Success: redirects to /success?session_id=...)        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Web (Success Page)                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ /success?session_id={CHECKOUT_SESSION_ID}                    │   │
│  │  - Reads session_id from URL                                 │   │
│  │  - Calls /api/activation with sessionId                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ /api/activation (Web Endpoint)                               │   │
│  │  - Forwards to agent /billing/activation-code                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Agent Backend (Mastra)                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ /billing/activation-code (Agent API)                         │   │
│  │  - Retrieves Stripe session from sessionId                   │   │
│  │  - Generates activation code (format: LINK-ABC123)           │   │
│  │  - Stores in activation_codes table (48-hour expiry)         │   │
│  │  - Returns: { linkCode, deepLink }                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Database: activation_codes Table                              │   │
│  │  - code: LINK-ABC123                                         │   │
│  │  - stripe_session_id: cs_live_...                            │   │
│  │  - stripe_customer_email: user@example.com                   │   │
│  │  - plan_tier: 'monthly' or 'annual'                          │   │
│  │  - expires_at: 48 hours from creation                        │   │
│  │  - used_at: NULL (until activation)                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Web (Success Page)                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Display Activation Options:                                  │   │
│  │                                                               │   │
│  │ Method 1: Auto-Activate (Deep Link)                          │   │
│  │  - Button: "Open Telegram Bot"                               │   │
│  │  - Deep Link: t.me/hilmaibot?start=LINK-ABC123              │   │
│  │  - Opens bot with activation code pre-filled                 │   │
│  │                                                               │   │
│  │ Method 2: Manual Code Entry                                  │   │
│  │  - Code Display: LINK-ABC123                                 │   │
│  │  - Copy Button to clipboard                                  │   │
│  │  - User can manually send code to bot                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓ (User clicks deep link OR sends code manually)         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Telegram Bot (@hilmaibot)                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ /start LINK-ABC123 (Deep Link Handler)                       │   │
│  │  - Bot receives /start command with code                     │   │
│  │  - Extracts activation code from parameter                   │   │
│  │  - Calls activateFromActivationCode(code, userId)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Activation Process:                                          │   │
│  │  1. Validate code format (LINK-XXX)                          │   │
│  │  2. Query activation_codes table                             │   │
│  │  3. Check: not expired, not used                             │   │
│  │  4. Retrieve Stripe session from sessionId                   │   │
│  │  5. Get subscription details from Stripe                     │   │
│  │  6. Upsert user record with:                                 │   │
│  │     - Telegram ID (from bot)                                 │   │
│  │     - Email (from Stripe)                                    │   │
│  │     - Subscription ID & status                               │   │
│  │     - Plan tier                                              │   │
│  │     - Trial/period dates                                     │   │
│  │  7. Mark code as used (used_at = NOW)                        │   │
│  │  8. Send confirmation message                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ User Messages:                                               │   │
│  │  1. "✅ Subscription activated! Your monthly plan is now ... │   │
│  │  2. "🎉 Welcome to hilm.ai Pro! Here's what you can do:" │   │
│  │     - Onboarding buttons:                                    │   │
│  │       - ⚡ Instant Log                                       │   │
│  │       - 🛠 Set Up Profile                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Database Updates:                                            │   │
│  │  - users table: new record with subscription info            │   │
│  │  - activation_codes table: marked as used                    │   │
│  │  - Stripe webhooks: process subscription events              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           ↓                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Database Schema

#### activation_codes Table

```sql
CREATE TABLE activation_codes (
  id BIGINT PRIMARY KEY,
  code VARCHAR(50) UNIQUE,              -- Format: LINK-ABC123
  stripe_session_id VARCHAR(255),       -- Link to Stripe session
  stripe_customer_email VARCHAR(255),   -- Email from Stripe checkout
  plan_tier TEXT,                       -- 'monthly' or 'annual'
  used_at TIMESTAMPTZ,                  -- NULL until activated
  expires_at TIMESTAMPTZ,               -- 48 hours from creation
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Key Features:**
- 48-hour expiration window
- Tracks usage to prevent code reuse
- Links Stripe session to Telegram user activation
- RLS policies: Only backend service can access

### 2. Web Endpoints

#### POST /api/checkout

**Request:**
```typescript
{
  planTier: 'monthly' | 'annual',      // Required
  successUrl: string,                   // Required
  cancelUrl: string,                    // Required
  includeTrial?: boolean,               // Optional: 7-day trial for monthly
  customerEmail?: string                // Optional: for guest checkout
  // Note: userId is NOT required for web checkout
}
```

**Response:**
```typescript
{
  url: string  // Stripe checkout URL
}
```

**Flow:**
1. Web calls this endpoint (no authentication needed)
2. Endpoint adds session ID placeholder to success URL: `?session_id={CHECKOUT_SESSION_ID}`
3. Backend creates Stripe session (guest or with customer if userId provided)
4. Returns Stripe checkout URL

#### POST /api/activation

**Request:**
```typescript
{
  sessionId: string  // From URL param ?session_id=cs_live_...
}
```

**Response:**
```typescript
{
  linkCode: string,   // Format: LINK-ABC123
  deepLink: string    // Format: t.me/hilmaibot?start=LINK-ABC123
}
```

**Flow:**
1. Web success page reads sessionId from URL
2. Calls this endpoint to generate activation code
3. Backend stores code in activation_codes table
4. Returns code and deep link for user to activate in bot

### 3. Backend API Routes

#### POST /billing/checkout

**Handles:**
- Guest checkout (no userId)
- Authenticated checkout (with userId)
- Creates or reuses Stripe customer
- Generates checkout session
- Injects session ID placeholder in success URL

#### POST /billing/activation-code

**Handles:**
- Validates Stripe session exists
- Generates unique activation code
- Checks for existing valid codes (reuse if not expired)
- Stores in activation_codes table with 48-hour expiry
- Returns linkCode and deepLink

#### /start Command Handler (Bot)

**Handles:**
- Detects activation code in `/start LINK-ABC123` parameter
- Validates code format
- Queries activation_codes table
- Checks expiration and usage status
- Retrieves Stripe subscription details
- Creates/updates user record
- Marks code as used
- Sends confirmation messages
- Shows onboarding buttons

### 4. Frontend Components

#### Success Page (web/src/pages/success.astro)

**Features:**
- Reads `session_id` from URL query params
- Shows loading state while fetching activation code
- Displays two activation methods:
  1. Auto-Activate: Deep link button to bot
  2. Manual Code: Copy-to-clipboard code entry
- Error handling with support contact option
- Responsive design with Tailwind CSS v4

**JavaScript Functions:**
- `initializeActivation()`: Fetches code from backend
- `showError()`: Displays error messages
- Event listeners for button clicks

## Integration with Existing Flow

### User Journey

#### New User (Web → Bot)

1. **Discovery:** User visits hilm.ai pricing page
2. **Checkout:** Clicks "Subscribe Now" or "Start Free Trial"
3. **Payment:** Completes Stripe checkout (no account needed)
4. **Success:** Redirected to `/success?session_id=...`
5. **Activation:** Gets LINK code and deep link
6. **Bot:** Opens bot with `/start LINK-ABC123`
7. **Account Creation:** Bot creates user record with subscription info
8. **Onboarding:** Shows welcome message and onboarding buttons
9. **Active User:** Can immediately start using features

#### Existing User (Bot Direct)

1. **Regular Bot Usage:** User already in Telegram
2. **Billing Command:** User types `/billing`
3. **Checkout:** Completes Stripe checkout
4. **Subscription:** Webhook creates subscription
5. **Activation:** Already linked (has userId in metadata)
6. **Usage:** Continues with bot

### Database Integration

#### users Table Changes

No structural changes. On activation:
- `id`: Telegram user ID (primary key)
- `email`: Set from Stripe checkout
- `stripe_customer_id`: Set from Stripe
- `stripe_subscription_id`: Set from subscription
- `plan_tier`: Set from activation code metadata
- `subscription_status`: Set from Stripe subscription
- Other fields: trial dates, period end, etc.

#### New Table: activation_codes

- Bridges web checkout (no Telegram account) to bot activation
- Temporary records (48-hour expiration)
- Links Stripe session to eventual Telegram user

### Webhook Integration

**Existing webhooks continue to work:**
- `customer.subscription.created`: Handles subscription creation
- `invoice.payment_succeeded`: Handles payment confirmation
- Other Stripe events: Unchanged

**New behavior:**
- If `telegram_user_id` in metadata: Direct user creation (bot user)
- If NOT in metadata: Logged as "web user, not in Telegram yet"
- Activation code bridges the gap when user joins bot later

## Activation Code Format

### Generation

```typescript
function generateActivationCode(): string {
  // Format: LINK-ABC123
  // - Prefix: "LINK-"
  // - 6 random uppercase alphanumeric characters
  // - Result: Easily readable, unique
  return `LINK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}
```

### Deep Link Format

```
t.me/hilmaibot?start=LINK-ABC123
```

- Telegram deep link to bot
- `/start` command with code as parameter
- Bot can extract and validate code

### Validation

```typescript
function isValidActivationCodeFormat(code: string): boolean {
  return /^LINK-[A-Z0-9]{6}$/.test(code);
}
```

## Security Considerations

1. **RLS Policies:** activation_codes table:
   - Only backend service can insert/update/select
   - Users cannot access directly

2. **Code Expiration:**
   - 48-hour window prevents stale codes
   - Automatic cleanup possible via trigger

3. **One-Time Use:**
   - Code marked as used after activation
   - Prevents replay attacks

4. **Email Storage:**
   - Customer email from Stripe (secure source)
   - Used to match user later if needed

5. **Session Validation:**
   - Verifies Stripe session exists
   - Checks session payment status
   - Retrieves subscription details from Stripe

## Error Handling

### Web Checkout Flow

**Errors at /api/checkout:**
- Missing required fields → 400 Bad Request
- Invalid plan tier → 400 Bad Request
- Stripe customer creation fails → 500 Internal Server Error
- Stripe session creation fails → 500 Internal Server Error

**User sees:**
- Alert with error message
- Button re-enabled for retry

### Activation Code Generation

**Errors at /api/activation:**
- Missing sessionId → 400 Bad Request
- Invalid session → 400 Bad Request
- Code generation fails → 500 Internal Server Error

**User sees:**
- Error message in red box
- "Contact Support" button linking to bot

### Bot Activation

**Errors at /start with code:**
- Invalid code format → Error message
- Code not found → Error message
- Code expired → Error message
- Code already used → Error message
- Subscription not found → Error message
- User creation fails → Error message (but logged for support)

**User sees:**
- Error message from bot
- Can retry or contact support

## Testing Checklist

- [ ] Web user can complete checkout without Telegram account
- [ ] Success page loads with session_id from URL
- [ ] Activation code is generated and stored in DB
- [ ] Deep link opens bot with code in /start parameter
- [ ] Manual code can be copied to clipboard
- [ ] Bot receives /start LINK-ABC123 command
- [ ] Bot validates code and activates subscription
- [ ] User record is created with Stripe data
- [ ] Confirmation message shows correct plan tier
- [ ] Welcome message with onboarding buttons appears
- [ ] Code is marked as used in DB
- [ ] Expired codes are rejected
- [ ] Already-used codes are rejected
- [ ] Invalid code formats are rejected
- [ ] Stripe webhooks process correctly
- [ ] Trial periods work correctly

## Files Changed

### Web (Astro)

- `web/src/pages/success.astro` - New success page
- `web/src/pages/api/checkout.ts` - Existing, no changes (already complete)
- `web/src/pages/api/activation.ts` - New activation endpoint
- `web/src/components/PricingCard.astro` - Updated checkout logic

### Agent (Backend)

- `agent/src/services/subscription.service.ts` - Added:
  - `createCheckoutSession()` - Support for optional userId
  - `generateActivationCodeForSession()` - Generate codes
  - `activateFromActivationCode()` - Activate via code

- `agent/src/api/billing.handler.ts` - Updated:
  - `handleCheckout()` - Make userId optional
  - `handleActivationCode()` - New handler

- `agent/src/handlers/commands/start.handler.ts` - Updated:
  - Extract activation code from /start parameter
  - Process activation before normal onboarding

- `agent/src/lib/activation-codes.ts` - New utilities:
  - `generateActivationCode()`
  - `generateDeepLink()`
  - `isValidActivationCodeFormat()`
  - `extractCodeFromStartParam()`

- `agent/src/lib/database.types.ts` - Added:
  - `activation_codes` table types
  - RPC function types

- `agent/supabase/schema.sql` - Added:
  - `activation_codes` table
  - RLS policies
  - RPC functions

- `agent/supabase/reset-database.sql` - Updated:
  - Drop statements for activation_codes

## Future Enhancements

1. **Email Verification:** Send verification email before activation
2. **User Preferences:** Let user choose username during checkout
3. **Referral Codes:** Track which affiliate referred the user
4. **Gift Cards:** Support one-time codes for gifted subscriptions
5. **Team Plans:** Support multiple users per subscription
6. **Custom Domains:** Allow businesses to host their own checkout

## Troubleshooting

### Issue: "No session ID found" on success page

**Causes:**
- Stripe not injecting `{CHECKOUT_SESSION_ID}` in URL
- Browser script not running
- URL params getting stripped

**Solution:**
- Check Stripe dashboard for session details
- Open browser console to see logs
- Verify success URL format in checkout handler

### Issue: Activation code not being generated

**Causes:**
- Stripe session doesn't exist
- Backend /api/activation not being called
- Database insert failing

**Solution:**
- Check Stripe session exists in dashboard
- Check browser network tab for /api/activation call
- Check agent logs for database errors
- Verify activation_codes table exists

### Issue: Bot not receiving activation code

**Causes:**
- Deep link malformed
- User manually copy-pasting incorrectly
- Code format validation failing

**Solution:**
- Verify deep link format: `t.me/hilmaibot?start=LINK-ABC123`
- Check bot logs for code extraction issues
- Verify code format validation logic

## References

- [Stripe Checkout Sessions](https://stripe.com/docs/api/checkout/sessions)
- [Telegram Deep Links](https://core.telegram.org/api/links)
- [Mastra Agent Framework](https://mastra.ai)
- [Supabase Documentation](https://supabase.com/docs)
