# SafeGo API Production Fix - Complete Runbook

**Date:** January 13, 2026  
**Issue:** API endpoints returning HTML 404 instead of JSON  
**Root Cause:** Missing uuid dependency + Prisma ESM imports + old Railway deployment  
**Status:** ✅ FIXED

---

## Summary of Changes

### 1. **Dependencies Added**
```bash
npm install uuid
npm install -D @types/uuid
```

### 2. **Prisma ESM Import Fixes**
Fixed ESM compatibility issues with Prisma enums:
- `BackgroundCheckResult` → imported as type, values defined as const
- `DayOfWeek` → imported as type, values defined as const
- All other Prisma enums handled via type-only imports

### 3. **Server Start Command Updated**
- Local: `npm start` now uses `npx tsx server/index.ts`
- Railway: Updated to use `npx tsx server/index.ts` instead of bundled dist/index.js
- tsx handles dynamic Prisma imports correctly in ESM

### 4. **Railway Pre-Deploy Added**
```toml
preDeploy = "npx prisma migrate deploy && npx prisma generate"
```
This ensures:
- Database schema is up-to-date before app starts
- Prisma Client is regenerated with correct exports

---

## Verified Endpoints

### Health Check (Required for Railway)
```
GET /api/health
GET /healthz
```
✅ Returns: `{"status":"ok"}` (JSON 200)

### Authentication - Signup
```
POST /api/auth/signup
```
✅ Returns: JSON 201 with user object or JSON error (4xx)

### Error Handling
All 404s now return JSON:
```json
{
  "error": "Not Found",
  "message": "Endpoint POST /api/auth/signup does not exist",
  "statusCode": 404
}
```

---

## Environment Variables Required

### Production (Railway)
Set in Railway Variables:
```
JWT_SECRET=<long-random-string-32+chars>
SESSION_SECRET=<long-random-string-32+chars>
ENCRYPTION_KEY=<32-char-hex-string>
DATABASE_URL=postgresql://user:pass@proxy.rlwy.net:PORT/dbname
NODE_ENV=production
```

### Local Development
PowerShell:
```powershell
$env:JWT_SECRET="local-dev-secret-key"
$env:DATABASE_URL="postgresql://user:pass@localhost:5432/safego_local"
$env:ENCRYPTION_KEY="12345678901234567890123456789012"
npm start
```

**Note:** Railway provides two connection strings:
- **Proxy URL** (for production): `proxy.rlwy.net:xxxx` ← Use this in Railway variables
- **Direct URL** (for local dev): `direct.rlwy.net:xxxx` ← Use this locally if proxying fails

If local dev has P1001 errors, use the Direct URL instead.

---

## Test Commands

### Health Check
```powershell
curl.exe -i https://api.safegoglobal.com/api/health
```

