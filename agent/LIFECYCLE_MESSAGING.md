# HilmAI Lifecycle Messaging Strategy

**Date:** November 10, 2025  
**Status:** Implementation Plan  
**Priority:** High for conversion optimization

---

## Overview

This document outlines the lifecycle messaging strategy to improve trial-to-paid conversion rates and reduce churn through timely, contextual nudges.

---

## Key Metrics & Goals

### Current Baseline (To Be Measured)
- Trial start rate: Target ≥60%
- Trial completion rate: Target ≥40%
- Trial-to-paid conversion: Target ≥25%
- 30-day retention: Target ≥70%

### Lifecycle Stages

| Stage | Timing | Goal | Message Type |
|-------|--------|------|--------------|
| **Welcome** | Day 0 (on `/start`) | Activate trial | Welcome message with CTA |
| **Engagement** | Day 1 | First transaction | Encourage logging first expense |
| **Mid-Trial** | Day 3 | Show value | Highlight features used |
| **Pre-Expiry** | Day 5 | Convert | Remind of trial end, show benefits |
| **Trial End** | Day 7 | Convert | Final push with urgency |
| **Post-Expiry** | Day 8, 15, 30 | Winback | Re-engagement campaigns |

---

## Implementation Approach

### Option 1: Cron Job (Recommended for MVP)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                     Cron Job (Daily)                        │
│                   (e.g., via GitHub Actions)                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Query Supabase for Users                       │
│                                                             │
│  SELECT * FROM users WHERE:                                 │
│  - subscription_status = 'trialing'                         │
│  - trial_ends_at BETWEEN NOW() AND NOW() + 2 days          │
│  - last_nudge_sent_at < NOW() - 24 hours (or NULL)         │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│           Send Telegram Messages via Bot API                │
│                                                             │
│  For each user:                                             │
│  1. Calculate days remaining                                │
│  2. Select appropriate message template                     │
│  3. Send via Telegram Bot API                               │
│  4. Update last_nudge_sent_at                               │
└─────────────────────────────────────────────────────────────┘
```

**Pros:**
- ✅ Simple to implement
- ✅ No additional infrastructure
- ✅ Easy to debug
- ✅ Can use GitHub Actions (free)

**Cons:**
- ⚠️ Limited to daily frequency
- ⚠️ Not real-time

### Option 2: Cloudflare Worker + Durable Objects

**Architecture:**
```
Cloudflare Worker (Scheduled)
    ↓
Query Supabase
    ↓
Send Messages via Telegram Bot API
    ↓
Update Database
```

**Pros:**
- ✅ More frequent checks (hourly)
- ✅ Scales with Cloudflare
- ✅ Aligns with deployment

**Cons:**
- ⚠️ More complex setup
- ⚠️ Requires Cloudflare account

---

## Message Templates

### Day 1: Welcome & Activation

**Trigger:** 24 hours after signup, if 0 transactions

```
🎉 Hi [FirstName]!

You started your HilmAI trial yesterday. Ready to track your first expense?

💡 Try one of these:
• Say: "I spent 50$ at Amazon"
• Send a voice message with your expense
• Snap a photo of your receipt

🚀 Quick tip: Use /mode_logger for fastest logging!

Your trial: 6 days remaining
```

### Day 3: Mid-Trial Value

**Trigger:** 3 days into trial

**If user has transactions:**
```
📊 Hi [FirstName]!

You've logged [TransactionCount] transactions - great start!

✨ Have you tried:
• Asking "How much on groceries?" in Query Mode
• Sending a voice message (no typing!)
• Snapping a receipt photo

💡 Your trial ends in 4 days. Keep exploring!

[Button: View Plans]
```

**If user has 0 transactions:**
```
👋 Hi [FirstName]!

Your trial is halfway done, but you haven't tracked any expenses yet.

Let me show you how easy it is:
1. Say: "I spent 50 AED at Starbucks"
2. I'll save it instantly!

Or send a receipt photo - I'll extract everything automatically.

⏰ Don't let your trial go to waste! Try it now.

[Button: See Examples]
```

### Day 5: Pre-Expiry Reminder

**Trigger:** 2 days before trial end

```
⏰ Hi [FirstName]!

Your HilmAI trial ends in 2 days!

📊 Your trial stats:
• [TransactionCount] transactions logged
• [TotalAmount] [Currency] tracked
• [DaysActive]/7 days active

🎯 Ready to continue?
Subscribe now and keep all your data:

📅 Monthly: $16/month (cancel anytime)
📆 Annual: $150/year (save $42!)

[Button: Subscribe Now]
[Button: Remind Me Tomorrow]
```

### Day 7: Trial End Day

**Trigger:** Trial ends today

```
🚨 Last Chance, [FirstName]!

Your HilmAI trial ends TODAY.

✨ What you've accomplished:
• Logged [TransactionCount] transactions
• Tracked [TotalAmount] [Currency]
• Saved [MinutesSaved] minutes with AI

💰 Don't lose your data!
Subscribe now to keep everything:

📅 Monthly: $16/month
📆 Annual: $150/year (SAVE $42!)

[Button: Subscribe & Keep My Data]

⚠️ After today, you'll lose access to your transactions.
```

### Day 8: Trial Expired - Immediate Winback

**Trigger:** 1 day after trial expiry

```
👋 [FirstName], we miss you!

Your trial expired yesterday, but your data is still safe.

🎁 Special offer for you:
Get 50% off your first month!

That's just $10 for your first 30 days.

