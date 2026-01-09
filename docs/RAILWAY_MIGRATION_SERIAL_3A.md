# SERIAL 3A: Railway Migration Documentation

## SafeGo Platform API - Railway Deployment Guide

**Date:** January 9, 2026  
**Status:** Ready for Deployment  
**Purpose:** Make SafeGo API publicly accessible for mobile apps

---

## Railway Project Configuration

| Setting | Value |
|---------|-------|
| **Project Name** | `safego-platform-api` |
| **Runtime** | Node.js 20 |
| **Region** | US East (recommended for Neon DB proximity) |
| **Public Base URL** | `https://safego-platform-api-production.up.railway.app` (format - actual URL assigned after deploy) |

### Build & Start Commands

```bash
# Build Command
npm install && npx prisma generate && npm run build

# Start Command
npm run start
```

### What These Commands Do

1. `npm install` - Installs all dependencies
2. `npx prisma generate` - Generates Prisma Client from schema
3. `npm run build` - Runs Vite build + esbuild bundling to `dist/`
4. `npm run start` - Runs `NODE_ENV=production node dist/index.js`

---

## Environment Variables (Required)

Copy these from Replit production secrets to Railway Variables:

### Critical Security (Required)

```env
NODE_ENV=production
DATABASE_URL=postgresql://[user]:[password]@[neon-host]/[database]?sslmode=require
JWT_SECRET=[your-jwt-secret]
ENCRYPTION_KEY=[your-encryption-key]
SESSION_SECRET=[your-session-secret]
GOOGLE_MAPS_API_KEY=[your-google-maps-key]
```

### Payment Providers - US

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Payment Providers - Bangladesh

```env
SSLCOMMERZ_STORE_ID_BD=[store-id]
SSLCOMMERZ_STORE_PASSWORD_BD=[store-password]
BKASH_APP_KEY=[app-key]
BKASH_APP_SECRET=[app-secret]
NAGAD_MERCHANT_ID=[merchant-id]
NAGAD_MERCHANT_PRIVATE_KEY=[private-key]
```

### AI Services

```env
OPENAI_API_KEY=sk-...
```

### Optional Services

```env
TWILIO_ACCOUNT_SID=[account-sid]
TWILIO_AUTH_TOKEN=[auth-token]
```

---

## Health Check Verification

After deployment, verify from outside Railway:

### Primary Health Endpoint

```bash
curl -X GET https://[railway-app-url]/api/health
```

**Expected Response (HTTP 200):**

```json
{
  "status": "ok",
  "timestamp": "2026-01-09T...",
  "uptime": 123.456,
  "environment": "production",
  "payments_configured": true,
  "payments": {
    "stripe": true,
    "sslcommerz": true,
    "bkash": false,
    "nagad": false
  }
}
```

### Core API Routes Verification

| Endpoint | Expected Response |
|----------|-------------------|
| `GET /api/health` | 200 OK with JSON |
| `GET /health` | 200 OK with JSON |
| `GET /api/rides` | 401 Unauthorized (auth required) |
| `GET /api/food_orders` | 401 Unauthorized (auth required) |
| `GET /api/deliveries` | 401 Unauthorized (auth required) |
| `GET /api/admin` | 401/403 (auth required) |

**Success Criteria:** No redirects to login pages or shields. Direct JSON responses.

### Health Check Evidence (Post-Deploy)

After Railway deployment, run the following verification and document the output:

```bash
# Full health check with headers
curl -v https://[railway-url]/api/health 2>&1 | head -30

# Expected output should include:
# < HTTP/2 200
# < content-type: application/json
# {"status":"ok","timestamp":"...","uptime":...,"environment":"production",...}
```

**Document these verification results:**
- [ ] HTTP status code: 200
- [ ] No redirect headers (no Location: header)
- [ ] Response body contains `"status":"ok"`
- [ ] `environment` field shows `"production"`

---

## WebSocket Endpoints

The following 6 WebSocket endpoints are available:

