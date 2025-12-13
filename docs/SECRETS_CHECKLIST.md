# SafeGo Secrets & Environment Variables Checklist

This document lists all required secrets and environment variables for SafeGo deployment.

## Critical Security Secrets (REQUIRED)

### 1. ENCRYPTION_KEY
- **Purpose**: Encrypts sensitive data including NID, SSN, bank account numbers, 2FA secrets, and recovery codes
- **Format**: 64 hexadecimal characters (32 bytes as hex)
- **Generate**: 
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Impact if missing**: 
  - Development: Temporary key generated (data not recoverable after restart)
  - Production: Application will NOT start
- **Storage**: Must be stored as a **Secret** (encrypted)

### 2. JWT_SECRET
- **Purpose**: Signs authentication tokens, document signatures, and session security
- **Format**: At least 32 characters (64 hex characters recommended)
- **Generate**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Impact if missing**: Application will NOT start
- **Storage**: Must be stored as a **Secret** (encrypted)

### 3. SESSION_SECRET
- **Purpose**: Express session security and cookie signing
- **Format**: At least 32 characters
- **Generate**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Impact if missing**: Sessions may be insecure
- **Storage**: Must be stored as a **Secret** (encrypted)

### 4. DATABASE_URL
- **Purpose**: PostgreSQL database connection
- **Format**: `postgresql://user:password@host:port/database?sslmode=require`
- **Impact if missing**: Application will NOT start
- **Note**: Automatically provided by Replit's built-in PostgreSQL database

---

## Third-Party API Keys

### Google Maps
- **GOOGLE_MAPS_API_KEY**
  - Purpose: Maps JavaScript SDK, Places API, Directions API, Geocoding API
  - Impact if missing: Maps features disabled gracefully, app still functional
  - Storage: Secret (encrypted)

### Payment Gateways

#### Bangladesh (SSLCOMMERZ)
- **SSLCOMMERZ_STORE_ID_BD** - Production store ID
- **SSLCOMMERZ_STORE_PASSWORD_BD** - Production store password
- **SSLCOMMERZ_SANDBOX_STORE_ID_BD** - Sandbox store ID (for testing)
- **SSLCOMMERZ_SANDBOX_PASSWORD_BD** - Sandbox password (for testing)

#### United States (Stripe)
- Stripe integration is managed via Replit's built-in Stripe integration
- See `use_integration` for Stripe setup

---

## Feature Flags (Environment Variables)

These are NOT secrets - store as environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_BD_ONLINE_PAYMENTS_ENABLED` | `false` | Enable Bangladesh online payments |
| `FEATURE_US_ONLINE_PAYMENTS_ENABLED` | `false` | Enable US online payments |
| `SSLCOMMERZ_SANDBOX_ENABLED_BD` | `true` | Use SSLCOMMERZ sandbox mode |
| `NODE_ENV` | `development` | Environment mode |

---

## SSLCOMMERZ Webhook URLs (Environment Variables)

| Variable | Value |
|----------|-------|
| `SSLCOMMERZ_SUCCESS_URL_BD` | `/api/payments/sslcommerz/success` |
| `SSLCOMMERZ_FAIL_URL_BD` | `/api/payments/sslcommerz/fail` |
| `SSLCOMMERZ_CANCEL_URL_BD` | `/api/payments/sslcommerz/cancel` |

---

## Quick Setup for Team Workspace Migration

When migrating from Personal to Team workspace, these secrets must be re-added:

### Step 1: Generate New Keys
```bash
# Generate ENCRYPTION_KEY (64 hex chars)
node -e "console.log('ENCRYPTION_KEY:', require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_SECRET (64 hex chars)
node -e "console.log('JWT_SECRET:', require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET (64 hex chars)
node -e "console.log('SESSION_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Add to Replit Secrets
1. Open the Secrets tab in Replit
2. Add each key as a new secret
3. Restart the application

### Step 3: Verify
Check the application logs for:
- `[Environment Guard] All critical security configuration valid`

If you see validation errors, double-check that:
- ENCRYPTION_KEY is exactly 64 hex characters
- JWT_SECRET is at least 32 characters
- DATABASE_URL is a valid PostgreSQL connection string

---

## Troubleshooting

### Blank White Pages
If routes show blank white pages:
1. Check browser console for JavaScript errors
2. Verify ENCRYPTION_KEY and JWT_SECRET are set
3. Check server logs for startup errors

### "Failed to fetch maps config"
This is expected if GOOGLE_MAPS_API_KEY is not set. The app will continue to work without map features.

### Database Connection Errors
Verify DATABASE_URL is set correctly. For Replit's built-in PostgreSQL, this is auto-configured.

---

## Security Best Practices

1. **Never commit secrets to git** - Use environment variables/secrets only
2. **Rotate keys periodically** - Generate new keys every 90 days
3. **Use different keys per environment** - Dev, staging, and prod should have unique keys
4. **Audit access** - Track who has access to secrets in team workspaces
