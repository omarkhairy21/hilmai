import { fmt, b } from '@grammyjs/parse-mode';

export const messages = {
  start: {
    welcome: () => fmt`👋 ${b()}Welcome to HilmAI!

I'm your AI assistant that makes expense tracking effortless.

${b()}Why HilmAI changes everything:

💬 ${b()}Just talk naturally
"I spent 50 AED at Carrefour"
No forms, no fields, no hassle.

📸 ${b()}Snap & done
Take a photo of any receipt.
I'll extract everything instantly.

🎤 ${b()}Voice messages work
Say it in any language.
I'll understand and save it.

🧠 ${b()}Smart insights
"How much on groceries?"
Get instant answers, zero effort.

${b()}Choose your mode:

💰 ${b()}Logger - Fastest logging
💬 ${b()}Chat - Ask me anything (Current)
📊 ${b()}Query - Financial insights

💡 ${b()}Try it now:
Say "I spent 100 AED at Carrefour" or /mode_logger for quick logging`,

    fallback: () =>
      `👋 Welcome to HilmAI!\n\n` +
      `Your AI assistant for effortless expense tracking.\n\n` +
      `💬 Just talk: "I spent 50 AED at Carrefour"\n` +
      `📸 Snap receipts: Instant extraction\n` +
      `🎤 Voice messages: Any language\n` +
      `🧠 Get insights: "How much on groceries?"\n\n` +
      `Try it now or use /mode to pick your style!`,
  },

  help: {
    main: () => fmt`${b()}HilmAI - Your AI Expense Tracker

${b()}📝 Track Expenses (3 ways):
• ${b()}Text: "I spent 50 AED at Starbucks"
• ${b()}Voice: Send a voice message (any language!)
• ${b()}Photo: Snap your receipt - I'll extract everything

${b()}💬 Ask Questions:
• "How much did I spend on groceries?"
• "Show my Starbucks spending this month"
• "What's my biggest expense category?"
• "Total spending this week"

${b()}🎯 3 Specialized Modes:
• ${b()}Logger Mode - Fastest for rapid logging
• ${b()}Chat Mode - Best for questions & help
• ${b()}Query Mode - Deep financial insights

${b()}⚡ Smart Features:
✅ Handles typos ("Carrefur" → "Carrefour")
✅ Remembers conversation context
✅ Multi-currency support (50+ currencies)
✅ Auto-categorization
✅ Works in English & Arabic

${b()}🚀 Quick Commands:
• /mode - Switch modes
• /recent - View recent transactions
• /currency - Set default currency
• /subscribe - View plans

Try saying: "I spent 100 AED at Carrefour for groceries"`,
  },

  mode: {
    current: (mode: string) => fmt`🎯 ${b()}Current Mode: ${mode}

${b()}Choose the mode that fits your task:

💰 ${b()}Logger Mode - Lightning Fast ⚡
${b()}No typing needed! Perfect for:
• Voice messages: "50 AED at Carrefour"
• Receipt photos: Snap & done
• Quick text: "100 AED groceries"
${b()}Speed: Instant (no memory overhead)

💬 ${b()}Chat Mode - Smart Assistant 🤖
${b()}I remember everything! Perfect for:
• Learning: "How do I track expenses?"
• Questions: "What can you do?"
• Help: "Show me my options"
${b()}Speed: Normal (with conversation memory)

📊 ${b()}Query Mode - Financial Insights 📈
${b()}Get instant answers! Perfect for:
• "How much on groceries this month?"
• "Show my Starbucks spending"
• "Top 5 expenses this week"
${b()}Speed: Fast (minimal memory)

💡 ${b()}Pro tip: Switch anytime!
/mode_logger → Fast logging
/mode_chat → Help & questions
/mode_query → Financial insights`,

    switchedToLogger: () => fmt`✅ ${b()}Logger Mode Activated!

💰 ${b()}You're now in speed mode - perfect for rapid expense tracking.

${b()}Try these:
• ${b()}Voice: Just say "50 AED at Carrefour"
• ${b()}Photo: Snap your receipt - I'll handle the rest
• ${b()}Text: "100 AED groceries"

${b()}Why Logger Mode?
✅ Fastest processing (no conversation memory)
✅ Perfect for on-the-go logging
✅ Works with voice, photo, and text

Need help? Switch to Chat Mode: /mode_chat`,

    switchedToChat: () => fmt`✅ ${b()}Chat Mode Activated!

💬 ${b()}I'm your smart assistant - ask me anything!

${b()}I can help you:
• ${b()}Learn: "How does expense tracking work?"
• ${b()}Understand: "What's the difference between modes?"
• ${b()}Navigate: "How do I see my spending?"
• ${b()}Answer: Any questions you have!

${b()}Why Chat Mode?
✅ I remember our conversation
✅ Best for learning and discovery
✅ Friendly, conversational help

Ready to log expenses? Try Logger Mode: /mode_logger`,

    switchedToQuery: () => fmt`✅ ${b()}Query Mode Activated!

📊 ${b()}Get instant insights into your spending!

${b()}Try asking:
• ${b()}"How much did I spend on groceries?"
• ${b()}"Show my Starbucks spending this month"
• ${b()}"What's my biggest expense category?"
• ${b()}"Total spending this week"

${b()}Why Query Mode?
✅ Fast financial insights
✅ Smart search (handles typos!)
✅ Multi-currency aggregation

Need to log expenses? Try Logger Mode: /mode_logger`,

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
      `✨ *What you can do during your trial:*\n` +
      `• Track unlimited expenses\n` +
      `• Use voice messages & receipt photos\n` +
      `• Get AI-powered insights\n` +
      `• Multi-currency support\n` +
      `• All 3 specialized modes\n\n` +
      `After your trial, continue for just $20/month.\n\n` +
      `Use /subscribe to view plans and secure your spot!`,

    trialExpired: () =>
      `⏰ *Your 7-day trial has ended*\n\n` +
      `Thanks for trying HilmAI! We hope you loved tracking your expenses with AI.\n\n` +
      `💡 *Continue where you left off:*\n` +
      `• All your data is saved and waiting\n` +
      `• Subscribe to regain instant access\n` +
      `• Choose monthly ($20) or annual ($200)\n\n` +
      `Ready to continue? Use /subscribe to pick a plan.`,

    accessDenied: () =>
      `🔒 *Subscription Required*\n\n` +
      `To use HilmAI, you need an active subscription.\n\n` +
      `✨ *What you'll get:*\n` +
      `• Unlimited expense tracking\n` +
      `• Voice messages & receipt scanning\n` +
      `• AI-powered categorization\n` +
      `• Multi-currency support\n` +
      `• 3 specialized tracking modes\n\n` +
      `📅 Plans start at just $20/month\n\n` +
      `Use /subscribe to get started!`,

    plans: () =>
      `💳 *Choose Your Plan*\n\n` +
      `✨ *What you get:*\n` +
      `✅ Talk, voice, or snap receipts\n` +
      `✅ AI extracts everything\n` +
      `✅ Multi-currency tracking\n` +
      `✅ Instant insights on demand\n` +
      `✅ 3 specialized modes\n` +
      `✅ Unlimited transactions\n\n` +
      `📅 *Monthly - $20/month*\n` +
      `Perfect for getting started\n` +
      `Cancel anytime, no commitment\n\n` +
      `📆 *Annual - $200/year*\n` +
      `💰 SAVE $40 (2 months free!)\n` +
      `Best value for serious trackers\n\n` +
      `🎁 *New here? Try free for 7 days!*\n` +
      `Test all features, no card needed\n\n` +
      `Choose below to get started:`,

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
      `🎉 *Start Your FREE 7-Day Trial!*\n\n` +
      `Experience HilmAI with zero commitment.\n\n` +
      `✨ *During your trial:*\n` +
      `• Full access to all features\n` +
      `• Unlimited expense tracking\n` +
      `• Voice messages & receipt photos\n` +
      `• AI-powered insights\n` +
      `• Multi-currency support\n\n` +
      `💳 *Payment Details:*\n` +
      `• We need a card to start your trial\n` +
      `• No charges for 7 days\n` +
      `• Cancel anytime during trial\n` +
      `• After trial: $20/month (cancel anytime)\n\n` +
      `🔒 *Secure checkout powered by Stripe*\n` +
      `Your data is encrypted and safe.\n\n` +
      `Click below to start your free trial!`,

    noTrialCheckoutMessage: () =>
      `💳 *Monthly Plan - Start Immediately*\n\n` +
      `Jump right in and start tracking!\n\n` +
      `✅ *What you get:*\n` +
      `• Instant access to all features\n` +
      `• Unlimited expense tracking\n` +
      `• Voice messages & receipt photos\n` +
      `• AI-powered insights\n` +
      `• Multi-currency support\n\n` +
      `💵 *Pricing:*\n` +
      `• $20/month, billed monthly\n` +
      `• Cancel anytime, no penalties\n` +
      `• Transparent pricing, no hidden fees\n` +
      `• First charge happens today\n\n` +
      `🔒 *Secure checkout powered by Stripe*\n` +
      `Your payment info is encrypted and protected.\n\n` +
      `Click below to subscribe!`,

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
