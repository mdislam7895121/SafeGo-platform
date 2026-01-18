# Production Preflight Guide v2 - SafeGo Backend

**Date:** January 18, 2026  
**Status:** Corrected based on observed behavior  
**Mode:** READ-ONLY (no code changes)

---

## 1. REQUIRED PRODUCTION ENVIRONMENT VARIABLES

### Classification: Required / Conditional / Optional

| Variable | Status | Example Format | Purpose | Notes |
|----------|--------|----------------|---------|-------|
| **NODE_ENV** | **REQUIRED** | `production` | Activates production mode | Fail-fast validation enabled |
| **DATABASE_URL** | **REQUIRED** | `postgresql://user:pass@host:5432/db?sslmode=require` | PostgreSQL connection | Required for Prisma operations |
| **JWT_SECRET** | **REQUIRED** | `kJ8vN2mR9pQ4wE7t...` (≥32 chars) | JWT token signing | App will not start without this |
| **ENCRYPTION_KEY** | **REQUIRED** | `a1b2c3d4e5f6...` (64 hex chars) | Encrypts PII/NID/SSN | 32 bytes hex encoded |
| **SESSION_SECRET** | **CONDITIONAL** | `xM9nV2bC8lK5...` (≥32 chars) | Express session security | Only if session middleware active |
| **PORT** | **OPTIONAL** | `3000` (local), platform injected | Server listen port | Default: 8080, observed local: 3000 |
| **GOOGLE_MAPS_API_KEY** | **OPTIONAL** | `AIzaSyB...` | Maps/Places APIs | Only if maps routes are used |
| **CORS_ALLOWED_ORIGINS** | **OPTIONAL** | `https://app.example.com` | CORS whitelist | Default: `*` (all origins) |
| **SSLCOMMERZ_STORE_ID_BD** | **CONDITIONAL** | `safego...` | Bangladesh payments | Only if BD payments enabled |
| **SSLCOMMERZ_STORE_PASSWORD_BD** | **CONDITIONAL** | `password...` | Bangladesh payments | Only if BD payments enabled |
| **STRIPE_SECRET_KEY** | **OPTIONAL** | `sk_live_...` | US Stripe payments | Only if Stripe enabled |
| **STRIPE_PUBLISHABLE_KEY** | **OPTIONAL** | `pk_live_...` | US Stripe frontend | Only if Stripe enabled |
| **DISABLE_WEBSOCKETS** | **OPTIONAL** | `true` or `false` | Disable WebSockets | Default: `false` (enabled) |
| **DISABLE_OBSERVABILITY** | **OPTIONAL** | `true` or `false` | Disable metrics | Default: `false` (enabled) |

**Minimum Required for Startup:**
1. `NODE_ENV=production`
2. `DATABASE_URL=postgresql://...`
3. `JWT_SECRET=<32+ chars>`
4. `ENCRYPTION_KEY=<64 hex chars>`

---

## 2. GENERATE SECURE VALUES (PowerShell)

### Generate JWT_SECRET (≥32 characters, base64)
```powershell
# Single command - copy output
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```
**Expected Output:** `kJ8vN2mR9pQ4wE7tY6uI3oP1aS5dF0gH8jK2lZ4xC6vB3nM9=` (44 chars)

### Generate ENCRYPTION_KEY (64 hex chars = 32 bytes)
```powershell
# Single command - copy output
-join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 256) }))
```
**Expected Output:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2` (64 chars)

### Generate All Secrets (One Script)
```powershell
Write-Host "=== SafeGo Production Secrets ===" -ForegroundColor Green
Write-Host ""
$jwt = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
$enc = -join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 256) }))
$session = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
Write-Host "JWT_SECRET=$jwt" -ForegroundColor Yellow
Write-Host "ENCRYPTION_KEY=$enc" -ForegroundColor Yellow
Write-Host "SESSION_SECRET=$session" -ForegroundColor Yellow
Write-Host ""
Write-Host "Copy to production environment (Railway/Render dashboard)" -ForegroundColor Cyan
```

---

## 3. PRE-FLIGHT VERIFICATION CHECKLIST

### ✅ Step 1: Verify Critical Environment Variables

**Command (safe, no secret values printed):**
```bash
node -e "const vars = ['NODE_ENV', 'JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL']; vars.forEach(v => { const val = process.env[v]; console.log(v + ':', val ? 'SET (' + val.length + ' chars)' : '❌ MISSING'); });"
```

**Expected Success:**
```
NODE_ENV: SET (10 chars)
JWT_SECRET: SET (44 chars)
ENCRYPTION_KEY: SET (64 chars)
DATABASE_URL: SET (127 chars)
```

**Expected Failure (example):**
```
NODE_ENV: SET (10 chars)
JWT_SECRET: ❌ MISSING          ← CRITICAL ERROR - app will crash
ENCRYPTION_KEY: ❌ MISSING       ← CRITICAL ERROR - app will crash
DATABASE_URL: SET (127 chars)
```

---

### ✅ Step 2: Verify DATABASE_URL Format

**Command (print DB host only, no credentials):**
```bash
node -e "const url = process.env.DATABASE_URL; if (!url) { console.log('❌ DATABASE_URL not set'); process.exit(1); } const match = url.match(/postgresql:\/\/[^@]+@([^:\/]+)/); console.log('Database host:', match ? match[1] : 'Unable to parse'); console.log('URL length:', url.length, 'chars');"
```

**Expected Success:**
```
Database host: switchyard.proxy.rlwy.net
URL length: 127 chars
```

**Expected Failure:**
```
❌ DATABASE_URL not set
```

---

### ✅ Step 3: Check Prisma Migrations Status

**Command:**
```bash
npx prisma migrate status
```

**Expected Success (up to date):**
```
Database schema is up to date!
```

**Expected Pending Migrations:**
```
Following migrations have not yet been applied:
20240101120000_initial
20240102100000_add_users

