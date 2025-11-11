# High Availability Setup with Coolify + Traefik Load Balancing

## Your Current Setup
- **Existing App:** `agent-v1` deployed on Coolify at `agent.hilm.ai`
- **Goal:** Add `agent-v1-instance-2` as a second instance for load balancing with Traefik

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Hetzner Server                        │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Traefik (Built-in Coolify Reverse Proxy)        │   │
│  │  - Port 80/443 entry point                       │   │
│  │  - Load balancing with health checks             │   │
│  │  - Auto-failover between instances               │   │
│  │  - HTTPS/TLS via Let's Encrypt                   │   │
│  └──────────────────────────────────────────────────┘   │
│           │                         │                     │
│  ┌────────▼──────────┐   ┌──────────▼────────────┐      │
│  │ agent-v1          │   │ agent-v1-instance-2   │      │
│  │ (Existing)        │   │ (New)                 │      │
│  │ Port 4111         │   │ Port 4111             │      │
│  │ Auto-restart      │   │ Auto-restart          │      │
│  └───────────────────┘   └───────────────────────┘      │
│           │                         │                     │
│  ┌────────▼──────────────────────────▼─────┐            │
│  │  Shared Resources                        │            │
│  │  - Supabase (remote)                     │            │
│  │  - LibSQL database                       │            │
│  │  - Stripe webhooks                       │            │
│  │  - Telegram Bot API                      │            │
│  └──────────────────────────────────────────┘            │
│                                                           │
│  Domain: agent.hilm.ai (Load Balanced)                   │
└─────────────────────────────────────────────────────────┘
```

## Benefits

✅ **No Additional Software** — Traefik already built into Coolify
✅ **Zero Downtime Deployments** — Rolling updates with health checks
✅ **Automatic Failover** — Dead instances removed from load balancer pool
✅ **Load Distribution** — Round-robin across both instances
✅ **Self-Healing** — Docker auto-restart + Traefik health checks
✅ **Easy Scaling** — Can add `agent-v3`, `agent-v4` later via Coolify UI

---

## Step 1: Create Second Instance (`agent-v2`) in Coolify

### In Coolify Dashboard:

1. **Applications** → **New Application** → **Docker**

2. **Configure with identical settings to `agent-v1`:**

   | Setting | Value |
   |---------|-------|
   | **Name** | `agent-v2` |
   | **Image/Dockerfile** | Same as `agent-v1` |
   | **Port** | `4111` (internal) |
   | **Environment Variables** | Copy all from `agent-v1` |
   | **Health Check Path** | `/health` |
   | **Health Check Interval** | `30s` |
   | **Health Check Timeout** | `10s` |
   | **Auto-restart** | Enabled |

3. **Traefik Labels** (Important!):
   ```
   traefik.enable=true
   traefik.http.services.agent.loadbalancer.server.port=4111
   traefik.http.services.agent.loadbalancer.healthcheck.path=/health
   traefik.http.services.agent.loadbalancer.healthcheck.interval=30s
   ```

4. **Deploy** and verify it's healthy (Status: "Running")

---

## Step 2: Access Traefik Dashboard

### Generate Credentials

First, generate secure credentials for dashboard access:

```bash
# On your local machine or Hetzner server
# Install htpasswd if needed (macOS: already installed, Linux: apt install apache2-utils)
htpasswd -nbB admin your-secure-password
```

**Output will look like:**
```
admin:$2y$05$your-hash-here
```

Copy this output (you'll need it in next step).

### Configure Dashboard in Coolify

1. Go to **Servers** → Your Hetzner Server → **Proxy** tab

2. In **Dynamic Configuration**, add:

```yaml
# Traefik Dashboard Configuration
http:
  middlewares:
    traefik-auth:
      basicAuth:
        users:
          # Replace with output from htpasswd command above
          - "admin:$2y$05$your-hash-here"

  routers:
    traefik-dashboard:
      rule: 'Host(`traefik.yourdomain.com`) && PathPrefix(`/dashboard`)'
      service: api@internal
      entryPoints:
        - web
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - traefik-auth

  services:
    api:
      # This is internal Traefik API service
      # No configuration needed
