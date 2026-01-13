# SafeGo API - Quick Test Guide

## Current Status
✅ **Code Fixed:** All issues resolved locally  
🔄 **Railway Deploy:** In progress (auto-deploy from GitHub)  
⏳ **ETA:** 5-10 minutes for full deployment

---

## Test These Commands NOW

### 1. Health Check (Simple)
```powershell
curl.exe -i https://api.safegoglobal.com/api/health
```

**Expected Response (when deployed):**
```
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

**Current Status:** Returns 404 HTML (old deployment still active)

---

### 2. Signup Test (With PowerShell)
```powershell
$body = @{
  email = "testuser$(Get-Random)@example.com"
  password = "SafeGoTest123"
  confirmPassword = "SafeGoTest123"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://api.safegoglobal.com/api/auth/signup" `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json
```

**Expected Response (when deployed):**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "testuser123@example.com",
    "role": "customer",
    "countryCode": "BD"
  }
}
```

**Current Status:** Returns 404 HTML (old deployment still active)

---

### 3. Signup Error Test (Invalid Email)
```powershell
$body = @{
  email = "invalid-email"
  password = "SafeGoTest123"
  confirmPassword = "SafeGoTest123"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://api.safegoglobal.com/api/auth/signup" `
  -ContentType "application/json" `
  -Body $body -ErrorAction SilentlyContinue | ConvertTo-Json
```

**Expected Response:**
```json
{
  "code": "INVALID_EMAIL",
  "error": "Please enter a valid email address",
  "message": "সঠিক ইমেইল ঠিকানা দিন।"
}
```

---

## What Gets Deployed to Railway

### Files Changed (5 files)
1. ✅ `package.json` - Added tsx dependency, changed start script
2. ✅ `railway.toml` - Added pre-deploy Prisma migrate
3. ✅ `server/services/backgroundCheckService.ts` - Fixed BackgroundCheckResult imports
4. ✅ `server/routes/admin.ts` - Fixed BackgroundCheckResult imports  
5. ✅ `server/routes/eats.ts` - Fixed DayOfWeek imports

### Build Process on Railway
```
1. npm install        (includes tsx)
2. npm run build      (esbuild)
3. [PRE-DEPLOY]       npx prisma migrate deploy
4. [PRE-DEPLOY]       npx prisma generate
5. npm start          npx tsx server/index.ts
6. Health check       GET /healthz
7. Server ready       Listen on 0.0.0.0:8080
```

---

## Commits Pushed (Latest First)
```
d60b0fa - docs: add comprehensive implementation summary
d3d8e06 - feat: add Railway pre-deploy Prisma migration and production runbook
05356c4 - fix: update Railway start command to use tsx
e69db64 - fix: add missing uuid dependency and fix Prisma ESM imports
```

---

## Why This Fix Works

| Problem | Solution | Why |
|---------|----------|-----|
| `uuid` not found | `npm install uuid` | Services use UUID generator |
| Prisma enum exports fail | Import as type + const values | ESM + bundling incompatibility |
| Old dist/ has broken imports | Use `tsx` directly | Dynamic TypeScript handling |
| DB schema out-of-date | Add `preDeploy` migrate | Ensure schema ready before app |

---

## Monitor Deployment

### Railway Dashboard
1. Go to https://railway.app
2. Select Project → API Service
3. Check status:
   - ✅ **Active** = Deployed and ready
   - 🔄 **Deploying** = Building now
   - ❌ **Failed** = Check logs

### Check Logs for Success
Look for these lines:
```
[STARTUP] Routes registered successfully
[STARTUP] Health endpoint available at GET /api/health
[STARTUP] Server listening on 0.0.0.0:8080
[STARTUP] Ready to accept requests
```

Look for these (pre-deploy):
```
Prisma schema loaded from prisma/schema.prisma
Running migrations...
Generated Prisma Client (v6.19.1)
```

---

## Troubleshooting

### Still Getting HTML 404?
→ Railway deployment hasn't finished yet
→ Wait 5-10 minutes
→ Force redeploy in Railway dashboard if needed

### Getting Permission Errors?
→ Check all env vars are set in Railway
→ Especially: JWT_SECRET, DATABASE_URL, NODE_ENV=production

### Database Connection Error?
→ Check DATABASE_URL is set correctly (use proxy URL)
→ Verify Railway PostgreSQL add-on is running
→ Check pre-deploy logs for migration errors

---

## Local Testing (If You Need To)

### Start Local Server
```powershell
$env:JWT_SECRET="test-secret-key"
$env:DATABASE_URL="postgresql://localhost/safego_test"
npm start
```

### Test Local Health
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/health" -UseBasicParsing
```

### Test Local Signup
```powershell
$body = @{
  email = "local@test.com"
  password = "TestPass123"
  confirmPassword = "TestPass123"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8080/api/auth/signup" `
  -ContentType "application/json" `
  -Body $body
```

---

## Success Criteria ✅

- [ ] `/api/health` returns 200 JSON
- [ ] `/api/auth/signup` accepts POST requests
- [ ] Valid signup returns 201 JSON with user object
- [ ] Invalid input returns 400 JSON (not HTML)
- [ ] Duplicate email returns 400 JSON (not HTML)
- [ ] Railway logs show "Ready to accept requests"
- [ ] No "Cannot find package uuid" errors
- [ ] No Prisma import errors in logs

---

## Next Steps

Once verified working:
1. ✅ Health check passing
2. ✅ Signup endpoint working
3. ✅ Error responses are JSON

Then consider:
- Add request logging for debugging
- Implement rate limiting on signup
- Add email verification flow
- Set up monitoring/alerting

---

**Questions?** Check:
- [PRODUCTION_FIX_RUNBOOK.md](./PRODUCTION_FIX_RUNBOOK.md) - Detailed guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Technical details
- Railway logs - Real-time status

**Last Updated:** January 13, 2026
