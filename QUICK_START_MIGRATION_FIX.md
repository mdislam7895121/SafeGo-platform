# QUICK REFERENCE - Railway Backend Migration Fix

## TL;DR
Railway backend was crashing on Prisma migration failure. Fixed by:
1. Adding migration resolution during deploy phase
2. Adding migration safety layer in startup code
3. Preventing crash loops by continuing startup even if migrations fail

## Current Status
✅ **Code deployed to main branch**
✅ **Railway build triggered** 
⏳ **Waiting for deployment** (5-10 minutes expected)

## What To Do Right Now

### 1. Monitor Railway Deployment
```bash
# Go to: https://railway.app/project/[PROJECT_ID]/deployments
# Look for newest build
# Status should progress: Building → Deploying → Healthy
```

### 2. Wait for Container Health
When Railway says "Container is running and healthy":
```
[STARTUP] Server listening on 0.0.0.0:8080
[STARTUP] Ready to accept requests
```

### 3. Quick Test (runs these in order)
```bash
# Test 1: Health endpoint
curl -i https://api.safegoglobal.com/api/healthz
# Expected: HTTP 200 OK

# Test 2: Routes available
curl -i https://api.safegoglobal.com/routes-debug
# Expected: HTTP 200 OK with route info

# Test 3: Auth endpoint (critical - must NOT be 404)
curl -X POST https://api.safegoglobal.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{}' \
  -i
# Expected: HTTP 400 or 401 (NOT 404)
# 404 = server not running
# 400+ = route handler executed (success)
```

## If Container Doesn't Start

### Check Log Messages
Look in Railway logs for:

**Good (migration succeeded)**:
```
[STARTUP] Checking Prisma migrations...
[MigrationGuard] Starting Prisma migration check...
[MigrationGuard] Migration check completed successfully
[STARTUP] Routes registered successfully
[STARTUP] Server listening on 0.0.0.0:8080
```

**Acceptable (migration had issues but server running)**:
```
[MigrationGuard] Migration attempt failed
[MigrationGuard] BLOCKED BY FAILED MIGRATION - Server starting in limited mode
[STARTUP] WARNING: Server starting with migration issues
[STARTUP] Routes registered successfully
```

**Bad (should NOT see this)**:
```
Stopping Container
Exit code: 1
```
If you see this, manual intervention needed.

### Manual Fix (if needed)

**Option 1: SSH into Railway and resolve manually**
```bash
# Get Railway SSH details from: https://railway.app/project/[ID]/connect
ssh into container

# Run resolution
npx prisma migrate status                           # Check status
npx prisma migrate resolve --rolled-back add_primary_vehicle_constraint
npx prisma migrate deploy                           # Deploy corrected
npx prisma migrate status                           # Verify clean
```

**Option 2: Use scripts/resolve-migration.ts**
```bash
# From local machine (with DATABASE_URL set):
npx tsx scripts/resolve-migration.ts

# Then redeploy on Railway
```

**Option 3: Last Resort - Force Rebuild**
```bash
# Push an empty commit to trigger rebuild
git commit --allow-empty -m "chore: trigger Railway rebuild"
git push origin main

# Railway will rerun deployment, migration resolution happens in deploy phase
```

## Success Indicators

All 3 should be true:

| Check | Good | Bad |
|-------|------|-----|
| Container Status | HEALTHY | STOPPING / CRASHED |
| /api/healthz | 200 OK | 404 or timeout |
| /api/auth/login | 400/401 | 404 |

## Files That Changed

| File | What | Why |
|------|------|-----|
| nixpacks.toml | Added deploy phase | Resolve migrations before server starts |
| server/index.ts | Import migrationGuard | Run migrations on startup |
| server/lib/migrationGuard.ts | NEW module | Safely try migrations without crashing |
| scripts/resolve-migration.ts | NEW script | Manual resolution tool |

## Rollback (not recommended)

```bash
# Only if absolutely critical issues
git revert 08b522e
git push origin main

# WARNING: This will bring back the original crash loop!
# Use only if you understand consequences.
```

## Key Concepts

**Migration Safety Layer** = Code that tries to run migrations but doesn't crash if they fail

**Deploy Phase** = Special build step that runs BEFORE server starts

**Resolution** = Marking failed migration as "rolled_back" so Prisma allows new migrations

**Graceful Degradation** = Server starts even if database operations fail, but health endpoints work

## Still Have Questions?

Read these in order:
1. [MIGRATION_FIX_RUNBOOK.md](MIGRATION_FIX_RUNBOOK.md) - Detailed testing procedures
2. [MIGRATION_FIX_SUMMARY.md](MIGRATION_FIX_SUMMARY.md) - Technical deep dive
3. [PROOF_OF_FIX.md](PROOF_OF_FIX.md) - Complete implementation details

## Emergency Contact

If container doesn't start within 15 minutes:
1. Check Railway logs for error messages
2. Run manual fix from "Manual Fix" section above
3. If that fails, check database connection (DATABASE_URL might be wrong)
4. Last resort: Revert commit and investigate original migration issue separately