```

**Replace `traefik.yourdomain.com` with your actual domain** (e.g., `traefik.hilm.ai`).

3. Save and wait for configuration to reload

### Access Dashboard

**URL:** `https://traefik.yourdomain.com/dashboard/`

**Username:** `admin`
**Password:** The password you used in `htpasswd` command

---

## Step 3: Configure Traefik Load Balancing

In the same Coolify **Dynamic Configuration** section, add the load balancer config:

```yaml
http:
  services:
    # Dashboard authentication
    traefik-auth:
      basicAuth:
        users:
          - "admin:$2y$05$your-hash-here"

    # Load balanced agent service
    agent-service:
      loadBalancer:
        servers:
          - url: 'http://agent-v1:4111'
          - url: 'http://agent-v2:4111'
        healthCheck:
          path: /health
          interval: 30s
          timeout: 10s
          scheme: http
        sticky:
          cookie:
            httpOnly: true
            secure: true
            sameSite: 'lax'
            name: 'Agent-Session'

  routers:
    # Dashboard router
    traefik-dashboard:
      rule: 'Host(`traefik.yourdomain.com`) && PathPrefix(`/dashboard`)'
      service: api@internal
      entryPoints:
        - web
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - traefik-auth

    # Agent API router (your main app)
    agent-router:
      rule: 'Host(`agent.hilm.ai`)'
      service: agent-service
      entryPoints:
        - web
        - websecure
      tls:
        certResolver: letsencrypt
```

### Save Configuration

Click **Save** in Coolify and wait 10-15 seconds for Traefik to reload.

---

## Step 4: Verify Configuration via Dashboard

1. **Open** `https://traefik.yourdomain.com/dashboard/`
2. **Login** with credentials (admin / your-password)
3. **Navigate to:**
   - **Services** → Should see `agent-service` with 2 servers
   - **Routers** → Should see `agent-router` for `agent.hilm.ai`
4. **Status indicators:**
   - Green = Healthy and handling traffic
   - Red = Unhealthy, traffic diverted

---

## Step 5: Verify Load Balancing is Working

### Test 1: Both instances responding

```bash
# From your local machine
curl -i https://agent.hilm.ai/health
curl -i https://agent.hilm.ai/health
curl -i https://agent.hilm.ai/health

# Check logs to see which instance handled each request
```

### Test 2: Watch Traffic in Dashboard

1. Open `https://traefik.yourdomain.com/dashboard/`
2. Go to **Services** → `agent-service`
3. Make requests to `https://agent.hilm.ai/health`
4. Watch request counts increment on both backends

### Test 3: Verify health checks

```bash
# SSH into Hetzner server
ssh root@your-server

# Check container status
docker ps | grep agent

# Output should show both "Up (healthy)"
```

---

## Step 6: Test Failover (Critical!)

This verifies high availability actually works:

### Simulate Instance Failure

```bash
# SSH into your Hetzner server
ssh root@your-server

# Stop agent-v1 to simulate failure
docker stop hilm-agent-v1

# Wait 30 seconds for health check to mark it unhealthy
sleep 30

# Test that traffic still works via agent-v2
curl -i https://agent.hilm.ai/health  # Should work!

# Check dashboard - agent-v1 should show RED (unhealthy)
```

### Verify Recovery

```bash
# Restart agent-v1
docker start hilm-agent-v1

# Wait 30 seconds for health check to pass
sleep 30

# Verify both handling traffic again
curl -i https://agent.hilm.ai/health
curl -i https://agent.hilm.ai/health

# Check dashboard - both should be GREEN again
```

---

## Step 7: Configure Graceful Shutdown (Optional but Recommended)

Add to your `agent/src/mastra/index.ts`:

