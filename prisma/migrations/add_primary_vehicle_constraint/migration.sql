-- D1-A: Add UNIQUE partial index to enforce single primary vehicle per driver
-- This database-level constraint prevents ALL race conditions for duplicate primaries
-- Applied: 2025-11-24
CREATE UNIQUE INDEX IF NOT EXISTS idx_primary_vehicle_per_driver 
ON vehicles ("driverId") 
WHERE "isPrimary" = true;
