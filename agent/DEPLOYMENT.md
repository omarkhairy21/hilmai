# Hilm.ai Agent - Coolify Deployment Guide

## Prerequisites

- Coolify instance running on Hetzner server
- GitHub repository access
- Required API keys (Telegram, OpenAI, Supabase, Pinecone)

## Deployment Steps

### 1. Create New Resource in Coolify

1. Log into your Coolify dashboard
2. Click **"+ New"** → **"Resource"**
3. Select **"Public Repository"** or connect your GitHub repo
4. Repository URL: `https://github.com/yourusername/hilm.ai` (or your repo URL)
5. Build Pack: **"Dockerfile"**
6. Dockerfile Location: `agent/Dockerfile`
7. Base Directory: `agent`

### 2. Configure Build Settings

In Coolify's resource settings:

- **Port:** `4111`
- **Build Command:** (leave empty, Dockerfile handles it)
- **Start Command:** (leave empty, Dockerfile handles it)
- **Health Check Path:** `/health` (we'll add this endpoint)

### 3. Set Environment Variables

In Coolify → Resource → Environment Variables, add all variables from `.env.example`:

#### Required Variables

```bash
# Node Environment
NODE_ENV=production

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_POLLING=false
TELEGRAM_WEBHOOK_SECRET=generate_random_secret_here

# OpenAI
OPENAI_API_KEY=sk-your_key_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here

# Pinecone
PINECONE_API_KEY=your_key_here
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX=hilm-transactions

# App Settings
LOG_LEVEL=info
```

#### Generate Webhook Secret

```bash
# Generate a secure random secret
openssl rand -hex 32
```

### 4. Configure Domain (Optional)

1. In Coolify → Resource → Domains
2. Add your domain: `bot.hilm.ai` or use Coolify's generated domain
3. Enable SSL/TLS (Let's Encrypt)

### 5. Deploy

1. Click **"Deploy"** in Coolify
2. Wait for build to complete
3. Check logs for any errors

### 6. Set Up Telegram Webhook

After deployment, configure Telegram to send updates to your server:

```bash
# Replace with your values
BOT_TOKEN="your_telegram_bot_token"
WEBHOOK_URL="https://your-domain.com/telegram/webhook"
WEBHOOK_SECRET="your_webhook_secret"

# Set the webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"drop_pending_updates\": true
  }"
```

**Expected response:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### 7. Verify Webhook

```bash
# Check webhook status
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-domain.com/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 8. Test the Bot

Send a message to your bot on Telegram:
- `/start` - Should receive welcome message
- "Spent $20 on coffee" - Should process transaction
- Send a receipt photo - Should extract transaction
- Send a voice note - Should transcribe and process

## Troubleshooting

### Check Logs

In Coolify:
1. Go to your resource
2. Click **"Logs"**
3. Check for errors

### Common Issues

#### 1. Bot not responding
- Check logs for webhook errors
- Verify `TELEGRAM_POLLING=false` in production
- Check webhook URL is correct: `curl https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`

#### 2. Unauthorized webhook errors
- Verify `TELEGRAM_WEBHOOK_SECRET` matches in both Telegram and Coolify env vars
- Check webhook is receiving the `x-telegram-bot-api-secret-token` header

#### 3. Build fails
- Check Dockerfile syntax
- Verify all dependencies are in package.json
- Check build logs in Coolify

#### 4. Database connection errors
- Verify Supabase credentials
- Check network connectivity from Coolify server
- Test connection: `curl https://your-project.supabase.co`

#### 5. OpenAI/Pinecone errors
- Verify API keys are correct
- Check API quota/billing
- Test keys manually with curl

### Manual Testing

```bash
# Test health endpoint
curl https://your-domain.com/health

# Test webhook endpoint (should return 401 without secret)
curl -X POST https://your-domain.com/telegram/webhook

# Test webhook with secret
curl -X POST https://your-domain.com/telegram/webhook \
  -H "x-telegram-bot-api-secret-token: your_secret" \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1}'
```

## Coolify-Specific Configuration

### Persistent Storage

If you need to persist the Mastra database across deployments:

1. In Coolify → Resource → Storage
2. Add persistent volume:
   - **Source:** `/app/data`
   - **Destination:** `/app/data` (in container)
   - **Type:** Persistent

### Auto Deploy on Git Push

1. In Coolify → Resource → General
2. Enable **"Deploy on commit"**
3. Select branch: `main` or your deployment branch
4. Coolify will auto-deploy when you push to this branch

### Monitoring

Coolify provides:
- Resource usage graphs (CPU, Memory, Network)
- Application logs
- Health check status
- Container restart policy

## Production Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] `TELEGRAM_POLLING=false` in production
- [ ] Webhook URL uses HTTPS (not HTTP)
- [ ] Webhook secret is strong and secure
- [ ] Domain configured with SSL
- [ ] Health check endpoint responding
- [ ] Logs show no errors
- [ ] Bot responds to `/start` command
- [ ] Transaction logging works
- [ ] Receipt extraction works
- [ ] Voice transcription works
- [ ] Supabase connection verified
- [ ] Pinecone connection verified (if using RAG)

## Updating the Bot

### Via Git Push (Recommended)

If auto-deploy is enabled:
```bash
git add .
git commit -m "Update bot features"
git push origin main
```

Coolify will automatically rebuild and redeploy.

### Manual Deploy

1. Go to Coolify dashboard
2. Click your resource
3. Click **"Redeploy"**

## Rollback

If a deployment fails:

1. Go to Coolify → Resource → Deployments
2. Find previous successful deployment
3. Click **"Redeploy"** on that version

## Support

- **Coolify Docs:** https://coolify.io/docs
- **Mastra.ai Docs:** https://mastra.ai
- **Telegram Bot API:** https://core.telegram.org/bots/api

## Security Notes

- Never commit `.env` file to git
- Rotate webhook secrets periodically
- Use Coolify's secret management for sensitive values
- Enable SSL/TLS for all endpoints
- Monitor logs for suspicious activity
- Set up alerts for errors in Coolify
