#!/bin/bash
set -e
echo "=============================================="
echo "SAFEGO PRODUCTION STARTUP"
echo "=============================================="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "NODE_ENV: ${NODE_ENV:-production}"
echo "=============================================="
run_migrations() {
  local tool=$1
  local cmd=$2
  local MAX_RETRIES=3
  local RETRY_COUNT=0

  echo "[Deploy] Running $tool migrations..."

  until $cmd; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "[Deploy] FATAL: $tool migrations failed after $MAX_RETRIES attempts"
      return 1
    fi
    echo "[Deploy] $tool migration attempt $RETRY_COUNT failed, retrying in 5s..."
    sleep 5
  done

  echo "[Deploy] $tool migrations complete"
  return 0
}
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  if ! run_migrations "Prisma" "npx prisma migrate deploy"; then
    echo "[Deploy] FATAL: Prisma migrations failed. Aborting startup."
    exit 1
  fi

  if ! run_migrations "Drizzle" "npm run db:push"; then
    echo "[Deploy] FATAL: Drizzle schema sync failed. Aborting startup."
    exit 1
  fi

  echo "[Deploy] All migrations complete"
else
  echo "[Deploy] Skipping migrations (SKIP_MIGRATIONS=true)"
fi
echo "[Deploy] Starting application server..."
exec node dist/index.js