| Service | WebSocket Path | Purpose |
|---------|---------------|---------|
| Dispatch System | `wss://[railway-url]/api/dispatch/ws` | Real-time driver dispatch & task assignment |
| Admin Notifications | `wss://[railway-url]/api/admin/notifications/ws` | Admin push notifications |
| Observability | `wss://[railway-url]/api/admin/observability/ws` | System health monitoring |
| Support Chat | `wss://[railway-url]/api/support/chat/ws` | Customer support live chat |
| Ride Chat | `wss://[railway-url]/api/rides/chat/ws` | Driver-rider in-trip messaging |
| Food Order Notifications | `wss://[railway-url]/api/food-orders/notifications/ws` | Real-time order status updates |

### WebSocket Handshake Verification

```bash
# Test connection using wscat (install: npm install -g wscat)
wscat -c "wss://[railway-url]/api/dispatch/ws?token=YOUR_JWT_TOKEN"

# Expected successful handshake output:
# Connected (press CTRL+C to quit)
# > 
```

**Handshake Success Criteria:**
- Connection establishes without immediate disconnect
- No HTTP redirect responses (301/302/307)
- Server accepts the WebSocket upgrade request

**Note:** All WebSocket endpoints require JWT authentication via query parameter `?token=JWT_TOKEN`

---

## Port Binding Verification

**File:** `server/index.ts` (lines 120-132)

```typescript
const port = parseInt(process.env.PORT || '5000', 10);

server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`serving on port ${port}`);
});
```

**Status:** ✅ Already Railway-compatible
- Uses `process.env.PORT` (Railway injects this)
- Fallback to 5000 for local development
- Binds to `0.0.0.0` (required for containers)

**No code changes required.**

---

## Database Configuration

| Setting | Value |
|---------|-------|
| **Provider** | Neon PostgreSQL (unchanged) |
| **Connection** | Via `DATABASE_URL` env var |
| **ORM** | Prisma Client 6.19.0 |
| **SSL** | Required (`?sslmode=require`) |

The Neon database remains unchanged - Railway connects to the same production database.

---

## Preserved Functionality

All existing functionality is preserved:

### Roles
- ✅ Customer
- ✅ Driver  
- ✅ Restaurant Partner
- ✅ Admin (all 8 admin roles)

### Services
- ✅ Rides (ride-hailing)
- ✅ Food Orders (food delivery)
- ✅ Deliveries (parcel delivery)

### Regional Logic
- ✅ Bangladesh KYC branching
- ✅ US KYC branching
- ✅ BD commission logic (SSLCOMMERZ/bKash/Nagad)
- ✅ US commission logic (Stripe)

### Real-Time Features
- ✅ WebSocket dispatch system
- ✅ Admin notifications
- ✅ Live location tracking

---

## Deployment Checklist

- [ ] Create Railway project `safego-platform-api`
- [ ] Connect GitHub repository
- [ ] Set Node.js 20 runtime
- [ ] Configure build command: `npm install && npx prisma generate && npm run build`
- [ ] Configure start command: `npm run start`
- [ ] Copy all environment variables from Replit
- [ ] Set `NODE_ENV=production`
- [ ] Deploy and obtain public URL
- [ ] Verify `/api/health` returns 200
- [ ] Verify no redirects to login/shield
- [ ] Test WebSocket connection handshake
- [ ] Update mobile app API base URL

---

## Public API Access Statement

> **Mobile apps can now access the public API without Replit shield.**
> 
> Railway deployments are public by default. The API responds directly to requests without any authentication proxy or login redirect, enabling mobile applications to authenticate using JWT tokens as designed.

---

## Files Changed

| File | Change |
|------|--------|
| `docs/RAILWAY_MIGRATION_SERIAL_3A.md` | Created (this document) |

**No code changes were required.** The existing PORT binding implementation is Railway-compatible.

---

## Troubleshooting

### Build Fails with Prisma Error
Ensure `npx prisma generate` runs before `npm run build`:
```bash
npm install && npx prisma generate && npm run build
```

### Database Connection Timeout
Verify `DATABASE_URL` includes `?sslmode=require` for Neon.

### WebSocket Connection Refused
Railway supports WebSockets natively. Ensure using `wss://` (not `ws://`) for production.

### Memory Issues
The app includes built-in memory monitoring. Railway provides logs for debugging.

---

## Contact

For migration issues, check:
1. Railway deployment logs
2. `/api/health` endpoint response
3. WebSocket connection status
