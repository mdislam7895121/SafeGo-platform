# SafeGo Secrets Checklist

## Production Mandatory Secrets

The following secrets are **MANDATORY** for production deployment. The application will **FAIL TO START** in production mode if any of these are missing.

| Secret | Description | Validation |
|--------|-------------|------------|
| `JWT_SECRET` | Authentication tokens, document signing, session security | Min 32 characters, no default values |
| `ENCRYPTION_KEY` | Encrypts NID, SSN, bank accounts, 2FA secrets, recovery codes | 32 bytes UTF-8 or 64 hex chars |
| `SESSION_SECRET` | Express session security | Min 32 characters |
| `DATABASE_URL` | PostgreSQL connection string | Must start with `postgresql://` or `postgres://` |
| `GOOGLE_MAPS_API_KEY` | Maps, Places, Directions APIs | Required for location services |

## Country-Specific Payment Keys

### Bangladesh (BD)
| Secret | Description |
|--------|-------------|
| `SSLCOMMERZ_STORE_ID_BD` | SSLCOMMERZ store ID for Bangladesh |
| `SSLCOMMERZ_STORE_PASSWORD_BD` | SSLCOMMERZ store password |

### United States (US)
| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |

## Generating Secure Keys

```bash
# Generate JWT_SECRET (64 hex characters = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (64 hex characters = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET (64 hex characters = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Environment Guard Behavior

### Production Mode (`NODE_ENV=production`)
- App **FAILS TO START** if mandatory secrets are missing
- Fatal error logs with clear instructions
- `process.exit(1)` prevents unsafe startup

### Development Mode (`NODE_ENV=development`)
- Warnings displayed for missing secrets
- Temporary keys may be generated (ephemeral, not for production)
- App starts but warns about security risks

## Security Rules

1. **NEVER** hardcode secrets in source code
2. **NEVER** commit secrets to version control
3. **NEVER** log actual secret values (only names)
4. **ALWAYS** use environment variables or secret management
5. **ROTATE** secrets periodically in production

## Verification

Run the Environment Guard manually:
```bash
NODE_ENV=production npm run dev
# Should fail if secrets are missing

NODE_ENV=development npm run dev
# Should warn but start
```

## Files Using Secrets

| File | Secret Used |
|------|-------------|
| `server/middleware/jwtRotation.ts` | JWT_SECRET |
| `server/services/kycSecurityService.ts` | ENCRYPTION_KEY |
| `server/utils/environmentGuard.ts` | All secrets validated |
| `server/services/documentService.ts` | JWT_SECRET |
| `server/utils/encryption.ts` | ENCRYPTION_KEY |
| `server/utils/crypto.ts` | ENCRYPTION_KEY |
