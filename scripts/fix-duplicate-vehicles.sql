-- SafeGo Production Migration Fix: add_primary_vehicle_constraint
-- This script resolves the duplicate primary vehicle issue safely

-- STEP 1: Identify the exact problem
-- Count drivers with multiple isPrimary=true vehicles
SELECT 
  "driverId",
  COUNT(*) as primary_vehicle_count,
  STRING_AGG(id::text, ', ') as vehicle_ids,
  STRING_AGG("createdAt"::text, ', ') as creation_dates
FROM vehicles
WHERE "isPrimary" = true
GROUP BY "driverId"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- STEP 2: Show the duplicate vehicles with details
SELECT 
  id,
  "driverId",
  "vehicleType",
  "vehiclePlate",
  "isPrimary",
  "createdAt",
  ROW_NUMBER() OVER (PARTITION BY "driverId" ORDER BY "createdAt" ASC) as rn
FROM vehicles
WHERE "driverId" IN (
  SELECT "driverId"
  FROM vehicles
  WHERE "isPrimary" = true
  GROUP BY "driverId"
  HAVING COUNT(*) > 1
)
AND "isPrimary" = true
ORDER BY "driverId", "createdAt";

-- STEP 3: SAFE FIX - Mark duplicates (keep oldest as primary)
-- This UPDATE approach is non-destructive (no data deletion)
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
);

-- STEP 4: Verify the fix was applied
-- Count drivers with multiple isPrimary=true (should be 0)
SELECT 
  "driverId",
  COUNT(*) as primary_vehicle_count
FROM vehicles
WHERE "isPrimary" = true
GROUP BY "driverId"
HAVING COUNT(*) > 1;

-- STEP 5: Create the UNIQUE index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_vehicle_per_driver 
ON vehicles ("driverId") 
WHERE "isPrimary" = true;

-- STEP 6: Verify index was created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'vehicles' 
  AND indexname LIKE '%primary_vehicle%';

-- STEP 7: Final validation - show one primary vehicle per driver
SELECT 
  v.id,
  v."driverId",
  v."vehicleType",
  v."vehiclePlate",
  v."isPrimary",
  v."createdAt"
FROM vehicles v
INNER JOIN (
  SELECT "driverId"
  FROM vehicles
  WHERE "isPrimary" = true
  GROUP BY "driverId"
  HAVING COUNT(*) = 1
) valid ON v."driverId" = valid."driverId"
WHERE v."isPrimary" = true
ORDER BY v."driverId"
LIMIT 10;
