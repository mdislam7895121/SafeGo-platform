-- D1-A: Add UNIQUE partial index to enforce single primary vehicle per driver
-- SAFETY FIX: Handle existing data with multiple primary vehicles per driver

-- Step 1: For each driver with multiple isPrimary=true, keep only the oldest (by createdAt)
-- This prevents constraint violations from existing data
WITH duplicates AS (
  SELECT 
    id,
    driverId,
    ROW_NUMBER() OVER (PARTITION BY "driverId" ORDER BY "createdAt" ASC) as rn
  FROM vehicles
  WHERE "isPrimary" = true
)
UPDATE vehicles 
SET "isPrimary" = false
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Create the UNIQUE partial index
-- IF NOT EXISTS ensures idempotency in case Prisma re-runs this migration
CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_vehicle_per_driver 
ON vehicles ("driverId") 
WHERE "isPrimary" = true;
