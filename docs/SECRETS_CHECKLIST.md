# SafeGo Secrets & API Configuration Checklist

This document lists all required secrets, environment variables, and API key configurations for SafeGo to function properly in production.

## CRITICAL: Production Deployment Checklist

Before deploying to production, ensure ALL of these secrets are set:

| Secret | Required In | What Breaks If Missing |
|--------|-------------|------------------------|
| `JWT_SECRET` | PRODUCTION | **FATAL** - Auth tokens won't work, app won't start |
| `ENCRYPTION_KEY` | PRODUCTION | **FATAL** - Cannot encrypt NID/SSN/bank data, app won't start |
| `SESSION_SECRET` | PRODUCTION | **FATAL** - Sessions won't work, app won't start |
| `DATABASE_URL` | PRODUCTION | **FATAL** - No database connection, app won't start |
| `GOOGLE_MAPS_API_KEY` | PRODUCTION | **FATAL** - Maps/Places/Directions won't work, app won't start |

## Required Secrets

### Core Security (MANDATORY FOR PRODUCTION)
| Secret Name | Purpose | Required | What Breaks |
|-------------|---------|----------|-------------|
| `JWT_SECRET` | JWT token signing for authentication | **PRODUCTION** | Auth, document signing, session security |
| `ENCRYPTION_KEY` | AES-256-GCM encryption for sensitive data | **PRODUCTION** | NID, SSN, bank accounts, 2FA secrets |
| `SESSION_SECRET` | Express session signing | **PRODUCTION** | User sessions, login persistence |

**How to generate secure keys:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database (MANDATORY FOR PRODUCTION)
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | **PRODUCTION** |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Individual DB credentials | Auto-set by Replit |

### Google Maps (MANDATORY FOR PRODUCTION)
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API, Places, Directions, Geocoding | **PRODUCTION** |

#### Google Maps API Key Configuration

The Google Maps API key must have:

**Enabled APIs:**
- Maps JavaScript API
- Places API
- Directions API
- Geocoding API

**HTTP Referrer Restrictions (Browser Keys):**
```
https://safegoglobal.com/*
https://www.safegoglobal.com/*
https://*.replit.app/*
https://*.replit.dev/*
https://*.kirk.replit.dev/*
```

**IP Restrictions (Server Keys - if using separate key):**
- Add Replit's IP ranges or use no restrictions for development

### Payment Gateways

#### United States (Stripe)
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `STRIPE_SECRET_KEY` | Stripe server-side API | If US payments enabled |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side API | If US payments enabled |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | If US payments enabled |

#### Bangladesh (SSLCOMMERZ)
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `SSLCOMMERZ_STORE_ID_BD` | Production store ID | If BD payments enabled |
| `SSLCOMMERZ_STORE_PASSWORD_BD` | Production store password | If BD payments enabled |
| `SSLCOMMERZ_SANDBOX_STORE_ID_BD` | Sandbox store ID | For BD testing |
| `SSLCOMMERZ_SANDBOX_PASSWORD_BD` | Sandbox store password | For BD testing |
| `SSLCOMMERZ_SANDBOX_ENABLED_BD` | Set to "true" for sandbox mode | Optional |

### Mobile Wallet Payouts (Bangladesh)
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `BKASH_API_KEY` | bKash payout integration | If BD payouts enabled |
| `BKASH_API_SECRET` | bKash secret | If BD payouts enabled |
| `NAGAD_API_KEY` | Nagad payout integration | If BD payouts enabled |
| `NAGAD_API_SECRET` | Nagad secret | If BD payouts enabled |

### Notifications
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `TWILIO_ACCOUNT_SID` | Twilio SMS OTP | For SMS |
| `TWILIO_AUTH_TOKEN` | Twilio authentication | For SMS |
| `TWILIO_PHONE_NUMBER` | Twilio sending number | For SMS |
| `AGENTMAIL_API_KEY` | Email OTP service | For Email |

### Identity Verification
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `CHECKR_API_KEY` | Background check service | For US drivers |
| `AWS_ACCESS_KEY_ID` | AWS Rekognition (facial recognition) | For KYC |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | For KYC |
| `AWS_REGION` | AWS region (default: us-east-1) | For KYC |

## Environment Variables

### Feature Flags
| Variable Name | Purpose | Default |
|---------------|---------|---------|
| `FEATURE_BD_ONLINE_PAYMENTS_ENABLED` | Enable Bangladesh online payments | false |
| `FEATURE_US_ONLINE_PAYMENTS_ENABLED` | Enable US online payments | false |
| `NODE_ENV` | Environment mode | development |

### URLs
| Variable Name | Purpose | Default |
|---------------|---------|---------|
| `FRONTEND_URL` | Frontend URL for CORS | https://safego.replit.app |

## Usage in Code

### JWT_SECRET Used In:
- `server/middleware/auth.ts` - Token verification
- `server/routes/auth.ts` - Token generation
- `server/middleware/authz.ts` - Authorization
- `server/middleware/jwtRotation.ts` - Token rotation
- `server/websocket/*.ts` - WebSocket authentication
- `server/services/documentService.ts` - Document signing

### ENCRYPTION_KEY Used In:
- `server/utils/encryption.ts` - General encryption
- `server/utils/secureEncryption.ts` - Secure encryption
- `server/utils/crypto.ts` - Crypto operations
- `server/services/kycSecurityService.ts` - KYC data encryption

### GOOGLE_MAPS_API_KEY Used In:
- `server/routes/maps.ts` - API key provider
- `client/src/hooks/useGoogleMaps.ts` - SDK loading
- Places autocomplete for pickup/dropoff

## Health Check Endpoints

Use these endpoints to verify configuration:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/maps/health` | Check Google Maps API key presence |
| `GET /api/health` | General application health |

## Verification Steps

1. **Google Maps**: Visit `/customer` after login and verify:
   - Pickup/Dropoff autocomplete shows suggestions
   - Route calculation returns distance/duration

2. **Payments**: Check `/api/webhooks/payments/health` for gateway status

3. **Database**: Application startup logs show successful connection

## Troubleshooting

### Application Won't Start in Production
Check logs for `[FATAL]` messages:
- `JWT_SECRET is MANDATORY FOR PRODUCTION` - Set JWT_SECRET secret
- `ENCRYPTION_KEY is MANDATORY FOR PRODUCTION` - Set ENCRYPTION_KEY secret
- `SESSION_SECRET is MANDATORY FOR PRODUCTION` - Set SESSION_SECRET secret
- `GOOGLE_MAPS_API_KEY is MANDATORY FOR PRODUCTION` - Set GOOGLE_MAPS_API_KEY secret

### Google Maps Not Working
1. Check `/api/maps/health` - should show `keyPresent: true`
2. Verify HTTP referrer restrictions include your domains
3. Check browser console for CSP violations
4. Ensure all required APIs are enabled in Google Cloud Console

### CSP Violations
If you see CSP violations in logs, verify `server/middleware/securityHeaders.ts` includes:
- `https://maps.googleapis.com` in script-src, style-src, img-src, connect-src
- `https://maps.gstatic.com` in script-src, img-src
- `https://fonts.googleapis.com` in style-src
- `https://fonts.gstatic.com` in font-src