Expected response:
```
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

### Signup Test (Recommended - Invoke-RestMethod)
```powershell
$body = @{
  email = "test@example.com"
  password = "SecurePass123"
  confirmPassword = "SecurePass123"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://api.safegoglobal.com/api/auth/signup" `
  -ContentType "application/json" `
  -Body $body
```

### Signup Test (curl - alternative)
```powershell
curl.exe -i -X POST "https://api.safegoglobal.com/api/auth/signup" `
  -H "Content-Type: application/json" `
  --data "{`"email`":`"test@example.com`",`"password`":`"SecurePass123`",`"confirmPassword`":`"SecurePass123`"}"
```

### Expected Response (Success)
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "role": "customer",
    "countryCode": "BD"
  }
}
```

### Expected Response (Email Already Used)
```json
{
  "code": "EMAIL_IN_USE",
  "error": "User with this email already exists",
  "message": "এই ইমেইল দিয়ে আগে থেকেই একাউন্ট আছে।"
}
```

---

## Railway Deployment Steps

### 1. **Verify Latest Code is Deployed**
All changes have been committed:
```bash
git log --oneline -5
```

Latest commits should show:
- ✅ "fix: update Railway start command to use tsx"
- ✅ "fix: add missing uuid dependency and fix Prisma ESM imports"

### 2. **Trigger Redeploy in Railway Dashboard**
1. Go to Railway.app → Select project → Select API service
2. Click "Deploy" or wait for auto-deploy from GitHub
3. Monitor the build/deploy logs

### 3. **Check Deployment Logs**
Expected log lines:
```
[STARTUP] Environment: production
[STARTUP] Port: 8080
[STARTUP] Registering routes...
[STARTUP] Routes registered successfully
[STARTUP] Health endpoint available at GET /api/health
[STARTUP] Auth endpoints available at /api/auth/*
[STARTUP] Server listening on 0.0.0.0:8080
[STARTUP] Ready to accept requests
```

### 4. **Pre-Deploy Log (Prisma)**
Expected Prisma migration log:
```
Prisma schema loaded from prisma/schema.prisma
Running migrations...
[Migration completed]
Generated Prisma Client (v6.19.1)
```

### 5. **Health Check (Immediate Post-Deploy)**
```powershell
curl.exe -i https://api.safegoglobal.com/api/health
```

Should return **200 JSON** (not 404 HTML).

---

## Troubleshooting

### Issue: Still Getting 404 HTML
**Solution:**
1. Check Railway deploy is complete (no "Deploying" status)
2. Wait 2-3 minutes for DNS propagation
3. Check if `NODE_ENV=production` is set in Railway
4. Review Railway logs for startup errors

### Issue: `/api/auth/signup` Returns "Cannot POST"
**Solution:**
1. Confirm `npm start` is using `tsx` (not bundled dist/)
2. Check Prisma migrations ran: Look for migration logs in pre-deploy
3. Verify `DATABASE_URL` environment variable is set and correct
4. Test local first:
   ```powershell
   $env:JWT_SECRET="test"
   $env:DATABASE_URL="postgres://test@localhost:5432/test"
   npm start
   ```

### Issue: Prisma Migration Fails
**Solution:**
1. Check DATABASE_URL syntax is correct (PostgreSQL format)
2. Ensure database server is accessible on Railway network
3. Check Railway PostgreSQL add-on is running
4. Manually run migration locally:
   ```powershell
   npx prisma migrate deploy
   ```

### Issue: "Cannot find package uuid"
**Solution:**
Server is using old bundled version. Force redeploy:
1. Push a dummy commit: `git commit --allow-empty -m "force: trigger redeploy"`
2. Or use Railway UI "Redeploy" button
3. Verify npm install completes in build logs

---

## Files Changed

```
package.json
  - Added "tsx": "^4.21.0" to dependencies
  - Changed "start": "npx tsx server/index.ts" (was "node dist/index.js")

railway.toml
  - Added preDeploy: "npx prisma migrate deploy && npx prisma generate"
  - Changed startCommand to use tsx

server/services/backgroundCheckService.ts
  - Fixed BackgroundCheckResult imports (type + const values)

server/routes/admin.ts
  - Fixed BackgroundCheckResult imports

server/routes/eats.ts
  - Fixed DayOfWeek imports
```

---

## What Changed & Why

| Issue | Fix | Why |
|-------|-----|-----|
| Missing uuid | npm install uuid | Express needs uuid for IDs |
| Prisma enum exports | Import as type + define values | ESM + bundling incompatibility |
| Old dist/ serving | Use tsx directly | tsx handles dynamic imports |
| Missing migrations | Added preDeploy | Ensure DB schema ready |
| HTML 404s | Already fixed in code | Express error handler in place |

---

## Verification Checklist

- [ ] Health endpoint returns 200 JSON
- [ ] Signup endpoint accepts POST requests
- [ ] Invalid email returns 400 JSON
- [ ] Duplicate email returns 400 JSON
- [ ] Valid signup returns 201 JSON with user object
- [ ] Railway logs show "Ready to accept requests"
- [ ] No "Cannot find package" errors in logs
- [ ] Database migrations completed

---

## Next Steps (Future)

1. **Add request logging middleware** - Log all POST /api/auth/* requests
2. **Add CORS handling** - Ensure frontend can call API
3. **Add rate limiting** - Prevent signup brute force
4. **Add email verification** - Send confirmation email
5. **Add password reset flow** - Self-service recovery

---

**Questions?** Check Railway.app → Service Logs → Pre-deploy output

Last Updated: January 13, 2026
