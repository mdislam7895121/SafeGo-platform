# SafeGo Deployment Guide

One-click deployment to any server. Zero configuration hassles.

## Quick Start

### 1. Set Required Environment Variables

Copy `.env.example.prod` and set these **minimum required** secrets:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
JWT_SECRET="your-jwt-secret-min-32-chars"
ENCRYPTION_KEY="your-encryption-key-32-chars"
SESSION_SECRET="your-session-secret-min-32-chars"
```

Generate secure secrets:
```bash
openssl rand -hex 32
```

### 2. Deploy

#### Railway (Recommended)
```bash
# Connect your repo to Railway, it auto-deploys from railway.toml
```

#### Render
```bash
# Connect your repo, it uses render.yaml automatically
```

#### Fly.io
```bash
fly launch --no-deploy
fly secrets set DATABASE_URL="..." JWT_SECRET="..." ENCRYPTION_KEY="..." SESSION_SECRET="..."
fly deploy
```

#### Docker / Any VPS
```bash
docker build -t safego .
docker run -p 5000:5000 --env-file .env safego
```

---

## Memory Optimization

For servers with **less than 2GB RAM**, set these environment variables:

```bash
NODE_OPTIONS="--max-old-space-size=1536"
DISABLE_OBSERVABILITY="true"
DISABLE_WEBSOCKETS="true"  # If you don't need real-time features
```

---

## Deployment Configs Included

| Platform | Config File | Notes |
|----------|-------------|-------|
| Railway | `railway.toml` | Auto-detected |
| Render | `render.yaml` | Auto-detected |
| Fly.io | `fly.toml` | Use `fly launch` |
| Docker | `Dockerfile` | Universal |

---

## Healthcheck

All deployments use `/healthz` endpoint which returns `ok` immediately on startup.

**Timeout settings:**
- Railway: 120 seconds
- Render: 120 seconds  
- Fly.io: 30 seconds (with 30s grace period)
- Docker: 60 seconds start period

---

## Database Migrations

This project uses **two ORMs** that must both run on deployment:

1. **Prisma** - Manages system tables (job runs, audit logs)
2. **Drizzle** - Manages application tables (users, orders, payments)

Both run automatically via `npm run start:prod`. Order:
```
1. npx prisma migrate deploy  (SQL migration files)
2. npm run db:push            (Drizzle schema sync)
```

To skip migrations (if already applied):
```bash
SKIP_MIGRATIONS=true
```

**Warning**: First deployment to a fresh database requires both migrations to complete successfully.

---

## Payment Providers

| Provider | Region | Required Env Vars |
|----------|--------|-------------------|
| Stripe | US | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| SSLCOMMERZ | Bangladesh | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` |
| bKash | Bangladesh | `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` |
| Nagad | Bangladesh | `NAGAD_MERCHANT_ID`, `NAGAD_MERCHANT_KEY` |

Payment providers are optional - unconfigured providers show warnings but don't block startup.

---

## Troubleshooting

### Healthcheck Failing
1. Check Deploy Logs (not Build Logs) for errors
2. Verify `DATABASE_URL` is correct
3. Increase `healthcheckTimeout` if migrations take long

### Memory Issues
1. Set `NODE_OPTIONS="--max-old-space-size=1536"`
2. Enable `DISABLE_OBSERVABILITY=true`
3. If still failing, enable `DISABLE_WEBSOCKETS=true`

### Migration Errors
1. Check if database is accessible
2. Verify `DATABASE_URL` includes `?sslmode=require`
3. Set `SKIP_MIGRATIONS=true` temporarily to bypass

---

## Support

For issues, check:
1. Deploy Logs (not Build Logs)
2. `/health` endpoint for detailed status
3. `/api/health/db` for database status
