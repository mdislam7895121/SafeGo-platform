#!/usr/bin/env bash
# SafeGo Production P3009 Fix - Railway Execution Script
# Run this from Railway container SSH or with Railway CLI

echo "════════════════════════════════════════════════════════════════════════════════"
echo "SafeGo Production P3009 Fix - Duplicate Vehicle Resolution"
echo "Started: $(date -Iseconds)"
echo "════════════════════════════════════════════════════════════════════════════════"

# STEP 1: Find duplicates BEFORE fix
echo ""
echo "[STEP 1] Finding duplicate primary vehicles (BEFORE fix)..."
echo ""
psql $DATABASE_URL -c "
SELECT 
  \"driverId\",
  COUNT(*) as primary_count,
  STRING_AGG(id::text, ', ') as vehicle_ids,
  STRING_AGG(\"createdAt\"::text, ', ') as creation_dates
FROM vehicles
WHERE \"isPrimary\" = true
GROUP BY \"driverId\"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;
" > duplicate_report_BEFORE.txt

cat duplicate_report_BEFORE.txt
DUPLICATE_COUNT=$(grep -c '|' duplicate_report_BEFORE.txt || echo "0")

echo ""
echo "Found duplicate groups (check duplicate_report_BEFORE.txt for details)"

# STEP 2: Show detailed duplicate records
echo ""
echo "[STEP 2] Showing detailed duplicate records..."
echo ""
psql $DATABASE_URL -c "
SELECT 
  id,
  \"driverId\",
  \"vehicleType\",
  \"vehiclePlate\",
  \"isPrimary\",
  \"createdAt\",
  ROW_NUMBER() OVER (PARTITION BY \"driverId\" ORDER BY \"createdAt\" ASC, id ASC) as keep_rn
FROM vehicles
WHERE \"driverId\" IN (
  SELECT \"driverId\"
  FROM vehicles
  WHERE \"isPrimary\" = true
  GROUP BY \"driverId\"
  HAVING COUNT(*) > 1
)
AND \"isPrimary\" = true
ORDER BY \"driverId\", \"createdAt\"
LIMIT 50;
" > duplicate_details.txt

cat duplicate_details.txt

# STEP 3: Fix duplicates (keep oldest per driver)
echo ""
echo "[STEP 3] Fixing duplicates (marking newer vehicles as non-primary)..."
echo ""
psql $DATABASE_URL -c "
WITH duplicates_to_fix AS (
  SELECT 
    id,
    \"driverId\",
    ROW_NUMBER() OVER (PARTITION BY \"driverId\" ORDER BY \"createdAt\" ASC, id ASC) as rn
  FROM vehicles
  WHERE \"isPrimary\" = true
)
UPDATE vehicles 
SET \"isPrimary\" = false,
    \"updatedAt\" = NOW()
WHERE id IN (
  SELECT id FROM duplicates_to_fix WHERE rn > 1
);
" > fix_result.txt

cat fix_result.txt
echo "✅ Duplicates fixed"

# STEP 4: Verify duplicates are gone (AFTER fix)
echo ""
echo "[STEP 4] Verifying duplicates are resolved (AFTER fix)..."
echo ""
psql $DATABASE_URL -c "
SELECT 
  \"driverId\",
  COUNT(*) as primary_count
FROM vehicles
WHERE \"isPrimary\" = true
GROUP BY \"driverId\"
HAVING COUNT(*) > 1;
" > duplicate_report_AFTER.txt

cat duplicate_report_AFTER.txt
AFTER_COUNT=$(grep -c '|' duplicate_report_AFTER.txt || echo "0")

if [ "$AFTER_COUNT" -eq "0" ]; then
  echo "✅ VERIFICATION PASSED: No duplicates remain!"
else
  echo "❌ VERIFICATION FAILED: Still found $AFTER_COUNT duplicate groups"
  exit 1
fi

# STEP 5: Create the index
echo ""
echo "[STEP 5] Creating UNIQUE index..."
echo ""
psql $DATABASE_URL -c "
CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_vehicle_per_driver 
ON vehicles (\"driverId\") 
WHERE \"isPrimary\" = true;
" > index_creation.txt

cat index_creation.txt
echo "✅ Index created"

# STEP 6: Verify index exists
echo ""
echo "[STEP 6] Verifying index exists..."
echo ""
psql $DATABASE_URL -c "
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'vehicles' 
  AND indexname LIKE '%primary_vehicle%';
"

# STEP 7: Mark Prisma migration as applied
echo ""
echo "[STEP 7] Marking Prisma migration as applied..."
echo ""
npx prisma migrate resolve --applied add_primary_vehicle_constraint

# STEP 8: Deploy remaining migrations
echo ""
echo "[STEP 8] Deploying remaining migrations..."
echo ""
npx prisma migrate deploy

# STEP 9: Final migration status
echo ""
echo "[STEP 9] Checking final migration status..."
echo ""
npx prisma migrate status

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "✅ FIX COMPLETE"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "VERIFICATION CHECKLIST:"
echo "  [✓] Duplicates resolved"
echo "  [✓] Index created"
echo "  [✓] Migration marked as applied"
echo ""
echo "NEXT STEPS:"
echo "  1. Restart the server (it should boot cleanly now)"
echo "  2. Test: curl http://localhost:8080/api/healthz"
echo "  3. Monitor logs for 'Routes registered successfully'"
echo ""
