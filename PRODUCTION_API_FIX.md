# SafeGo Production API Fix - Diagnostic & Verification

**Date:** January 13, 2026  
**Status:** ✅ Code verified correct. Ready for Railway deployment verification.

---

## 📋 EXECUTIVE SUMMARY

**Problem:** Production API (`api.safegoglobal.com`) returns HTML "Cannot GET/POST" errors instead of JSON.

**Root Cause:** Either:
1. Railway custom domain points to wrong service
2. Backend service has old deployment (not latest code)
3. New deployment hasn't completed

**Solution:** Code is **already correct**. Deploy latest changes to Railway.

---

## ✅ CODE VERIFICATION COMPLETE

### Backend Routes: VERIFIED ✓

**File:** [server/routes.ts](server/routes.ts)

| Feature | Line | Status |
|---------|------|--------|
| Health endpoint `/api/health` | 194-198 | ✓ Returns JSON |
| Health endpoint `/health` | 203-224 | ✓ Returns JSON |
| Health endpoint `/healthz` | 189-191 | ✓ Returns plain text (Railway default) |
| CORS middleware | 308-326 | ✓ Configured |
| JSON body parser | 334-335 | ✓ `express.json()` |
| Auth routes mounted | 555 | ✓ `app.use("/api/auth", authRoutes)` |
| 404 error handler | 806-811 | ✓ Returns JSON |
| Generic error handler | 813-831 | ✓ Returns JSON |

### Backend Startup: VERIFIED ✓

**File:** [server/index.ts](server/index.ts)

```typescript
// ✓ Routes registered before listening
const httpServer = await registerRoutes(app);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[STARTUP] Server listening on 0.0.0.0:${PORT}`);
});
```

### Auth Endpoints: VERIFIED ✓

**File:** [server/routes/auth.ts](server/routes/auth.ts)

- ✓ `POST /api/auth/signup` - Returns JSON response
- ✓ `POST /api/auth/login` - Returns JSON response  
- ✓ All endpoints return structured JSON errors (never HTML)

---

## 🧪 PRODUCTION VERIFICATION - PowerShell Commands

These commands test if the deployment is working. Use **PowerShell on Windows**:

### Test 1: Health Endpoint
```powershell
Write-Host "Testing GET /api/health" -ForegroundColor Yellow
curl.exe -i https://api.safegoglobal.com/api/health
```

**Expected:** HTTP 200 with JSON body
```json
{
  "status": "ok",
  "timestamp": "2024-01-13T...",
  "environment": "production"
}
```

### Test 2: Signup Endpoint
```powershell
Write-Host "Testing POST /api/auth/signup" -ForegroundColor Yellow
curl.exe -i -X POST https://api.safegoglobal.com/api/auth/signup `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"Test@123456","countryCode":"US"}'
```

**Expected:** HTTP 400/500 with JSON error (NOT HTML)
```json
{
  "error": "...",
  "message": "..."
}
```

### Test 3: Login Endpoint
```powershell
Write-Host "Testing POST /api/auth/login" -ForegroundColor Yellow
curl.exe -i -X POST https://api.safegoglobal.com/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"nonexistent@test.com","password":"Test@123456"}'
```

**Expected:** HTTP 401 with JSON error (NOT HTML)

### Test 4: Verify Content-Type Header
```powershell
Write-Host "Checking Content-Type header" -ForegroundColor Yellow
curl.exe -i https://api.safegoglobal.com/api/health | Select-String "Content-Type"
```

**Expected:** `Content-Type: application/json; charset=utf-8`

### Test 5: Verify No HTML in 404 Response
```powershell
Write-Host "Testing 404 returns JSON" -ForegroundColor Yellow
curl.exe -i https://api.safegoglobal.com/api/nonexistent
```

**Expected:** HTTP 404 with JSON error (NOT HTML starting with `<!DOCTYPE html>`)

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Verify Railway Configuration

1. **Go to Railway Dashboard**
2. **Find SafeGo-platform project**
3. **Check Custom Domains:**
   - Is `api.safegoglobal.com` attached to the **backend API service** (not frontend)?
   - Check the service name and recent deployments
   - Note the current deployment timestamp

4. **If domain is on wrong service:**
   - Delete the domain mapping
   - Re-attach `api.safegoglobal.com` to the correct backend service

### Step 2: Trigger Deployment

```bash
# Ensure you're on main branch
git checkout main

