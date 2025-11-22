# Subscription Flows

This document explains how users can subscribe to Hilm.ai through different channels and how subscriptions are linked to Telegram accounts.

## Overview

Hilm.ai supports two subscription flows:
1. **Direct subscription via Telegram bot** - Users subscribe directly within the Telegram bot
2. **Website subscription** - Users subscribe on the marketing website (hilm.ai) and later link to Telegram

Both flows use Stripe for payment processing and Supabase for storing subscription state.

## Database Schema

### Users Table
The `users` table includes the following subscription-related columns:

- `email` (TEXT, UNIQUE) - User's email address for subscription management
- `stripe_customer_id` (TEXT, UNIQUE) - Stripe customer ID
- `stripe_subscription_id` (TEXT) - Active Stripe subscription ID
- `plan_tier` ('monthly' | 'annual') - Current subscription plan
- `subscription_status` - Stripe subscription status (trialing, active, past_due, canceled, etc.)
- `trial_started_at` (TIMESTAMPTZ) - When the trial period started
- `trial_ends_at` (TIMESTAMPTZ) - When the trial period ends
- `current_period_end` (TIMESTAMPTZ) - When the current billing period ends

### Subscription Usage Table
The `subscription_usage` table tracks token consumption per billing period:

- `user_id` (BIGINT) - Foreign key to users table
- `billing_period_start` (TIMESTAMPTZ) - Start of billing period
- `billing_period_end` (TIMESTAMPTZ) - End of billing period
- `total_tokens` (BIGINT) - Total tokens consumed in this period

## Flow 1: Direct Telegram Subscription

### User Journey
1. User starts the bot with `/start`
2. User is automatically granted a 7-day trial
3. User optionally sets their email with `/setemail your@email.com`
4. User views subscription plans with `/subscribe`
5. User selects a plan (Monthly $16 or Annual $150)
6. Bot creates a Stripe checkout session
7. User completes payment on Stripe's hosted checkout page
8. Stripe webhook notifies our system
9. System updates user's subscription status in Supabase
10. User gains full access to the bot

### Technical Flow

```
Telegram Bot (/subscribe)
    ↓
subscription.service.ts::createCheckoutSession()
    ↓
Stripe API (create checkout session)
    ↓
User completes payment
    ↓
Stripe Webhook (customer.subscription.created)
    ↓
subscription.service.ts::handleStripeWebhook()
    ↓
user.service.ts::updateUserSubscription()
    ↓
Supabase (update users table)
```

### Key Functions

**`createCheckoutSession(userId, planTier, successUrl, cancelUrl)`**
- Fetches user from Supabase (including email if set)
- Creates or retrieves Stripe customer
- Includes user's email in Stripe customer record if available
- Creates checkout session with 7-day trial
- Returns checkout URL

**Metadata Passed to Stripe:**
- `telegram_user_id` - Links subscription back to Telegram user
- `plan_tier` - 'monthly' or 'annual'

## Flow 2: Website Subscription

### User Journey
1. User visits hilm.ai marketing website
2. User subscribes to a plan (provides email during checkout)
3. Stripe creates a customer and subscription
4. User later discovers/starts the Telegram bot
5. User sets their email with `/setemail your@email.com` (same email used on website)
6. System automatically links the Stripe subscription to the Telegram user
7. User gains full access to the bot

### Technical Flow

```
Marketing Website
    ↓
Stripe Checkout (with email)
    ↓
Stripe Webhook (customer.subscription.created)
    ↓
subscription.service.ts::handleStripeWebhook()
    ↓
subscription.service.ts::findOrCreateUserFromStripeCustomer()
    ↓
No Telegram user found yet (subscription pending)
    ↓
User starts Telegram bot
    ↓
User runs /setemail your@email.com
    ↓
bot.ts (updates user email in Supabase)
    ↓
Next webhook event triggers
    ↓
subscription.service.ts::findOrCreateUserFromStripeCustomer()
    ↓
Finds user by email
    ↓
Links Stripe customer to Telegram user
    ↓
User gains access
```

### Key Functions

