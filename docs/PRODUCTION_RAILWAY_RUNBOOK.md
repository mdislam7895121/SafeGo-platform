# SafeGo Production Deployment Runbook - Railway

**Last Updated**: January 2026  
**Scope**: Backend API deployment on Railway  
**Audience**: DevOps, Platform Engineers, On-Call Support

---

## 1. Quick Reference

| Item | Value |
|------|-------|
| **Runtime Entry** | `node dist/index.cjs` |
| **Source** | `server/index.ts` → esbuild → `dist/index.cjs` |
| **Healthcheck** | `GET /api/healthz` |
| **Start Command** | `npm run start` or `npm start` |
| **Build Command** | `npm install && npm run build` |
| **Listening** | `0.0.0.0:<PORT>` (port injected by Railway) |

---

## 2. Required Environment Variables

| Variable | Required | Format | Purpose |
|----------|----------|--------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | Database access |
| `JWT_SECRET` | ✅ Yes | 256-bit hex or base64 string | Session signing |
| `ENCRYPTION_KEY` | ✅ Yes | 32-byte UTF-8 or 64-char hex | Data encryption |
| `NODE_ENV` | ✅ Yes | `production` | Runtime mode |
| `PORT` | ⚠️ Railway injects | Integer, typically 8080 | Server port binding |
| `SESSION_SECRET` | ⚠️ Conditional | String | Session management |
| `GOOGLE_MAPS_API_KEY` | ❌ Optional | API Key | Maps integration |
| `STRIPE_SECRET_KEY` | ❌ Optional | sk_test_* / sk_live_* | Payment processing |
| `OPENAI_API_KEY` | ❌ Optional | API Key | SafePilot AI features |

**Setup in Railway:**
1. Go to your project → Variables tab
2. Add all **Required** and **Conditional** variables
3. Railway automatically sets `PORT` (typically 8080)
4. Save and redeploy

---

## 3. PORT Handling & Fallback Behavior

### How It Works

```typescript
// server/index.ts PORT resolution
const rawPort = process.env.PORT;
const PORT = rawPort ? Number(rawPort) : 3000;  // fallback to 3000 if not set
const HOST = "0.0.0.0";

// Validate: if PORT was provided but invalid, crash
if (rawPort && Number.isNaN(PORT)) {
  console.error("[FATAL] PORT is not numeric:", rawPort);
  process.exit(1);
}
```

### In Different Environments

| Environment | PORT Value | Source |
|-------------|-----------|--------|
| **Railway** | 8080 (or assigned) | Railway injected `PORT` env var |
| **Local Dev** | 3000 | Fallback when PORT not set |
| **Render/Heroku** | 10000+ | Injected by platform |

### Why Fallback to 3000?

- Allows local development without environment setup
- Does NOT hardcode 3000 in production (Railway overrides via env var)
- Non-breaking: if Railway fails to inject PORT, app still starts (graceful degradation)

---

## 4. Boot Diagnostics Log

Watch for this line in Railway deployment logs:

```
[BOOT] runtime=dist/index.cjs host=0.0.0.0 rawPort=8080 port=8080
```

**Breakdown:**
- `runtime=dist/index.cjs` → confirms correct entrypoint
- `host=0.0.0.0` → listening on all interfaces (required for containers)
- `rawPort=8080` → what Railway injected
- `port=8080` → what the app is using

**If You See:**
- `rawPort=null port=3000` → Railway did NOT inject PORT (fallback active)
- `rawPort=8080 port=8080` → Normal production (Railway injected)
- `[FATAL] PORT is not numeric: xyz` → Invalid PORT value, investigate Railway env

---

## 5. Health Endpoint Verification

The `/api/healthz` endpoint is your primary diagnostic:

```bash
# Default Railway domain
curl -i https://<project>-production.up.railway.app/api/healthz

# Custom domain (if configured)
curl -i https://api.safegoglobal.com/api/healthz
```

**Expected Response (200 OK):**
```json
{
  "ok": true,
  "service": "SafeGo-platform",
  "env": "production",
  "ts": "2026-01-19T02:30:45.123Z"
}
```

**Troubleshooting:**
- `502 Bad Gateway` → App not running, check logs
- `404 Not Found` → Endpoint not registered, check routes.ts
- `503 Service Unavailable` → Health checks blocked by middleware, check CORS

---

## 6. Deployment Verification Checklist

### Pre-Deploy
- [ ] All env vars set in Railway Variables tab
- [ ] `DATABASE_URL` connects to correct database
- [ ] `JWT_SECRET` and `ENCRYPTION_KEY` are strong (>32 chars)
- [ ] `NODE_ENV=production`

### Post-Deploy (First 5 Minutes)
- [ ] Railway logs show no crash/restart loop
- [ ] Check for `[BOOT]` line with correct port
- [ ] `curl /api/healthz` returns 200 on both domains
- [ ] No `[FATAL]` errors in logs

