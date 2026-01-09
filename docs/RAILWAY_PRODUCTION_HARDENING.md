# Railway Production Hardening Guide

## Overview

This document provides the complete configuration and deployment guide for SafeGo on Railway, ensuring permanent stability and eliminating 502 errors.

---

## 1. PORT AND NETWORKING

### Application Configuration
The server binds to:
- **Port**: `process.env.PORT` with fallback to `5000`
- **Host**: `0.0.0.0` (required for Railway)
- **File**: `server/index.ts` lines 120-132

```typescript
const port = parseInt(process.env.PORT || '5000', 10);
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
});
```

### Railway Settings
| Setting | Value |
|---------|-------|
| **Target Port** | `5000` (auto-detected from PORT env) |
| **Protocol** | HTTP |
| **Health Check Path** | `/api/health` |
| **Health Check Timeout** | 30 seconds |

---

## 2. REQUIRED ENVIRONMENT VARIABLES

### Critical (App will NOT start without these in production)
| Variable | Format | Description |
|----------|--------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` | Railway Postgres URL (NEVER localhost) |
| `JWT_SECRET` | 64+ hex chars | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | 64 hex chars | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SESSION_SECRET` | 64+ hex chars | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_MAPS_API_KEY` | Google API key | Required for maps functionality |
| `NODE_ENV` | `production` | Enables production mode |

### Optional (Warnings only, app still starts)
| Variable | Format | Description |
|----------|--------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe payments (US) |
| `SSLCOMMERZ_STORE_ID_BD` | Store ID | SSLCOMMERZ (Bangladesh) |
| `SSLCOMMERZ_STORE_PASSWORD_BD` | Password | SSLCOMMERZ (Bangladesh) |
| `BKASH_USERNAME` | Username | bKash (Bangladesh) |
| `NAGAD_MERCHANT_ID` | Merchant ID | Nagad (Bangladesh) |
| `TWILIO_ACCOUNT_SID` | Account SID | SMS OTP |
| `OPENAI_API_KEY` | `sk-...` | AI features |
| `DISABLE_AUDIT` | `true`/`false` | Emergency: bypass audit logging |

---

## 3. HEALTH CHECK ENDPOINTS

### Basic Health (Always 200)
```bash
GET /api/health
GET /health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T18:56:46.551Z",
  "uptime": 32.80,
  "environment": "production",
  "payments_configured": true,
  "payments": {
    "stripe": false,
    "sslcommerz": true,
    "bkash": false,
    "nagad": false
  }
}
```

### Database Health (503 if DB down, server stays alive)
```bash
GET /api/health/db
GET /health/db
```
Response (OK):
```json
{
  "status": "ok",
  "database": "connected",
  "latencyMs": 57,
  "timestamp": "2026-01-09T18:56:46.656Z"
}
```

Response (DB Down - 503, server still running):
```json
{
  "status": "degraded",
  "database": "disconnected",
  "error": "Database connection failed",
  "latencyMs": 5000,
  "timestamp": "2026-01-09T18:56:46.656Z"
}
```

### Memory Health
```bash
GET /health/memory
```

---

## 4. DATABASE ERROR HANDLING

The global error handler in `server/middleware/errorHandler.ts` now:
- Detects Prisma/database errors by code pattern (P1xxx, P2xxx)
- Returns **503 Service Unavailable** for connection errors
- Returns **500** for other database errors
- **NEVER crashes the server** - always returns JSON response
- Includes `retryable: true` flag for database errors

---

## 5. AUDIT LOGGING SAFETY

All audit logging uses the `safeAuditLogCreate()` wrapper:
- Located in `server/utils/audit.ts`
- Catches all Prisma errors silently
- Logs warnings but never throws
- Emergency bypass: Set `DISABLE_AUDIT=true`

### Files Updated
All route files in `server/routes/` now use the safe wrapper:
- admin-bd-expansion.ts
- admin-phase4.ts
- admin-restaurant-settings.ts
- admin-support.ts
- bd-customer.ts
- customer.ts
- customer-rental.ts
- customer-restaurant-pricing.ts
- customer-support.ts
- customer-ticket.ts
- driver-support.ts
- driver-trust-score.ts
- partner-registration.ts
- restaurant.ts
- restaurant-support.ts
- shop-partner.ts
- ticket-operator.ts

---

## 6. PRISMA MIGRATIONS - PRODUCTION SAFE PLAN

### Current State
The database schema is managed via `prisma db push` for development only.

### Development Environment (Replit)
```bash
# Safe for development only - syncs schema without migration files
npm run db:push
```

### Production Environment (Railway)

**IMPORTANT**: For production with existing data, use only safe migration commands:

```bash
# 1. Generate migration from schema changes (run locally first)
npx prisma migrate dev --name descriptive_name

# 2. Deploy migrations to production
npx prisma migrate deploy

# 3. If schema drift exists, baseline the database
npx prisma migrate resolve --applied "0001_initial"
```

### NEVER DO THESE IN PRODUCTION
- `npx prisma db push --accept-data-loss` - May drop columns/data
- `npx prisma db push --force-reset` - Drops ALL data
- `npx prisma migrate reset` - Drops ALL data
- Direct SQL `DROP TABLE` or `ALTER TABLE DROP COLUMN` commands
- Any command that includes "reset", "force", or "drop"

### Pre-Deployment Checklist
1. Test migrations locally first
2. Back up production database
3. Review migration SQL in `prisma/migrations/`
4. Confirm no destructive operations

---

## 7. RAILWAY DEPLOYMENT CHECKLIST

### Pre-Deploy
- [ ] All env vars set in Railway dashboard
- [ ] DATABASE_URL points to Railway Postgres (not localhost)
- [ ] NODE_ENV=production

### Deploy Verification
```bash
# 1. Check deploy logs show correct port
# Should see: "serving on port 5000"

# 2. Test health endpoint
curl https://your-app.railway.app/api/health
# Should return 200 OK

# 3. Test database health
curl https://your-app.railway.app/api/health/db
# Should return 200 OK with "database": "connected"

# 4. Test a real route
curl https://your-app.railway.app/api/public/landing
# Should return 200 OK
```

### Rollback Plan
1. Identify last working commit in Railway deploy history
2. Click "Rollback" on that deployment
3. Or manually: `git revert <commit>` and push

---

## 8. WEBSOCKET ENDPOINTS

| Path | Purpose |
|------|---------|
| `/api/dispatch/ws` | Real-time ride dispatch |
| `/api/admin/notifications/ws` | Admin notifications |
| `/api/admin/observability/ws` | System observability |
| `/api/support/chat/ws` | Support chat |
| `/api/ride/chat/ws` | Ride chat |
| `/api/food-order/notifications/ws` | Food order notifications |

---

## 9. TROUBLESHOOTING

### 502 Bad Gateway
1. Check Railway logs for startup errors
2. Verify PORT is not hardcoded (must use `process.env.PORT`)
3. Check DATABASE_URL is correct
4. Run `/api/health/db` - if 503, database connection issue

### P3005 Migration Error
```bash
# Mark existing migration as applied
npx prisma migrate resolve --applied "0001_initial"
```

### Audit Log Failures
```bash
# Emergency: Disable audit logging
# Set DISABLE_AUDIT=true in Railway env vars
```

### Memory Issues
Check `/health/memory` endpoint - if >85%, consider:
1. Railway Pro plan for more memory
2. Optimize database queries
3. Add connection pooling

---

## 10. CONTACT

For production issues, check:
1. Railway dashboard logs
2. `/api/health/db` for database status
3. `/health/memory` for memory pressure
