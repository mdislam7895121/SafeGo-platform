-- Fix: Recover from failed add_primary_vehicle_constraint migration
-- This migration safely:
-- 1. Cleans up duplicate primary vehicles (keeps oldest)
-- 2. Ensures the UNIQUE index exists
-- 3. Is fully idempotent (can run multiple times safely)

-- Step 1: Identify and mark duplicate isPrimary vehicles as non-primary
-- Keep only the oldest vehicle per driver marked as primary
DELETE FROM vehicles v1
WHERE v1."isPrimary" = true
  AND EXISTS (
    SELECT 1 FROM vehicles v2
    WHERE v2."driverId" = v1."driverId"
      AND v2."isPrimary" = true
      AND (v2."createdAt" < v1."createdAt"
           OR (v2."createdAt" = v1."createdAt" AND v2."id" < v1."id"))
  );

-- Step 2: Ensure the UNIQUE partial index exists
-- This prevents future duplicate primary vehicles
CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_vehicle_per_driver 
ON vehicles ("driverId") 
WHERE "isPrimary" = true;