### Post-Deploy (After 5 Minutes)
- [ ] Application handles requests (try login endpoint)
- [ ] Database migrations completed successfully
- [ ] WebSocket servers initialized (dispatch, admin, food orders)
- [ ] No error spikes in monitoring

---

## 7. Common Issues & Quick Fixes

### Issue: 502 Bad Gateway on First Load

**Cause 1: Health endpoint timeout**
```
[STARTUP] Checking Prisma migrations...
```
If you see this hanging >30s:
- Check `DATABASE_URL` connectivity
- Verify database credentials
- Run `prisma db push` locally to test

**Cause 2: Missing environment variables**
```
[FATAL] JWT_SECRET is not set
```
Solution:
1. Go to Railway project → Variables
2. Add `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`
3. Redeploy

**Cause 3: PORT not injected**
```
[BOOT] runtime=dist/index.cjs host=0.0.0.0 rawPort=null port=3000
```
Solution:
1. Railway should auto-inject PORT
2. If not, manually add `PORT=8080` to Variables
3. Redeploy

### Issue: Repeated Restarts (Crash Loop)

**Check logs for:**
1. `process.exit(1)` → Fatal error, see line above it
2. Out of memory → Check WebSocket connection limits
3. Database connection lost → Check `DATABASE_URL` validity

### Issue: Health Endpoint 404

**Cause:** Middleware blocking early requests
```typescript
// server/index.ts line 53
app.get("/api/healthz", ...)  // must be before app.use(authMiddleware)
```

If `/api/healthz` is 404:
- Verify it's registered before auth middleware
- Check routes.ts for conflicts
- Restart deployment

---

## 8. Reading Railway Logs

### What to Look For

**Successful Boot:**
```
[NotificationService] FCM not configured, using mock mode
[STARTUP] Environment: production
[STARTUP] Port: 8080
[STARTUP] Checking Prisma migrations...
[MigrationGuard] Migration check completed successfully
[STARTUP] Routes registered successfully
[STARTUP] Health endpoints: GET /health, GET /api/health, GET /healthz
[BOOT] runtime=dist/index.cjs host=0.0.0.0 rawPort=8080 port=8080
[STARTUP] Server listening on 0.0.0.0:8080
[STARTUP] Ready to accept requests
```

**Missing PORT (Fallback):**
```
[BOOT] runtime=dist/index.cjs host=0.0.0.0 rawPort=null port=3000
```
→ Railway env var not set, but app is running on fallback. Check Variables tab.

**Fatal Error:**
```
[FATAL] JWT_SECRET is not set
```
→ Stop immediately. Add missing env var and redeploy.

---

## 9. Advanced: Full Deployment Walkthrough

### Step 1: Push Code
```bash
git add .
git commit -m "production: [description]"
git push origin main
```

### Step 2: Railway Auto-Triggers Build
- NIXPACKS detects package.json
- Runs: `npm install && npm run build`
- Output: `dist/index.cjs` (5.9 MB typical)

### Step 3: Railway Auto-Starts App
- Runs: `node dist/index.cjs`
- PORT injected: typically 8080
- Expected boot: 10-30 seconds

### Step 4: Verify
```bash
# Check boot log
curl https://<railway-domain>/api/healthz

# Should return 200 JSON with ok:true
```

### Step 5: Monitor First 5 Minutes
- Check Railway logs for errors
- Verify no crash/restart loops
- Monitor requests to /api/auth/login

---

## 10. Rollback Procedure

If deployment fails and customers are affected:

### Option A: Revert to Last Known Good Commit
```bash
git log --oneline | head -5  # find last good commit
git revert <commit-hash>
git push origin main
```
Railway auto-redeploys, typically live in 2-5 minutes.

### Option B: Disable Problematic Feature
Set `DISABLE_<FEATURE>=true` in Railway Variables and redeploy:
- `DISABLE_WEBSOCKETS=true` → Disable all WebSocket servers
- `DISABLE_AUDIT=true` → Disable audit logging
- `DISABLE_NOTIFICATIONS=true` → Disable notifications

Restart from Railway UI (takes ~30s).

---

## 11. Contact & Escalation

| Issue | Channel |
|-------|---------|
| Railway infrastructure down | Railway status page |
| Database connectivity | Database provider support |
| Authentication failures | Check JWT_SECRET/ENCRYPTION_KEY |
| WebSocket errors | Check browser console + server logs |
| Payment processing | Stripe/SSLCommerz dashboards |

---

## 12. Monitoring Setup (Recommended)

Add to your monitoring system:

```bash
# Health endpoint SLA: 99.9%
curl -s https://api.safegoglobal.com/api/healthz | grep -q "ok" || alert "SafeGo healthz failed"

# Response time SLA: <200ms
time curl -s https://api.safegoglobal.com/api/healthz > /dev/null

# Restart count: should be 0 per day in normal ops
# Check: Railway Deployments tab, "Restarts" column
```

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial production runbook |

---

**Last Verified**: January 19, 2026  
**Status**: ✅ Production Ready
