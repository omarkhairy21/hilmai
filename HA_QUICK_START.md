# High Availability Quick Start - 30 Minutes Setup

## Your Current Status
✅ `agent-v1` running on Coolify at `agent.hilm.ai`
❌ Load balancing not yet configured

## What We're Building
- Add `agent-v2` as a second instance
- Configure Traefik to balance traffic between both
- Enable Traefik dashboard for monitoring

---

## 10-Step Quick Setup

### Step 1: Generate Dashboard Credentials (2 min)

```bash
# Run on your local machine (or Hetzner server)
# This generates a secure password hash

htpasswd -nbB admin "choose-a-strong-password-here"
```

**Copy the output** (you'll need it in next step). Example output:
```
admin:$2y$05$...longhashhere...
```

---

### Step 2: Deploy agent-v2 in Coolify (5 min)

1. Open Coolify dashboard → **Applications**
2. Click **New Application** → **Docker**
3. Configure:
   - **Name:** `agent-v2`
   - **Image/Dockerfile:** Same as `agent-v1`
   - **Port:** `4111`
   - Copy **all environment variables** from `agent-v1`
   - Enable **Health Check** (Path: `/health`)
4. Click **Deploy**
5. Wait until status shows "Up (healthy)" ✓

---

### Step 3: Configure Traefik Dashboard (5 min)

1. Go to **Servers** → Your Hetzner Server → **Proxy** tab
2. Find **Dynamic Configuration** section (YAML editor)
3. **Replace** the entire content with this:

```yaml
http:
  middlewares:
    traefik-auth:
      basicAuth:
        users:
          - "admin:$2y$05$...YOUR-HASH-FROM-STEP-1..."

  routers:
    traefik-dashboard:
      rule: 'Host(`traefik.hilm.ai`) && PathPrefix(`/dashboard`)'
      service: api@internal
      entryPoints:
        - web
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - traefik-auth
```

**Replace:**
- `traefik.hilm.ai` → Your actual domain (can be `traefik.your-domain.com`)
- `$2y$05$...YOUR-HASH...` → Your hash from Step 1

4. Click **Save**
5. Wait 10-15 seconds for Traefik to reload

---

### Step 4: Configure Load Balancing (8 min)

1. Go back to **Servers** → **Proxy** → **Dynamic Configuration**
2. **Add this BELOW** your dashboard config:

```yaml
http:
  services:
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

  routers:
    agent-router:
      rule: 'Host(`agent.hilm.ai`)'
      service: agent-service
      entryPoints:
        - web
        - websecure
      tls:
        certResolver: letsencrypt
```

3. Click **Save**
4. Wait 10-15 seconds for Traefik to reload

---

### Step 5: Verify Dashboard is Working (2 min)

1. Open in browser: `https://traefik.hilm.ai/dashboard/`
2. **Username:** `admin`
3. **Password:** The one you chose in Step 1
4. You should see a dashboard with graphs and status

---

### Step 6: Verify Load Balancing is Working (3 min)

```bash
# From your local machine, run several times:
curl https://agent.hilm.ai/health
curl https://agent.hilm.ai/health
curl https://agent.hilm.ai/health

# Open Traefik dashboard and go to:
# Services → agent-service → You'll see request counts for both backends
```

Both `agent-v1` and `agent-v2` should have request counts increasing.

---

### Step 7: Test Failover (5 min) - CRITICAL!

```bash
# SSH into your Hetzner server
ssh root@your-server-ip

# Get the actual container name (might be different)
docker ps | grep agent

# Stop one instance
docker stop [container-name-for-agent-v1]

# Wait 30 seconds
sleep 30

# Test traffic still works
curl https://agent.hilm.ai/health
# Should succeed via agent-v2!

# Check dashboard - one instance should be RED
# Open: https://traefik.hilm.ai/dashboard/

# Restart the instance
docker start [container-name-for-agent-v1]

# Wait 30 seconds
sleep 30

# Both should be healthy again
```

**✅ If this works, you have high availability!**

---

## Troubleshooting (If Something Doesn't Work)

### Can't access dashboard
- Check domain resolves: `nslookup traefik.hilm.ai`
- Check Traefik running: `docker ps | grep traefik`
- Check YAML syntax: Make sure no tabs, proper spacing

### Instance showing unhealthy
```bash
# Check health endpoint directly
docker exec [container-name] curl http://localhost:4111/health

# Check logs
docker logs [container-name] --tail 50 | grep -i error
```

### Load balancing not working
- Verify both instances show "Up (healthy)" in Coolify
- Check Traefik dashboard shows both in `agent-service`
- Wait 30 seconds after config save for reload

---

## Verification Checklist

After completing all steps, verify:

- [ ] `agent-v2` deployed and showing "Up (healthy)" in Coolify
- [ ] Can access `https://traefik.hilm.ai/dashboard/`
- [ ] Dashboard shows `agent-service` with 2 backends
- [ ] Dashboard shows `agent-router` for `agent.hilm.ai`
- [ ] `curl https://agent.hilm.ai/health` works
- [ ] Multiple curls show requests going to both instances
- [ ] Failover test passed: stopped instance → traffic still works
- [ ] Restarted instance and it rejoined automatically

---

## That's It! 🎉

You now have:
- ✅ 2x instances for redundancy
- ✅ Load balancing across instances
- ✅ Automatic failover
- ✅ Traefik dashboard for monitoring
- ✅ Zero downtime deployments

---

## If You Get Stuck

Read the full guide: `HA_SETUP_TRAEFIK.md` in this repo

Or reference:
- Coolify Dashboard Docs: https://coolify.io/docs/knowledge-base/proxy/traefik/dashboard
- Coolify Load Balancing: https://coolify.io/docs/knowledge-base/proxy/traefik/load-balancing