```typescript
// At the end of the file

import { createServer } from 'http';

// Graceful shutdown signal handler
async function setupGracefulShutdown(server: any) {
  const handleShutdown = async (signal: string) => {
    logger.info(`${signal} signal received: closing gracefully`);

    // Step 1: Stop accepting new requests (Traefik will remove from load balancer)
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    // Step 2: Stop polling bot if running
    if (bot) {
      try {
        await bot.stop();
        logger.info('Telegram bot stopped');
      } catch (error) {
        logger.error('Error stopping bot', { error });
      }
    }

    // Step 3: Graceful cleanup of Mastra instance
    try {
      if (mastra && typeof mastra.stop === 'function') {
        await mastra.stop();
        logger.info('Mastra instance stopped');
      }
    } catch (error) {
      logger.error('Error stopping Mastra', { error });
    }

    // Step 4: Exit with success
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  // Listen for shutdown signals
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Force shutdown after 30 seconds if not graceful
  setTimeout(() => {
    logger.error('Graceful shutdown timeout (30s), forcing exit');
    process.exit(1);
  }, 30000);
}

// Export for use in server startup
export { setupGracefulShutdown };
```

---

## Step 8: Verify Health Endpoint is Correct

Check your `/health` endpoint returns proper status codes:

```typescript
// In agent/src/mastra/index.ts - verify this looks correct

registerApiRoute('/health', {
  method: 'GET',
  handler: async (c: any) => {
    try {
      // Respond with 200 = healthy
      return c.json(
        {
          status: 'ok',
          service: 'hilm-ai-agent-v2',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
        200  // ✅ IMPORTANT: Return 200 status
      );
    } catch (error) {
      // Return 503 if unhealthy (Traefik removes from load balancer)
      return c.json(
        { status: 'error', message: 'Service unhealthy' },
        503
      );
    }
  },
})
```

---

## Step 9: Update Deployment Process

When deploying code updates:

### Option 1: Rolling Update (No Downtime - Recommended)

```bash
# 1. Update agent-v2 first in Coolify
#    - Click Deploy/Redeploy
#    - All traffic routes through agent-v1 while agent-v2 restarts
#    - Wait for agent-v2 to be healthy (30-60 seconds)

# 2. Update agent-v1 in Coolify
#    - Click Deploy/Redeploy
#    - All traffic routes through agent-v2 while agent-v1 restarts
#    - Wait for agent-v1 to be healthy (30-60 seconds)

# Result: Zero downtime, gradual rollout
```

### Option 2: Manual Rolling Deployment (with git)

```bash
# On your Hetzner server
cd /path/to/agent

# 1. Pull latest code
git pull

# 2. Trigger redeploy for agent-v2 in Coolify UI
#    Then wait for healthy status

# 3. Trigger redeploy for agent-v1 in Coolify UI
#    Then wait for healthy status
```

---

## Step 10: Monitoring & Alerting

### View Logs (Both Instances)

```bash
# SSH into server
ssh root@your-server

# Agent V1 logs
docker logs -f hilm-agent-v1 --tail 100

# Agent V2 logs (in another terminal)
docker logs -f hilm-agent-v2 --tail 100

# Traefik logs
docker logs -f traefik --tail 100
```

### Monitor via Dashboard

1. Visit `https://traefik.yourdomain.com/dashboard/`
2. Watch in real-time:
   - Request rates per instance
   - Response times
   - Health status
   - Active connections

### Optional: Set Up Alerts

Integrate with:
- **Sentry** (error tracking)
- **Datadog** (monitoring)
- **Slack webhooks** (notifications)
- **PagerDuty** (on-call alerting)

---

## Production Checklist

Before MVP launch:

