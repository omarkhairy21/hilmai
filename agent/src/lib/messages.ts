import { fmt, b } from '@grammyjs/parse-mode';

export const messages = {
  start: {
    welcome: () => fmt`Welcome to HilmAI! 🤖

I'm your personal financial assistant with 3 specialized modes:

💰 ${b()}Logger Mode - Fast transaction logging
   Best for: "I spent 50 AED at Carrefour"

💬 ${b()}Chat Mode - General help (default)
   Best for: Questions, onboarding, help

📊 ${b()}Query Mode - Ask about spending
   Best for: "How much on groceries?"

💡 Getting started:
• You're in Chat Mode right now
• Use /mode to switch anytime
• Try /mode_logger for fast logging
• Use /help for detailed instructions`,

    fallback: () =>
      `Welcome to HilmAI! 🤖\n\n` +
      `I'm your personal financial assistant.\n\n` +
      `Use /mode to select your mode and get started!`,
  },

  help: {
    main: () => fmt`${b()}HilmAI Commands & Features

${b()}Track Expenses:
• Type: "I spent 50 AED at Starbucks"
• Voice: Send a voice message
• Photo: Send a receipt photo

${b()}Ask Questions:
• "How much did I spend on groceries?"
• "Show my Starbucks spending"
• "Total expenses this month"

${b()}Features:
✅ Fuzzy search (handles typos)
✅ Conversation memory
✅ Multiple languages (English & Arabic)

Just start chatting naturally!`,
  },

  mode: {
    current: (mode: string) => fmt`🎯 ${b()}Current Mode: ${mode}

Select a mode:

💰 ${b()}Logger Mode
Fast transaction logging (no conversation memory)
Best for: I spent 50 AED at Carrefour

💬 ${b()}Chat Mode
General conversation and help (default)
Best for: Questions, help, onboarding

📊 ${b()}Query Mode
Ask about your spending (minimal memory)
Best for: How much on groceries?

💡 ${b()}Quick switch commands:
/mode_logger - Switch to Logger Mode
/mode_chat - Switch to Chat Mode
/mode_query - Switch to Query Mode`,

    switchedToLogger: () => fmt`✅ ${b()}Switched to Logger Mode

💰 Fast transaction logging is now active.

${b()}How to use:
• Type: "I spent 50 AED at Carrefour"
• Send a voice message
• Send a receipt photo

Use /mode to switch modes.`,

    switchedToChat: () => fmt`✅ ${b()}Switched to Chat Mode

💬 General conversation and help is now active.

${b()}I can help you:
• Learn how to use HilmAI
• Answer questions
• Guide you to the right mode

Use /mode to switch modes.`,

    switchedToQuery: () => fmt`✅ ${b()}Switched to Query Mode

📊 Ask questions about your spending.

${b()}Examples:
• "How much on groceries?"
• "Show my spending this week"
• "Top 5 expenses this month"

Use /mode to switch modes.`,

    changed: (instructions: string) => fmt`✅ ${b()}Mode Changed

${instructions}`,
  },

  currency: {
    current: (currency: string) =>
      `💱 *Your Default Currency*\n\n` +
      `Current: *${currency}*\n\n` +
      `To change your default currency, use:\n` +
      `/currency <code>\n\n` +
      `Examples:\n` +
      `• /currency AED (UAE Dirham)\n` +
      `• /currency USD (US Dollar)\n` +
      `• /currency EUR (Euro)\n` +
      `• /currency EGP (Egyptian Pound)\n` +
      `• /currency SAR (Saudi Riyal)\n` +
      `• /currency VND (Vietnamese Dong)\n\n` +
      `We support 50+ major currencies worldwide.\n` +
      `All your transactions will be reported in ${currency}.`,

    updateSuccess: (currency: string) =>
      `✅ *Default Currency Updated*\n\n` +
      `Your default currency is now: *${currency}*\n\n` +
      `All your transactions will be reported in ${currency}. ` +
      `Transactions in other currencies will be automatically converted.`,

    invalidCode: (code: string) =>
      `❌ Invalid currency code: *${code}*\n\n` +
      `Please use a valid ISO currency code like:\n` +
      `• AED (UAE Dirham)\n` +
      `• USD (US Dollar)\n` +
      `• EUR (Euro)\n` +
      `• GBP (British Pound)\n` +
      `• SAR (Saudi Riyal)\n` +
      `• EGP (Egyptian Pound)\n` +
      `• VND (Vietnamese Dong)\n` +
      `• INR (Indian Rupee)\n\n` +
      `We support 50+ currencies. Use /currency to see your current default.`,

    updateFailed: () => '❌ Failed to update your default currency. Please try again.',
    fetchFailed: () => '❌ Failed to fetch your current currency. Please try again.',
  },

  recent: {
    empty: () =>
      '📋 *Recent Transactions*\n\n' +
      'No transactions found. Start tracking your expenses!\n\n' +
      'Try saying: "I spent 50 AED at Carrefour"',

    header: () => '📋 *Recent Transactions*',

    fetchFailed: () => "❌ Sorry, I couldn't fetch your recent transactions. Please try again.",
  },

  menu: {
    header: () => fmt`📱 ${b()}HilmAI Menu

Select an option from the menu below:`,

    addTransaction: () =>
      '💰 *Add Transaction*\n\n' +
      'You can add a transaction by:\n' +
      '• Typing: "I spent 50 AED at Carrefour"\n' +
      '• Sending a voice message\n' +
      '• Sending a receipt photo\n\n' +
      'Just send your transaction details!',

    reports: () =>
      '📊 *View Reports*\n\n' +
      'Ask me questions like:\n' +
      '• "How much did I spend this month?"\n' +
      '• "Show my spending by category"\n' +
      '• "Total expenses this week"\n\n' +
      'What would you like to know?',

    help: () =>
      '*HilmAI Help*\n\n' +
      '*Track Expenses:*\n' +
      '• Type: "I spent 50 AED at Starbucks"\n' +
      '• Voice: Send a voice message\n' +
      '• Photo: Send a receipt photo\n\n' +
      '*Ask Questions:*\n' +
      '• "How much did I spend on groceries?"\n' +
      '• "Show my Starbucks spending"\n' +
      '• "Total expenses this month"\n\n' +
      '*Commands:*\n' +
      '• /menu - Show this menu\n' +
      '• /help - Detailed help\n' +
      '• /start - Welcome message\n\n' +
      'Just start chatting naturally!',
  },

  errors: {
    noUser: () => '❌ Unable to identify user.',
    generic: () => '❌ Sorry, something went wrong. Please try again in a moment.',
    unsupportedType: () =>
      '❌ Sorry, I can only process text messages, voice messages, and photos.',
    transcribeFailed: () =>
      '❌ Sorry, I had trouble transcribing your voice message. Please try again.',
    extractFailed: () =>
      "❌ Sorry, I couldn't read that image clearly. Please try a clearer photo.",
    modeSwitchFailed: () => '❌ Failed to switch mode. Please try again.',
    fetchModeFailed: () => '❌ Failed to fetch your current mode. Please try again.',
    invalidMode: () => '❌ Invalid mode.',
  },

  callbacks: {
    noUser: () => '❌ Unable to identify user.',
    error: () => '❌ An error occurred. Please try again.',
    genericError: () => '❌ Sorry, something went wrong processing your request. Please try again.',

    editPrompt: (transactionId: number) =>
      `Editing transaction **${transactionId}**.\n\n` +
      `What would you like to change?\n\n` +
      `You can update:\n` +
      `• Amount (e.g., "Change amount to 45 AED")\n` +
      `• Merchant (e.g., "Update merchant to Carrefour")\n` +
      `• Category (e.g., "Set category to Groceries")\n` +
      `• Description (e.g., "Add description: Weekly groceries")\n` +
      `• Date (e.g., "Change date to yesterday")\n\n` +
      `Or say "cancel" to cancel.`,
  },

  // Mode-specific progress messages
  processingByMode: {
    logger: {
      start: '⏳ Logging transaction…',
      transcribing: '🎤 Transcribing voice…',
      extracting: '📸 Reading receipt…',
      categorized: '🧾 Categorizing expense…',
      currencyConversion: '💱 Converting currency…',
      saving: '💾 Saving to database…',
      finalizing: '✅ Transaction logged…',
    },
    query: {
      start: '⏳ Analyzing query…',
      transcribing: '🎤 Transcribing voice…',
      extracting: '📸 Reading query image…',
      categorized: '🔍 Searching transactions…',
      currencyConversion: '💱 Processing data…',
      saving: '🤖 Generating insights…',
      finalizing: '✅ Results ready…',
    },
    chat: {
      start: '⏳ Processing your message…',
      transcribing: '🎤 Transcribing voice…',
      extracting: '📸 Reading image…',
      categorized: '💭 Understanding context…',
      currencyConversion: '⚙️ Preparing response…',
      saving: '🤖 Thinking…',
      finalizing: '✅ Ready…',
    },
  },

  success: {
    cacheCleared: (count: number) => `✅ Cleared ${count} cached responses.`,
  },

  subscription: {
    trialWelcome: (daysLeft: number) =>
      `🎉 *Welcome to HilmAI!*\n\n` +
      `You're on a *7-day free trial* with ${daysLeft} days remaining.\n\n` +
      `After your trial ends, you'll need to subscribe to continue using HilmAI.\n\n` +
      `Use /subscribe to view our plans.`,

    trialExpired: () =>
      `⏰ *Your trial has expired*\n\n` +
      `To continue using HilmAI, please subscribe to one of our plans.\n\n` +
      `Use /subscribe to get started.`,

    accessDenied: () =>
      `🔒 *Subscription Required*\n\n` +
      `You need an active subscription to use HilmAI.\n\n` +
      `Use /subscribe to view our plans and get started.`,

    plans: () =>
      `💳 *HilmAI Subscription Plans*\n\n` +
      `Choose a plan that works for you:\n\n` +
      `📅 *Monthly Plan - $20/month*\n` +
      `• Billed monthly\n` +
      `• Cancel anytime\n` +
      `• Full access to all features\n\n` +
      `📆 *Annual Plan - $200/year*\n` +
      `• Save $40 per year\n` +
      `• Billed annually\n` +
      `• Full access to all features\n\n` +
      `🎁 *Free Trial Option*\n` +
      `• Available for monthly plans\n` +
      `• 7 days completely free\n` +
      `• No payment required during trial\n` +
      `• Cancel anytime before trial ends\n\n` +
      `Click a button below to subscribe:`,

    billingInfo: (status: string, planTier: string | null, periodEnd: string | null) => {
      let statusEmoji = '✅';
      let statusText = 'Active';

      if (status === 'trialing') {
        statusEmoji = '🎉';
        statusText = 'Trial';
      } else if (status === 'past_due') {
        statusEmoji = '⚠️';
        statusText = 'Payment Due';
      } else if (status === 'canceled') {
        statusEmoji = '❌';
        statusText = 'Canceled';
      }

      const planText =
        planTier === 'monthly'
          ? 'Monthly ($20/mo)'
          : planTier === 'annual'
            ? 'Annual ($200/yr)'
            : 'No plan';
      const renewsText = periodEnd ? `Renews: ${new Date(periodEnd).toLocaleDateString()}` : '';

      return (
        `💳 *Your Subscription*\n\n` +
        `${statusEmoji} Status: *${statusText}*\n` +
        `📋 Plan: *${planText}*\n` +
        (renewsText ? `📅 ${renewsText}\n\n` : '\n') +
        `Use the button below to manage your subscription:`
      );
    },

    trialCheckoutMessage: () =>
      `🎉 *Monthly Plan with Free Trial*\n\n` +
      `Start your 7-day free trial today!\n\n` +
      `✨ What you get:\n` +
      `• Full access to all HilmAI features\n` +
      `• No payment required for 7 days\n` +
      `• Cancel anytime before trial ends\n` +
      `• After trial: $20/month\n\n` +
      `💳 You'll need a payment method to activate the trial.\n` +
      `No charges will be made during the 7-day trial period.`,

    noTrialCheckoutMessage: () =>
      `💳 *Monthly Plan - Instant Access*\n\n` +
      `Get started with HilmAI right away!\n\n` +
      `✅ What you get:\n` +
      `• Full access to all features\n` +
      `• Billing starts immediately\n` +
      `• $20/month, cancel anytime\n` +
      `• No surprises, transparent pricing\n\n` +
      `🔒 Your payment is secure and processed by Stripe.`,

    checkoutError: () => `❌ Failed to create checkout session. Please try again.`,
    portalError: () => `❌ Failed to open billing portal. Please try again.`,

    subscriptionConfirmed: (planTier: string | null) => {
      const planName = planTier === 'monthly' ? 'Monthly Plan ($20/month)' : planTier === 'annual' ? 'Annual Plan ($200/year)' : 'Premium Plan';
      return fmt`✅ ${b()}Subscription Confirmed!

🎉 Thank you for subscribing to HilmAI!

Your ${planName} is now active.

You now have full access to all HilmAI features:
• 💰 Fast expense logging in Logger Mode
• 💬 Smart conversations in Chat Mode
• 📊 Spending insights in Query Mode
• 🎤 Voice message transcription
• 📸 Receipt photo scanning
• 💱 Multi-currency support
• 📈 Detailed spending analytics

📧 Need to manage your subscription?
Use /billing to access your subscription dashboard.

Enjoy HilmAI! 🚀`;
    },
  },
};

// Type for message return values
export type MessageResult = ReturnType<typeof fmt> | string;