✅ All your transactions are waiting
✅ Full access to all features
✅ No credit card required to see your data

[Button: Reactivate for $10]
[Button: View Regular Plans]

Offer expires in 48 hours.
```

### Day 15: Winback Campaign

**Trigger:** 1 week after trial expiry

```
Hi [FirstName],

It's been a week since your trial ended.

We'd love to have you back!

🆕 What's new since you left:
• [New features if any]
• Improved AI accuracy
• Faster processing

💸 Your special price: $15/month (25% off)

[Button: Reactivate Now]
[Button: See What I'm Missing]

This offer expires in 7 days.
```

### Day 30: Final Winback

**Trigger:** 30 days after trial expiry

```
[FirstName], one last message from us.

We noticed you haven't been using HilmAI.

Is there something we could do better?
Reply and let us know - we read every message.

🎁 As a thank you, here's 3 months for $30
(That's 50% off!)

[Button: Accept Offer]
[Button: Share Feedback]

We hope to see you again!
- The HilmAI Team
```

---

## Database Schema Updates

Add to `users` table:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nudge_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nudge_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nudge_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribed_from_nudges BOOLEAN DEFAULT FALSE;
```

---

## Implementation Steps

### Phase 1: MVP (Cron Job)

1. **Create lifecycle worker script**
   - File: `agent/src/workers/lifecycle-nudges.ts`
   - Query users needing nudges
   - Send appropriate messages
   - Update database

2. **Set up GitHub Actions cron**
   - File: `.github/workflows/lifecycle-nudges.yml`
   - Run daily at 10 AM UTC
   - Use secrets for API tokens

3. **Add message templates**
   - File: `agent/src/lib/messages.ts`
   - Add `lifecycle` section

4. **Test with staging users**
   - Create test users at different trial stages
   - Verify message timing and content

### Phase 2: Enhanced (Cloudflare Workers)

1. **Create Cloudflare Worker**
   - Deploy scheduled worker
   - Run hourly for better timing

2. **Add click tracking**
   - Track button clicks
   - Measure conversion by message type

3. **A/B test messages**
   - Test different copy
   - Optimize for conversion

---

## Message Sending Logic (Pseudocode)

```typescript
// agent/src/workers/lifecycle-nudges.ts

async function sendLifecycleNudges() {
  // Get users needing nudges
  const users = await supabase
    .from('users')
    .select('*')
    .eq('subscription_status', 'trialing')
    .lt('trial_ends_at', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))
    .or('last_nudge_sent_at.is.null,last_nudge_sent_at.lt.' + 
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .eq('unsubscribed_from_nudges', false);

  for (const user of users.data || []) {
    const daysIntoTrial = calculateDaysIntoTrial(user);
    const messageTemplate = selectMessageTemplate(daysIntoTrial, user);
    
    if (messageTemplate) {
      await sendTelegramMessage(user.id, messageTemplate);
      await updateNudgeTracking(user.id, messageTemplate.type);
    }
  }
}

function selectMessageTemplate(daysIntoTrial: number, user: User) {
  if (daysIntoTrial === 1 && user.transactionCount === 0) {
    return messages.lifecycle.day1Activation;
  }
  if (daysIntoTrial === 3) {
    return user.transactionCount > 0 
      ? messages.lifecycle.day3ValueActive
      : messages.lifecycle.day3ValueInactive;
  }
  if (daysIntoTrial === 5) {
    return messages.lifecycle.day5PreExpiry;
  }
  if (daysIntoTrial === 7) {
    return messages.lifecycle.day7TrialEnd;
  }
  // Post-expiry logic...
  return null;
}
```

---

## Monitoring & Optimization

### Key Metrics to Track

1. **Message Delivery:**
   - Messages sent
   - Delivery success rate
   - Telegram API errors

2. **Engagement:**
   - Message open rate (implied by response)
   - Button click rate
   - Response rate

3. **Conversion:**
   - Trial-to-paid by message type
   - Time from message to conversion
   - Revenue attributed to nudges

### Analytics Integration

Add to logger calls:
```typescript
logger.info('lifecycle:nudge_sent', {
  userId,
  nudgeType: 'day5_pre_expiry',
  daysIntoTrial: 5,
  transactionCount: user.transactionCount,
  event: 'lifecycle_nudge',
});
```

---

## Unsubscribe Mechanism

Allow users to opt out:

```
/unsubscribe_nudges - Stop receiving trial reminders
```

Handler:
```typescript
bot.command('unsubscribe_nudges', async (ctx) => {
  await supabase
    .from('users')
    .update({ unsubscribed_from_nudges: true })
    .eq('id', ctx.from.id);
    
  await ctx.reply('✅ You won't receive trial reminders anymore. You can still use /subscribe anytime!');
});
```

---

## Success Criteria

After 1 month of lifecycle messaging:

- ✅ Trial-to-paid conversion increase by ≥10%
- ✅ Message delivery rate ≥95%
- ✅ Unsubscribe rate <5%
- ✅ Positive user feedback

---

## Next Steps

1. **Immediate (Week 1):**
   - Add database columns for nudge tracking
   - Create message templates in `messages.ts`
   - Build MVP lifecycle worker script

2. **Short-term (Week 2-3):**
   - Set up GitHub Actions cron job
   - Test with staging users
   - Deploy to production

3. **Long-term (Month 2+):**
   - Migrate to Cloudflare Workers for hourly runs
   - Add A/B testing for message optimization
   - Implement advanced segmentation

---

**Last Updated:** November 10, 2025  
**Status:** Ready for Implementation