- [ ] `agent-v2` deployed and healthy in Coolify UI
- [ ] Traefik dashboard accessible at `https://traefik.yourdomain.com/dashboard/`
- [ ] Both instances show "Up (healthy)" in Coolify and dashboard
- [ ] `/health` endpoint returns 200 on both instances
- [ ] Load balancing working: requests alternate between instances
- [ ] HTTPS/TLS working (certificate issued via Let's Encrypt)
- [ ] **Failover test PASSED:** Stop one instance → traffic still works → restart and rejoin
- [ ] No errors in logs when receiving traffic on both instances
- [ ] Database connections don't conflict (both using same Supabase service role)
- [ ] Telegram bot webhook configured correctly
- [ ] Stripe webhooks work properly
- [ ] Traffic distribution looks balanced in dashboard

---

## Troubleshooting

### Can't Access Dashboard

**Problem:** 401 Unauthorized or can't reach URL

**Solution:**
```bash
# 1. Verify domain DNS points to server
nslookup traefik.yourdomain.com

# 2. Check Traefik is running
docker ps | grep traefik

# 3. Check dynamic config has no YAML errors
# Open Coolify UI → Servers → Proxy → check for red error messages

# 4. Verify basicAuth credentials are correct
# Re-run htpasswd command and update config
```

### Instances showing "unhealthy" in Traefik

**Check 1:** Health endpoint accessible
```bash
docker exec hilm-agent-v1 curl -v http://localhost:4111/health
```

**Check 2:** View container logs
```bash
docker logs hilm-agent-v1 --tail 50 | grep -i error
```

**Check 3:** Check database connectivity
```bash
docker exec hilm-agent-v1 env | grep SUPABASE
# Verify SUPABASE_URL and SUPABASE_KEY are correct
```

### Traffic not balanced equally

**Reason:** Sticky sessions enabled (configured for session persistence)
- Each user stays on same instance (good for stateful operations)
- Check Traefik dashboard to see per-instance request counts

**To disable sticky sessions** (less recommended):
```yaml
# Remove this section from agent-service config:
# sticky:
#   cookie:
#     httpOnly: true
#     secure: true
#     sameSite: 'lax'
#     name: 'Agent-Session'
```

### One instance keeps restarting

```bash
# Check restart logs
docker logs hilm-agent-v1 --tail 200 | tail -50

# Possible causes:
# 1. Out of memory → check: docker stats hilm-agent-v1
# 2. DB connection issue → verify SUPABASE_* env vars
# 3. Invalid API key → verify OPENAI_API_KEY, TELEGRAM_BOT_TOKEN
# 4. Port conflict → verify: netstat -tlnp | grep 4111
# 5. Disk space → check: df -h
```

### Traefik config not loading

```bash
# Verify YAML syntax:
# - No tabs (only spaces)
# - Proper indentation (2 spaces)
# - Check for typos in keys

# Check Traefik logs
docker logs traefik --tail 100 | grep -i error

# If needed, reload Traefik
docker restart traefik
```

---

## Next Steps (Timeline)

### Today
1. Generate credentials for dashboard (`htpasswd` command)
2. Deploy `agent-v2` in Coolify (copy of `agent-v1`)
3. Verify both instances healthy

### This Week (Before MVP Launch)
4. Add Traefik load balancing configuration + dashboard
5. Access and monitor Traefik dashboard
6. Test failover scenario (stop instance, verify recovery)
7. Monitor logs for any issues

### Optional (After MVP Launch)
8. Fine-tune load balancing (sticky sessions, timeouts)
9. Add monitoring/alerting (Sentry, Datadog)
10. Consider adding `agent-v3` for extra redundancy

---

## Key Concepts

**Health Checks:** Traefik periodically calls `/health` endpoint
- If returns 200 → instance considered healthy
- If returns 500/503 → instance marked unhealthy, traffic diverted
- If fails 3 times → instance removed from load balancer

**Load Balancing:** Requests distributed across healthy instances
- Sticky sessions keep same user on same instance (for Telegram state)
- Each new user/session may go to different instance

**Traefik Dashboard:** Real-time monitoring UI
- See all services and routers
- Monitor request rates and response times
- Identify unhealthy backends
- Access controlled with basic auth

**Graceful Shutdown:** When Traefik removes instance
- Container receives SIGTERM signal
- App has 30 seconds to finish requests and cleanup
- After 30s, container forcefully killed

**Zero Downtime Deployments:** Update one instance at a time
- Update agent-v2 first (v1 handles all traffic)
- When v2 ready, update agent-v1 (v2 handles all traffic)
- Users never see downtime

---

## Resources

- **Coolify Traefik Dashboard:** https://coolify.io/docs/knowledge-base/proxy/traefik/dashboard
- **Coolify Traefik Load Balancing:** https://coolify.io/docs/knowledge-base/proxy/traefik/load-balancing
- **Traefik Official Docs:** https://doc.traefik.io/traefik/
- **Docker Health Checks:** https://docs.docker.com/engine/reference/builder/#healthcheck