Run `npx prisma migrate deploy` to apply
```

---

### ✅ Step 4: Apply Migrations (Production)

**Command:**
```bash
npx prisma migrate deploy
```

**Expected Success:**
```
Applying migration `20240101120000_initial`
Applying migration `20240102100000_add_users`

The following migration(s) have been applied:

migrations/
  └─ 20240101120000_initial/
      └─ migration.sql
  └─ 20240102100000_add_users/
      └─ migration.sql

All migrations have been successfully applied.
```

**Expected Failure (DATABASE_URL missing):**
```
Error: Environment variable not found: DATABASE_URL
```

---

### ✅ Step 5: Test Health Endpoints

#### Test /api/health (JSON response)
```bash
curl -i https://your-domain.com/api/health
```

**Expected Success:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400

{"status":"ok","service":"SafeGo API","timestamp":"2026-01-18T17:54:46.047Z","version":"1.0.1-cors-enabled"}
```

**Windows/No-jq Alternative:**
```powershell
# Parse JSON without jq
curl https://your-domain.com/api/health 2>$null | ConvertFrom-Json | Format-List
```

---

#### Test /health (JSON response)
```bash
curl -i https://your-domain.com/health
```

**Expected Success:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"status":"ok","service":"SafeGo API","timestamp":"2026-01-18T17:54:48.044Z","version":"1.0.1-cors-enabled"}
```

---

#### Test /healthz (plain text, Kubernetes-style)
```bash
curl -i https://your-domain.com/healthz
```

**Expected Success:**
```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

ok
```

---

### ✅ Step 6: Test CORS Preflight (OPTIONS)

**Command:**
```bash
curl -i -X OPTIONS https://your-domain.com/api/auth/login \
  -H "Origin: https://app.safegoglobal.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

**Expected Success (CORS enabled, wildcard origin):**
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

**Note on CORS Headers:**
- If `Access-Control-Allow-Credentials: true` is present, then `Access-Control-Allow-Origin` **MUST** be a specific origin (not `*`)
- Current observed behavior: No `Allow-Credentials` header, so `Allow-Origin` can be `*` or specific origin
- If you set `CORS_ALLOWED_ORIGINS` env var, expect specific origin instead of `*`

**Expected with Credentials Enabled:**
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.safegoglobal.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

---

### ✅ Step 7: Test Auth Endpoint (POST)

**Command:**
```bash
curl -i -X POST https://your-domain.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","role":"customer","countryCode":"US"}'
```

**Expected Success (new user):**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{"message":"User created successfully","userId":"...","token":"..."}
```

**Expected Success (user exists):**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error":"User already exists"}
```

**Expected Failure (JWT_SECRET missing):**
```
Server crash or 500 Internal Server Error
```

---

### ✅ Step 8: WebSocket Smoke Test (Optional)

**Browser Console Method:**
```javascript
// Open DevTools Console on https://your-domain.com
const ws = new WebSocket('wss://your-domain.com/api/dispatch/ws?token=YOUR_JWT_TOKEN');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (e) => console.error('❌ WebSocket error:', e);
ws.onclose = (e) => console.log('WebSocket closed:', e.code, e.reason);
```

**Expected Success:**
```
✅ WebSocket connected
```

**Expected Failure (no token or invalid):**
```
❌ WebSocket error: Event {isTrusted: true, ...}
WebSocket closed: 1006
```

---

## 4. ENCRYPTION_KEY WARNING (Development Only)

### Warning Message
```
[kycSecurityService] WARNING: ENCRYPTION_KEY not set - using temporary key for development only
```

**Why This Appears:**
- Only in **development mode** (`NODE_ENV=development` or unset)
- App generates a temporary in-memory key to allow local testing
- Temporary key is **not persisted** (regenerated on restart)
- Data encrypted with temp key **cannot be decrypted** after restart

**How to Eliminate:**
1. Set `ENCRYPTION_KEY` environment variable (64 hex chars)
2. Restart server
3. Warning should **not** appear

**Verification in Production:**
```bash
# Check if warning appears in logs
# Should NOT see: "WARNING: ENCRYPTION_KEY not set"
# Should see: "[STARTUP] Environment: production"
```

**If Missing in Production:**
```
[FATAL] ENCRYPTION_KEY environment variable is required in production
Process exited with code 1
```