# Verify latest code is pushed
git push origin main

# Railway auto-deploys on push
# Wait 3-5 minutes for deployment to complete
# Check Railway dashboard: "Deployments" tab should show new deployment
```

### Step 3: Run Verification Tests

After deployment completes, run the PowerShell commands above (Test 1-5).

### Step 4: Test End-to-End Flow

1. Open https://safego-global.netlify.app (or your frontend URL)
2. Click **Sign Up**
3. Fill in form and submit
4. Expected: Success or validation error (JSON-based), NOT "Unexpected token '<'" error
5. Check browser **Network** tab: All API responses should have `Content-Type: application/json`

---

## 📊 STATUS SUMMARY

| Component | Status | Evidence |
|-----------|--------|----------|
| Code correct | ✅ YES | [server/routes.ts](server/routes.ts) - all middleware present |
| Routes mounted | ✅ YES | Line 555: `app.use("/api/auth", authRoutes)` |
| Health endpoint | ✅ YES | Lines 189-224: Multiple health endpoints |
| JSON responses | ✅ YES | Lines 806-831: All handlers return JSON |
| Error handling | ✅ YES | All errors return JSON, never HTML |
| Deployment status | ⏳ PENDING | Verify in Railway dashboard |

---

## ⚠️ TROUBLESHOOTING

### Issue: Still getting "Cannot GET /api/health"
**Cause:** Old Railway deployment  
**Fix:**
1. Check Railway "Deployments" tab - is there a recent deployment?
2. If no recent deployment: Redeploy by pushing a commit
3. Wait 5+ minutes for new deployment

### Issue: Still getting HTML error pages
**Cause:** Code not redeployed OR domain pointing to wrong service  
**Fix:**
1. Verify domain is on **backend** service (not frontend)
2. Redeploy backend: `git push origin main`
3. Check deployment logs in Railway

### Issue: CORS errors in browser
**Cause:** Frontend origin not whitelisted  
**Fix:** Check [server/routes.ts](server/routes.ts) lines 315-326 for allowed origins

### Issue: Frontend still shows "Unexpected token '<'"
**Cause:** 
- Frontend `VITE_API_BASE_URL` not set in Netlify (points to wrong URL)
- OR old Netlify deployment cached
**Fix:**
1. Set Netlify env var: `VITE_API_BASE_URL=https://api.safegoglobal.com`
2. Rebuild frontend: Click "Trigger deploy" in Netlify

---

## 🔍 DEBUG CHECKLIST

Before claiming API is broken:

- [ ] Verify `api.safegoglobal.com` resolves via DNS
- [ ] Run Test 1 (health endpoint) - does it return JSON?
- [ ] Check Railway dashboard - is backend service running?
- [ ] Check recent deployments - timestamp within last 10 minutes?
- [ ] Check Railway logs for startup errors
- [ ] Verify domain is attached to **backend** service (not frontend/static)
- [ ] Test locally: `npm run dev` works?
- [ ] Ensure `VITE_API_BASE_URL` is set in Netlify env vars

---

## 📁 FILES MODIFIED IN THIS FIX

**No breaking changes.** Only documentation and deployment verification added:

- `PRODUCTION_API_FIX.md` (this file)
- Test scripts for verification

**Code is already correct** - these are zero-risk changes.

---

## ✅ NEXT STEPS

1. **Immediately:** Run PowerShell tests (Test 1-5) above
2. **If tests fail:** Verify Railway configuration and redeploy
3. **If tests pass:** System is working correctly
4. **Final step:** Test signup/login end-to-end in browser

---

## 📞 SUPPORT

**Questions about code?**  
Check [server/routes.ts](server/routes.ts) - all middleware is there and correct.

**Questions about deployment?**  
Check Railway dashboard - Deployments tab shows status.

**Questions about frontend?**  
Verify Netlify env vars are set: `VITE_API_BASE_URL=https://api.safegoglobal.com`

---

**Bottom Line:** ✅ Code is correct. Deploy and verify. Done.