**`findOrCreateUserFromStripeCustomer(stripeCustomerId)`**
- Tries to find user by `stripe_customer_id`
- If not found, fetches Stripe customer to get email
- Tries to find user by email
- If found, links Stripe customer to user
- If not found, returns null (user hasn't started bot yet)

**`linkStripeCustomerToTelegramUser(stripeCustomerId, email)`**
- Finds user by email
- Links Stripe customer ID to user record
- Returns success/error status

### Webhook Handling

The webhook handler (`handleStripeWebhook`) processes these events:

1. **customer.subscription.created** / **customer.subscription.updated**
   - Extracts `telegram_user_id` from metadata
   - If not found, calls `findOrCreateUserFromStripeCustomer()`
   - Updates user subscription status in Supabase

2. **customer.subscription.deleted**
   - Same logic as above
   - Sets subscription status to 'canceled'

3. **invoice.payment_succeeded**
   - Confirms payment received
   - Updates subscription status

4. **invoice.payment_failed**
   - Marks subscription as past_due
   - User loses access until payment resolved

## Email Management

### Setting Email

Users can set their email at any time:

```
/setemail your@email.com
```

**Validation:**
- Basic email format validation (regex)
- Unique constraint (one email per user)

**Use Cases:**
- Link website subscription to Telegram account
- Receive billing emails from Stripe
- Enable password recovery (future feature)

### Email in Stripe

When creating a Stripe customer, the system:
1. Checks if user has email set in Supabase
2. If yes, includes email in Stripe customer creation
3. If no, creates customer without email (can be added later)

## Access Control

### `hasActiveAccess(userId)`

Checks if user has access to the bot:

```typescript
function hasActiveAccess(userId: number): Promise<boolean> {
  // Check if subscription_status is 'trialing' or 'active'
  // AND trial_ends_at is in the future (if trialing)
  // AND current_period_end is in the future (if active)
}
```

**Access Granted:**
- `subscription_status = 'trialing'` AND `trial_ends_at > NOW()`
- `subscription_status = 'active'` AND `current_period_end > NOW()`

**Access Denied:**
- Trial expired
- Subscription canceled
- Payment failed (past_due)
- No subscription

### Access Check in Bot

Every message is checked for access:

```typescript
bot.on('message', async (ctx) => {
  const hasAccess = await hasActiveAccess(userId);
  
  if (!hasAccess) {
    await ctx.reply(messages.subscription.accessDenied(), {
      reply_markup: {
        inline_keyboard: [[
          { text: '💳 Subscribe Now', callback_data: 'subscribe_monthly' }
        ]]
      }
    });
    return;
  }
  
  // Process message...
});
```

## Usage Tracking

### Token Tracking

The system tracks LLM token usage per user per billing period using a custom Mastra AI Span Processor.

**`UsageTrackingProcessor`**
- Intercepts `MODEL_GENERATION` spans from Mastra AI tracing
- Extracts `totalTokens` from span attributes
- Aggregates tokens per workflow run (by `traceId`)
- Persists to `subscription_usage` table when workflow completes

**Database Function:**
```sql
increment_usage_tokens(p_user_id, p_period_start, p_tokens)
```

This function:
- Finds or creates usage record for the billing period
- Increments `total_tokens` atomically
- Updates `updated_at` timestamp

### Viewing Usage

Users can view their current usage with `/billing`:

```
💰 Your Subscription

Plan: Monthly ($16/mo)
Status: Active
Renewal: Dec 31, 2025

Usage this period: 45,230 tokens

[Manage Subscription]
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `/start` | Start the bot, create user account with 7-day trial |
| `/subscribe` | View subscription plans and pricing |
| `/billing` | View subscription status and manage billing |
| `/setemail <email>` | Set/update email for subscription management |

## Environment Variables

Required for subscription functionality:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...

# Supabase (for storing subscription state)
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Testing Scenarios

### Scenario 1: New User via Telegram
1. Start bot → Trial starts
2. Set email → Email stored
3. Subscribe → Checkout created
4. Pay → Webhook updates status
5. Access granted

### Scenario 2: Website First, Then Telegram
1. Subscribe on website with email A
2. Start bot
3. Set email to A → Subscription linked
4. Access granted

### Scenario 3: Trial Expiration
1. Start bot → Trial starts (7 days)
2. Wait 7 days
3. Send message → Access denied
4. Subscribe → Access granted

### Scenario 4: Payment Failure
1. Active subscription
2. Payment fails → Webhook sets status to 'past_due'
3. Send message → Access denied
4. Update payment method → Webhook sets status to 'active'
5. Access granted

## Security Considerations

1. **Webhook Signature Verification**
   - All webhooks are verified using Stripe's signature
   - Prevents unauthorized subscription updates

2. **Service Role Key**
   - Supabase service role key bypasses RLS
   - Only used in backend services, never exposed to client

3. **Email Uniqueness**
   - Database constraint ensures one email per user
   - Prevents subscription sharing

4. **Metadata Validation**
   - Webhook handlers validate metadata before processing
   - Logs warnings for missing/invalid data

## Future Enhancements

1. **Usage Limits**
   - Set token limits per plan tier
   - Throttle users approaching limits
   - Send notifications at 80% usage

2. **Plan Upgrades/Downgrades**
   - Allow users to switch plans mid-cycle
   - Prorate charges

3. **Referral Program**
   - Give trial extensions for referrals
   - Track referrals in metadata

4. **Team Plans**
   - Multiple users under one subscription
   - Shared token pool

5. **Email Verification**
   - Send verification email when email is set
   - Require verification before linking subscriptions