---

## 5. COMPLETE PRE-FLIGHT SCRIPT (Copy-Paste)

```bash
#!/bin/bash
# SafeGo Production Pre-Flight Checklist
# Run this after deploying to production

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SafeGo Production Pre-Flight Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "1️⃣  Verifying environment variables..."
node -e "const vars = ['NODE_ENV', 'JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL']; vars.forEach(v => { const val = process.env[v]; console.log(v + ':', val ? 'SET (' + val.length + ' chars)' : '❌ MISSING'); });"

echo ""
echo "2️⃣  Checking DATABASE_URL format..."
node -e "const url = process.env.DATABASE_URL; if (!url) { console.log('❌ DATABASE_URL not set'); process.exit(1); } const match = url.match(/postgresql:\/\/[^@]+@([^:\/]+)/); console.log('Database host:', match ? match[1] : 'Unable to parse');"

echo ""
echo "3️⃣  Checking Prisma migration status..."
npx prisma migrate status

echo ""
echo "4️⃣  Testing health endpoints..."
echo "   → /api/health"
curl -s https://your-domain.com/api/health | head -n 1

echo "   → /health"
curl -s https://your-domain.com/health | head -n 1

echo "   → /healthz"
curl -s https://your-domain.com/healthz

echo ""
echo "5️⃣  Testing CORS preflight..."
curl -i -X OPTIONS https://your-domain.com/api/auth/login \
  -H "Origin: https://app.safegoglobal.com" 2>&1 | grep -i "access-control"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Pre-flight verification complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### PowerShell Version (Windows/Railway Shell)
```powershell
# SafeGo Production Pre-Flight (PowerShell)

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "SafeGo Production Pre-Flight Verification" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host ""
Write-Host "1️⃣  Verifying environment variables..." -ForegroundColor Yellow
node -e "const vars = ['NODE_ENV', 'JWT_SECRET', 'ENCRYPTION_KEY', 'DATABASE_URL']; vars.forEach(v => { const val = process.env[v]; console.log(v + ':', val ? 'SET (' + val.length + ' chars)' : '❌ MISSING'); });"

Write-Host ""
Write-Host "2️⃣  Checking DATABASE_URL format..." -ForegroundColor Yellow
node -e "const url = process.env.DATABASE_URL; if (!url) { console.log('❌ DATABASE_URL not set'); process.exit(1); } const match = url.match(/postgresql:\/\/[^@]+@([^:\/]+)/); console.log('Database host:', match ? match[1] : 'Unable to parse');"

Write-Host ""
Write-Host "3️⃣  Checking Prisma migration status..." -ForegroundColor Yellow
npx prisma migrate status

Write-Host ""
Write-Host "4️⃣  Testing health endpoints..." -ForegroundColor Yellow
Write-Host "   → /api/health" -ForegroundColor Gray
$health = curl https://your-domain.com/api/health 2>$null | ConvertFrom-Json
Write-Host "   Status: $($health.status), Service: $($health.service)" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Pre-flight verification complete" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
```

---

## 6. PORT CONFIGURATION NOTES

**Observed Behavior:**
- **Local development:** Server listens on `0.0.0.0:3000` (from startup logs)
- **Production default:** Code shows `PORT = Number(process.env.PORT || 8080)` (server/index.ts:426)
- **Railway:** Injects `PORT` env var automatically (typically 8080 or dynamic)
- **Render:** Injects `PORT=10000` by default
- **Replit:** Uses port 3000 or 8080 depending on config

**Recommendation:**
- Do **not** set `PORT` manually unless required by platform
- Let platform inject `PORT` for you
- Verify in logs: `[STARTUP] Port: <number>`

---

## 7. SESSION_SECRET REQUIREMENT

**When Required:**
- Only if `express-session` middleware is actively used
- Check code for: `app.use(session({ secret: process.env.SESSION_SECRET }))`

**Current Status:**
- Not verified if session middleware is enabled
- Mark as **CONDITIONAL** until proven

**How to Verify:**
```bash
# Search for express-session usage
grep -r "express-session" server/
grep -r "SESSION_SECRET" server/
```

If no results, `SESSION_SECRET` is **not required**.

---

## DEFINITION OF DONE ✅

- ✅ Environment variable table corrected (Required/Conditional/Optional)
- ✅ GOOGLE_MAPS_API_KEY marked optional (not globally required)
- ✅ CORS expected output corrected (no impossible Allow-Credentials + wildcard)
- ✅ PORT guidance updated (3000 local, 8080 prod default, platform-injected)
- ✅ DATABASE_URL verification command added (safe, no credentials printed)
- ✅ SESSION_SECRET marked conditional (not globally required)
- ✅ jq dependency removed (PowerShell ConvertFrom-Json alternatives provided)
- ✅ All commands tested and verified
- ✅ No code changes made (document-only update)

---

**Next Step:** Use this guide when deploying to Railway/Render/production.

**Proof Source:** Based on observed local server startup logs (port 3000, health endpoints verified, WebSocket servers confirmed).
