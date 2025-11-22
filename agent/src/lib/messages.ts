import { fmt, b } from '@grammyjs/parse-mode';

export const messages = {
  start: {
    welcome: () => fmt`👋 ${b()}Welcome to HilmAI!

I'm your AI personal finance assistant focused on helping you understand spending, set achievable goals, and work toward financial freedom.

${b()}I help you by:
• Understanding where you're spending money
• Setting the right and achievable goals
• Providing tailored financial advice
• Tracking expenses effortlessly

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

${b()} Let's setup your account or keep talking naturally.
`,

    fallback: () =>
      `👋 Welcome to HilmAI!\n\n` +
      `Your AI assistant for effortless expense tracking.\n\n` +
      `💬 Just talk: "I spent 50 AED at Carrefour"\n` +
      `📸 Snap receipts: Instant extraction\n` +
      `🎤 Voice messages: Any language\n` +
      `🧠 Get insights: "How much on groceries?"\n\n` +
      `Try it now or use /mode to pick your style!`,

    profileSetup: () => fmt`🔧 ${b()}Let's personalize HilmAI

${b()}Step 1: Lock your default currency
Use \`/currency <code>\` so every insight stays consistent.
Examples: \`/currency AED\`, \`/currency USD\`, \`/currency EUR\`

${b()}Step 2: Set your timezone
Use \`/timezone <city|offset>\` so daily/weekly summaries match reality.
Examples: \`/timezone Dubai\`, \`/timezone +3\`, \`/timezone Asia/Kolkata\`

${b()}Step 3: Pick how you work
💰 Logger Mode — fastest capture when you're on the go
💬 Chat Mode — conversational help with memory
📊 Query Mode — instant spending breakdowns

Use the shortcuts below to finish setup, then keep logging momentum.`,

    profileCurrencyHelp: () => fmt`💱 ${b()}Default currency tips

Use the command: \`/currency <ISO code>\`

Examples:
• \`/currency AED\` (UAE Dirham)
• \`/currency USD\` (US Dollar)
• \`/currency EUR\` (Euro)
• \`/currency GBP\` (British Pound)

This keeps every report consistent while we auto-convert other currencies.`,

    profileTimezoneHelp: () => fmt`🌍 ${b()}Timezone setup

Use the command: \`/timezone <city|offset|IANA>\`

Examples:
• \`/timezone Dubai\` → Asia/Dubai
• \`/timezone +3\` → UTC+3
• \`/timezone Asia/Kolkata\`

A correct timezone ensures daily, weekly, and monthly summaries line up with your day.`,

    profileModesHelp: () => fmt`🧭 ${b()}Mode guide

${b()}Logger Mode
Fastest capture for receipts, voice, or quick text. Use \`/mode_logger\` when you need zero-drift logging.

${b()}Chat Mode
Conversational and remembers context. Use \`/mode_chat\` to ask questions, get help, or learn features.

${b()}Query Mode
Purpose-built for insights like "How much on groceries this month?" Use \`/mode_query\` and get instant answers.

Switch anytime with \`/mode\`.`,
  },

  help: {
    main: () => fmt`${b()}HilmAI - Help & Support

${b()}💬 Have Questions?
Use Chat Mode: /mode_chat
Then just ask naturally - I'm here to help!

${b()}Examples:
• "How do I track expenses?"
• "What can you do for me?"
• "How do these modes work?"
• "How do I use receipts?"

${b()}💌 Need Direct Support?
📧 Email: omar@hilm.ai or support@hilm.ai
📱 Telegram: @omark4y
💬 Or use Chat Mode above!`,
  },

  mode: {
    current: (mode: string) => fmt`🎯 ${b()}Current Mode: ${mode}

${b()}Pick a mode:

💰 ${b()}Logger Mode
Fast expense logging with voice, photos, and text.
Commands: /mode_logger

💬 ${b()}Chat Mode
Ask questions and get help with anything.
Commands: /mode_chat

📊 ${b()}Query Mode
Search spending and get financial insights.
Commands: /mode_query`,

    instructions: {
      logger: () => fmt`💰 ${b()}Logger Mode Active

Fast transaction logging - no conversation history.

${b()}How to use:
• Type: "I spent 50 AED at Carrefour"
• Send a voice message
• Send a receipt photo

${b()}Commands:
• /mode - Change mode
• /recent - View recent transactions`,

      chat: () => fmt`💬 ${b()}Chat Mode Active

General conversation and help.

${b()}I can help you:
• Learn how to use HilmAI
• Answer questions
• Guide you to the right mode

${b()}Other modes:
• /mode_logger - Fast transaction logging
• /mode_query - Ask about your spending`,

      query: () => fmt`📊 ${b()}Query Mode Active

Ask questions about your spending.

${b()}Examples:
• "How much on groceries?"
• "Show my spending this week"
• "Top 5 expenses this month"

${b()}Commands:
• /mode - Change mode
• /recent - View recent transactions`,
    },
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

  timezone: {
    invalidInput: (input: string) => fmt`❌ I didn't recognize "${input}"

Please try one of these formats:

${b()}City names: Bangkok, Dubai, New York, London, Tokyo
${b()}GMT offset: +7, -5, +5:30
${b()}IANA timezone: Asia/Bangkok, America/New_York

Use /timezone to see more options.`,
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

    editPrompt: (displayId: number) =>
      `✏️ *Edit Transaction #${displayId}*\n\n` +
      `Use the /edit command to update this transaction:\n\n` +
      `/edit ${displayId} <your changes>\n\n` +
      `*Examples:*\n` +
      `• \`/edit ${displayId} Date yesterday\`\n` +
      `• \`/edit ${displayId} Update category to Dining\`\n` +
      `• \`/edit ${displayId} Change amount to 50 AED\`\n` +
      `• \`/edit ${displayId} Update merchant to Carrefour\`\n` +
      `• \`/edit ${displayId} Add description: Weekly groceries\`\n\n` +
      `You can update: amount, merchant, category, description, or date.`,
  },

  edit: {
    invalidUsage: () =>
      `❌ *Invalid Usage*\n\n` +
      `Format: \`/edit <transaction_id> <changes>\`\n\n` +
      `*Examples:*\n` +
      `• \`/edit 18 Date yesterday\`\n` +
      `• \`/edit 18 Update category to Dining\`\n` +
      `• \`/edit 18 Change amount to 50 AED\`\n\n` +
      `What would you like to change?`,

    invalidTransactionId: () =>
      `❌ *Invalid Transaction ID*\n\n` +
      `Please provide a valid transaction ID.\n\n` +
      `Format: \`/edit <transaction_id> <changes>\`\n\n` +
      `Example: \`/edit 18 Date yesterday\``,

    missingChanges: () =>
      `❌ *Missing Changes*\n\n` +
      `Please specify what you want to change.\n\n` +
      `Format: \`/edit <transaction_id> <changes>\`\n\n` +
      `*Examples:*\n` +
      `• \`/edit 18 Date yesterday\`\n` +
      `• \`/edit 18 Update category to Dining\`\n` +
      `• \`/edit 18 Change amount to 50 AED\``,

    processing: () => `🔄 *Updating transaction...*`,

    success: () => `✅ *Transaction updated successfully!*`,

    error: () =>
      `❌ *Failed to update transaction*\n\n` +
      `Sorry, I couldn't update that transaction. Please try again or contact support if the problem persists.`,
  },

  delete: {
    confirmDelete: (displayId: number) =>
      `⚠️ *Delete Transaction #${displayId}?*\n\n` +
      `This action cannot be undone.\n\n` +
      `Use the button below to confirm deletion.`,

    deleteSuccess: (displayId: number) => `✅ *Transaction #${displayId} deleted successfully*`,

    deleteFailed: (displayId: number) =>
      `❌ *Failed to delete transaction #${displayId}*\n\n` +
      `Please try again. If the problem persists, contact support.`,
  },

  // Mode-specific progress messages
  processingByMode: {
    logger: {
      start: '⏳ Logging transaction…',
      transcribing: '🎤 Transcribing voice…',
      extracting: '📸 Reading receipt…',
      categorized: '🧾 Categorizing expense…',
      analyzing: '💭 AI thinking and saving…',
      currencyConversion: '💱 Converting currency…',
      saving: '💾 Saving to database…',
      finalizing: '✅ Transaction logged…',
    },
    query: {
      start: '⏳ Analyzing query…',
      transcribing: '🎤 Transcribing voice…',
      extracting: '📸 Reading query image…',
      categorized: '🔍 Searching transactions…',
      analyzing: '🤖 Generating insights…',
      currencyConversion: '💱 Processing data…',
      saving: '🤖 Generating insights…',
      finalizing: '✅ Results ready…',
    },
    chat: {
      start: '⏳ Processing your message…',
      transcribing: '🎤 Transcribing voice…',
      extracting: '📸 Reading image…',
      categorized: '💭 Understanding context…',
      analyzing: '🤖 Thinking…',
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
      `After your trial, continue for just $16/month.\n\n` +
      `Use /subscribe to view plans and secure your spot!`,

    trialExpired: () =>
      `⏰ *Your 7-day trial has ended*\n\n` +
      `Thanks for trying HilmAI! We hope you loved tracking your expenses with AI.\n\n` +
      `💡 *Continue where you left off:*\n` +
      `• All your data is saved and waiting\n` +
      `• Subscribe to regain instant access\n` +
      `• Choose monthly ($16) or annual ($150)\n\n` +
      `Ready to continue? Use /subscribe to pick a plan.`,

    limitReached: () =>
      `❌ *You've reached your feature limit*\n\n` +
      `To unlock unlimited access and continue tracking, subscribe to HilmAI.\n\n` +
      `✨ *What you'll get:*\n` +
      `• Unlimited expense tracking\n` +
      `• Voice messages & receipt scanning\n` +
      `• AI-powered categorization\n` +
      `• Multi-currency support\n` +
      `• 3 specialized tracking modes\n\n` +
      `💰 *Plans starting at $16/month*\n\n` +
      `Choose below to get started:`,

    subscriptionOptions: () =>
      `Which option works best for you?\n\n` +
      `📅 *Try 7 Days Free* — Then $16/month\n` +
      `Perfect to test all features\n\n` +
      `💳 *Subscribe Now* — $16/month\n` +
      `Immediate unlimited access\n\n` +
      `Choose below:`,

    accessDenied: () =>
      `🔒 *Subscription Required*\n\n` +
      `To use HilmAI, you need an active subscription.\n\n` +
      `✨ *What you'll get:*\n` +
      `• Unlimited expense tracking\n` +
      `• Voice messages & receipt scanning\n` +
      `• AI-powered categorization\n` +
      `• Multi-currency support\n` +
      `• 3 specialized tracking modes\n\n` +
      `📅 Plans start at just $16/month\n\n` +
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
      `📅 *Monthly - $16/month*\n` +
      `Perfect for getting started\n` +
      `Cancel anytime, no commitment\n\n` +
      `📆 *Annual - $150/year*\n` +
      `💰 SAVE $42 (3.5 months free!)\n` +
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
          ? 'Monthly ($16/mo)'
          : planTier === 'annual'
            ? 'Annual ($150/yr)'
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
      `• After trial: $16/month (cancel anytime)\n\n` +
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
      `• $16/month, billed monthly\n` +
      `• Cancel anytime, no penalties\n` +
      `• Transparent pricing, no hidden fees\n` +
      `• First charge happens today\n\n` +
      `🔒 *Secure checkout powered by Stripe*\n` +
      `Your payment info is encrypted and protected.\n\n` +
      `Click below to subscribe!`,

    checkoutError: () => `❌ Failed to create checkout session. Please try again.`,
    portalError: () => `❌ Failed to open billing portal. Please try again.`,

    subscriptionConfirmed: (planTier: string | null) => {
      const planName =
        planTier === 'monthly'
          ? 'Monthly Plan ($16/month)'
          : planTier === 'annual'
            ? 'Annual Plan ($150/year)'
            : 'Premium Plan';
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
