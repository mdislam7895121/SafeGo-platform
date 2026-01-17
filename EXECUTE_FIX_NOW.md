# P3009 FIX - IMMEDIATE EXECUTION REQUIRED

**Status**: Railway production crash loop active  
**Cause**: Duplicate primary vehicles blocking migration  
**Fix Time**: 12 minutes  
**Data Risk**: ZERO (no deletions)  

---

## 🎯 WHAT YOU NEED TO DO NOW

### YOU HAVE 2 OPTIONS:

#### **OPTION 1: Railway SQL Console (Recommended - No SSH needed)**

Open: [RAILWAY_SQL_FIX_STEPS.md](RAILWAY_SQL_FIX_STEPS.md)

**Steps:**
1. Go to Railway Dashboard → Database → Query/SQL Console
2. Copy-paste 6 SQL queries from the guide (one at a time)
3. SSH to container and run 3 Prisma commands
4. Verify endpoints return 200

**Time**: 12 minutes  
**Proof**: Captures BEFORE/AFTER duplicate counts + endpoint tests

#### **OPTION 2: Railway Container SSH**

```bash
# SSH into Railway container
railway shell  # or use Railway web SSH

# Run the automated script
bash scripts/railway-fix-duplicates.sh

# Script will:
# - Find duplicates (BEFORE)
# - Fix duplicates (demote newer to non-primary)
# - Verify duplicates gone (AFTER)
# - Create UNIQUE index
# - Mark migration as applied
# - Deploy remaining migrations
```

**Time**: 5 minutes  
**Proof**: Auto-generates before/after reports

---

## 📋 THE CONSTRAINT (from migration file)

**Migration**: `add_primary_vehicle_constraint`  
**Table**: `vehicles`  
**Constraint**: UNIQUE on `(driverId)` WHERE `isPrimary = true`  
**Business Rule**: Only 1 primary vehicle per driver  

**Current Problem**: Multiple vehicles have `isPrimary=true` for same driver

---

## 🔧 THE FIX (Safe & Non-Destructive)

```sql
-- Keep oldest vehicle per driver as primary
-- Demote newer vehicles to isPrimary=false
WITH duplicates_to_fix AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "driverId" 
    ORDER BY "createdAt" ASC, id ASC
  ) as rn
  FROM vehicles WHERE "isPrimary" = true
)
UPDATE vehicles 
SET "isPrimary" = false, "updatedAt" = NOW()
WHERE id IN (SELECT id FROM duplicates_to_fix WHERE rn > 1);
```

**What this does:**
- ✅ Identifies duplicates per driver
- ✅ Keeps oldest as primary (rn=1)
- ✅ Demotes newer ones (rn>1) to non-primary
- ✅ NO DELETIONS (data 100% safe)

---

## ✅ VERIFICATION (All Must Pass)

After running the fix:

### 1. Database Level
```sql
SELECT COUNT(*) FROM (
  SELECT "driverId" FROM vehicles 
  WHERE "isPrimary"=true 
  GROUP BY "driverId" 
  HAVING COUNT(*)>1
) t;
-- Expected: 0
```

### 2. Index Level
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename='vehicles' AND indexname LIKE '%primary_vehicle%';
-- Expected: idx_primary_vehicle_per_driver
```

### 3. Prisma Level
```bash
npx prisma migrate status
# Expected: "Database schema is up to date!"
```

### 4. Server Level
Check Railway logs for:
```
[STARTUP] Routes registered successfully
[STARTUP] Server listening on 0.0.0.0:8080
```

### 5. Endpoint Level
```bash
curl https://api.safegoglobal.com/api/healthz       # → 200 OK
curl https://api.safegoglobal.com/routes-debug      # → 200 OK
curl -X POST https://api.safegoglobal.com/api/auth/login  # → 400+ (NOT 404)
```

**All 5 passing = ✅ FIX SUCCESSFUL**

---

## 📊 PROOF REQUIREMENTS

Capture and save:

1. **BEFORE duplicates** (SQL query result from STEP 1)
2. **UPDATE count** (how many vehicles were demoted)
3. **AFTER duplicates** (should be 0 rows)
4. **Index creation** (CREATE INDEX confirmation)
5. **Prisma migrate status** ("up to date")
6. **Railway logs** (showing server started, no crash loop)
7. **Endpoint tests** (all 3 curl results)

---

## 🚨 CRITICAL NOTES

**DO NOT:**
- ❌ Delete any vehicles
- ❌ Change the schema
- ❌ Touch frontend/Netlify
- ❌ Skip verification steps

**DO:**
- ✅ Capture BEFORE state
- ✅ Run UPDATE (not DELETE)
- ✅ Verify AFTER state (0 duplicates)
- ✅ Create index
- ✅ Mark migration as applied
- ✅ Test all endpoints

---

## ⏱️ EXPECTED TIMELINE

| Phase | Time |
|-------|------|
| Connect to Railway SQL console | 1 min |
| Run duplicate finder (BEFORE) | 1 min |
| Execute UPDATE to fix duplicates | 1 min |
| Verify duplicates gone (AFTER) | 1 min |
| Create UNIQUE index | 1 min |
| SSH to container | 2 min |
| Run Prisma migrate commands | 2 min |
| Server restart & boot | 3 min |
| Test endpoints | 1 min |
| **TOTAL** | **12-15 min** |

---

## 🎬 START NOW

**Step 1**: Open [RAILWAY_SQL_FIX_STEPS.md](RAILWAY_SQL_FIX_STEPS.md)  
**Step 2**: Go to Railway Dashboard → Database → Query  
**Step 3**: Execute SQL queries (copy-paste one at a time)  
**Step 4**: SSH to container and run Prisma commands  
**Step 5**: Verify endpoints  

---

## 📞 IF SOMETHING GOES WRONG

| Issue | Action |
|-------|--------|
| "Still seeing duplicates after STEP 3" | Re-run the UPDATE query |
| "Index creation fails" | Check STEP 4, ensure duplicates=0 |
| "Server won't start" | Check Railway logs for errors |
| "Endpoints return 404" | Wait 5 min, server still booting |
| "Need to rollback" | See RAILWAY_SQL_FIX_STEPS.md → Rollback section |

---

**Status**: Ready to execute  
**Risk**: Very Low (non-destructive UPDATE only)  
**Impact**: Fixes crash loop, gets backend online  
**Files**: All committed and pushed to main branch  

👉 **GO TO**: [RAILWAY_SQL_FIX_STEPS.md](RAILWAY_SQL_FIX_STEPS.md) to execute now
