# Railway Production Fix - Execute These SQL Commands

**How to use this guide:**
1. Go to Railway Dashboard → SafeGo Backend Service → Database Tab
2. Open "Query" or "SQL Console"
3. Copy-paste each SQL block below, ONE AT A TIME
4. Save the results for proof

---

## STEP 1: Find Duplicates (BEFORE Fix)

**Copy-paste this query:**

```sql
SELECT 
  "driverId",
  COUNT(*) as primary_count,
  STRING_AGG(id::text, ', ') as vehicle_ids,
  STRING_AGG("createdAt"::text, ', ') as creation_dates
FROM vehicles
WHERE "isPrimary" = true
GROUP BY "driverId"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;
```

**Expected output:** List of drivers with duplicate primary vehicles

**Save this output as "BEFORE_duplicates.txt"**

---

## STEP 2: Show Detailed Duplicate Records

**Copy-paste this query:**

```sql
SELECT 
  id,
  "driverId",
  "vehicleType",
  "vehiclePlate",
  "isPrimary",
  "createdAt",
  ROW_NUMBER() OVER (PARTITION BY "driverId" ORDER BY "createdAt" ASC, id ASC) as keep_rn
FROM vehicles
WHERE "driverId" IN (
  SELECT "driverId"
  FROM vehicles
  WHERE "isPrimary" = true
  GROUP BY "driverId"
  HAVING COUNT(*) > 1
)
AND "isPrimary" = true
ORDER BY "driverId", "createdAt"
LIMIT 50;
```

**Expected output:** Detailed list showing which vehicles will be kept (keep_rn=1) vs demoted (keep_rn>1)

**Note:** keep_rn=1 means this vehicle STAYS primary (oldest one per driver)

---

## STEP 3: FIX DUPLICATES (Execute Carefully)

**⚠️ This UPDATE changes data. Read the output from STEP 2 first!**

**Copy-paste this query:**

```sql
WITH duplicates_to_fix AS (
  SELECT 
    id,
    "driverId",
    ROW_NUMBER() OVER (PARTITION BY "driverId" ORDER BY "createdAt" ASC, id ASC) as rn
  FROM vehicles
  WHERE "isPrimary" = true
)
UPDATE vehicles 
SET "isPrimary" = false,
    "updatedAt" = NOW()
WHERE id IN (
  SELECT id FROM duplicates_to_fix WHERE rn > 1
)
RETURNING id, "driverId", "vehicleType";
```

**Expected output:** `UPDATE [N]` where N = number of vehicles demoted to non-primary

**Save the count (e.g., "UPDATE 5" means 5 vehicles were updated)**

---

## STEP 4: Verify Duplicates Are Gone (AFTER Fix)

**Copy-paste this query:**

```sql
SELECT 
  "driverId",
  COUNT(*) as primary_count
FROM vehicles
WHERE "isPrimary" = true
GROUP BY "driverId"
HAVING COUNT(*) > 1;
```

**Expected output:** EMPTY RESULT SET (0 rows)

**If you get any rows, the fix didn't work. Contact support.**

**Save this output as "AFTER_duplicates.txt"**

---

## STEP 5: Create the UNIQUE Index

**Copy-paste this query:**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_vehicle_per_driver 
ON vehicles ("driverId") 
WHERE "isPrimary" = true;
```

**Expected output:** `CREATE INDEX`

**If you get an error about duplicates, go back to STEP 4 and verify**

---

## STEP 6: Verify Index Was Created

**Copy-paste this query:**

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'vehicles' 
  AND indexname LIKE '%primary_vehicle%';
```

**Expected output:** 1 row showing `idx_primary_vehicle_per_driver` and its definition

---

## STEP 7: SSH into Railway Container and Run Prisma Commands

**From your local terminal:**

```bash
# SSH into Railway container (use Railway CLI or web SSH)
railway shell

# Mark the migration as applied (since we manually applied the constraint)
npx prisma migrate resolve --applied add_primary_vehicle_constraint

# Deploy any remaining migrations
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

**Expected output from migrate status:**
```
Database schema is up to date!
```

---

## STEP 8: Restart the Server

**Option A: Railway will auto-restart after migration**

**Option B: Manual restart via Railway dashboard**
- Go to Deployments tab
- Click "Restart" on the active deployment

**Option C: Trigger via code push**
```bash
git commit --allow-empty -m "chore: trigger Railway restart after migration fix"
git push origin main
```

---

## STEP 9: Verify Backend is Healthy

**Wait 2-3 minutes for server to boot, then test:**

```bash
# Test 1: Health endpoint
curl -i https://api.safegoglobal.com/api/healthz
# Expected: HTTP/1.1 200 OK

# Test 2: Routes debug
curl -i https://api.safegoglobal.com/routes-debug
# Expected: HTTP/1.1 200 OK (with list of routes)

# Test 3: Auth endpoint
curl -X POST https://api.safegoglobal.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: HTTP/1.1 400 or 401 (NOT 404)
```

**If all 3 return expected responses: ✅ FIX SUCCESSFUL**

---

## PROOF CHECKLIST

Save these for verification:

- [ ] BEFORE_duplicates.txt (from STEP 1)
- [ ] Detailed duplicate records (from STEP 2)
- [ ] UPDATE count (from STEP 3)
- [ ] AFTER_duplicates.txt - should be empty (from STEP 4)
- [ ] Index creation confirmation (from STEP 5)
- [ ] Index verification (from STEP 6)
- [ ] `npx prisma migrate status` output
- [ ] Railway logs showing "Routes registered successfully"
- [ ] All 3 curl test responses (200 OK for health, 400+ for auth)

---

## ROLLBACK (If Needed)

If something goes wrong:

```sql
-- Restore previous state (if you have the vehicle IDs from STEP 2)
UPDATE vehicles
SET "isPrimary" = true,
    "updatedAt" = NOW()
WHERE id IN (
  -- Paste the vehicle IDs that were demoted
  'id1', 'id2', 'id3'
);

-- Drop the index
DROP INDEX IF EXISTS idx_primary_vehicle_per_driver;

-- Mark migration as rolled back
-- (run via SSH)
npx prisma migrate resolve --rolled-back add_primary_vehicle_constraint
```

---

## ESTIMATED TIME

- SQL queries (STEP 1-6): 5 minutes
- Prisma commands (STEP 7): 2 minutes
- Server restart (STEP 8): 3 minutes
- Verification (STEP 9): 2 minutes

**Total: ~12 minutes**

---

## QUESTIONS?

- "What if STEP 4 still shows duplicates?" → Re-run STEP 3
- "What if index creation fails?" → Check STEP 4 output, ensure duplicates are gone
- "What if server still won't start?" → Check Railway logs for errors
- "What if endpoints still return 404?" → Wait 5 minutes, server may still be starting

---

**Ready to execute? Start with STEP 1 above.**
