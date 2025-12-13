# SafeGo Secrets & API Configuration Checklist

This document lists all required secrets, environment variables, and API key configurations for SafeGo to function properly in production.

## Required Secrets

### Core Security
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `JWT_SECRET` | JWT token signing for authentication | Yes |
| `ENCRYPTION_KEY` | AES-256-GCM encryption for sensitive data | Yes |
| `SESSION_SECRET` | Express session signing | Yes |

### Database
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Individual DB credentials | Auto-set by Replit |

### Google Maps
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `GOOGLE_MAPS_API_KEY` | Google Maps JavaScript API, Places, Directions, Geocoding | Yes |

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
| `STRIPE_SECRET_KEY` | Stripe server-side API | For US payments |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side API | For US payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | For US payments |

#### Bangladesh (SSLCOMMERZ)
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `SSLCOMMERZ_STORE_ID_BD` | Production store ID | For BD payments |
| `SSLCOMMERZ_STORE_PASSWORD_BD` | Production store password | For BD payments |
| `SSLCOMMERZ_SANDBOX_STORE_ID_BD` | Sandbox store ID | For BD testing |
| `SSLCOMMERZ_SANDBOX_PASSWORD_BD` | Sandbox store password | For BD testing |
| `SSLCOMMERZ_SANDBOX_ENABLED_BD` | Set to "true" for sandbox mode | Optional |

### Mobile Wallet Payouts (Bangladesh)
| Secret Name | Purpose | Required |
|-------------|---------|----------|
| `BKASH_API_KEY` | bKash payout integration | For BD payouts |
| `BKASH_API_SECRET` | bKash secret | For BD payouts |
| `NAGAD_API_KEY` | Nagad payout integration | For BD payouts |
| `NAGAD_API_SECRET` | Nagad secret | For BD payouts |

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
| `NODE_ENV` | Environment mode | development |

### URLs
| Variable Name | Purpose | Default |
|---------------|---------|---------|
| `FRONTEND_URL` | Frontend URL for CORS | https://safego.replit.app |

## Health Check Endpoints

Use these endpoints to verify configuration:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/maps/health` | Check Google Maps API key presence |
| `GET /api/health` | General application health |

## Verification Steps

1. **Google Maps**: Visit `/customer` after login and verify:
   - Map tiles render (uses Leaflet/OpenStreetMap)
   - Pickup/Dropoff autocomplete shows suggestions
   - Route calculation returns distance/duration

2. **Payments**: Check `/api/webhooks/payments/health` for gateway status

3. **Database**: Application startup logs show successful connection

## Troubleshooting

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
