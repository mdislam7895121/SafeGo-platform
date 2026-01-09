# SafeGo Customer App - Integration Report

**Version:** 1.0
**Generated:** January 2026
**Status:** Production Ready

---

## Executive Summary

This document provides a comprehensive report of all API endpoints, services, and third-party integrations that connect to the SafeGo Customer mobile application. This is required for App Store/Play Store submission and production deployment.

---

## 1. Authentication & Session Management

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | Customer registration | No |
| POST | `/api/auth/login` | Customer login | No |
| POST | `/api/auth/logout` | Session termination | Yes |
| POST | `/api/auth/refresh-token` | Refresh JWT token | Yes (refresh token) |
| POST | `/api/auth/forgot-password` | Password reset request | No |
| POST | `/api/auth/reset-password` | Password reset confirmation | No |
| GET | `/api/auth/me` | Get current user profile | Yes |

### Security Features
- JWT access tokens (15-minute expiry)
- Refresh token rotation with SHA-256 hashing + pepper
- Device fingerprinting
- Login throttling (5 attempts before lockout)
- 2FA support (TOTP/SMS)

### Dependencies
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT generation/validation
- **otpauth** - TOTP 2FA

---

## 2. Customer Profile

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/customer/profile` | Get customer profile | Yes |
| PUT | `/api/customer/profile` | Update profile | Yes |
| POST | `/api/customer/profile/photo` | Upload profile photo | Yes |
| GET | `/api/customer/kyc/status` | KYC verification status | Yes |
| POST | `/api/customer/kyc/submit` | Submit KYC documents | Yes |

### Data Fields
- fullName, phoneNumber, email
- countryCode (BD/US)
- verificationStatus
- profilePhotoUrl
- emergencyContact

---

## 3. Ride-Hailing Service

### Booking Flow Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/rides/estimate` | Get fare estimate | Yes |
| POST | `/api/rides/request` | Request new ride | Yes |
| GET | `/api/rides/:id` | Get ride details | Yes |
| POST | `/api/rides/:id/cancel` | Cancel ride | Yes |
| GET | `/api/rides/active` | Get active ride | Yes |
| GET | `/api/rides/history` | Ride history | Yes |

### Real-Time Features
| Feature | Technology | Endpoint |
|---------|------------|----------|
| Driver Location | WebSocket | `ws://*/dispatch` |
| Ride Status Updates | WebSocket | `ws://*/ride-status` |
| Chat with Driver | WebSocket | `ws://*/ride-chat` |

### Third-Party Integrations
| Service | Purpose | Provider |
|---------|---------|----------|
| Maps & Navigation | Route display, ETA | Google Maps Platform |
| Geocoding | Address lookup | Google Geocoding API |
| Directions | Route polyline | Google Directions API |
| Places | Address autocomplete | Google Places API |

### Required Environment Variables
- `GOOGLE_MAPS_API_KEY` - Google Maps API key

---

## 4. Food Delivery (SafeGo Eats)

### Restaurant Discovery
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/customer/food/restaurants` | List restaurants | Yes |
| GET | `/api/customer/food/restaurants/:id` | Restaurant details | Yes |
| GET | `/api/customer/food/restaurants/:id/menu` | Restaurant menu | Yes |
| GET | `/api/eats/search` | Search restaurants | Yes |
| GET | `/api/eats/cuisines` | List cuisines | Yes |

### Order Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/food-orders` | Place food order | Yes |
| GET | `/api/food-orders/:id` | Order details | Yes |
| POST | `/api/food-orders/:id/cancel` | Cancel order | Yes |
| GET | `/api/customer/food/orders` | Order history | Yes |
| GET | `/api/customer/food/active-order` | Active order status | Yes |

### Real-Time Features
| Feature | Technology |
|---------|------------|
| Order Status | WebSocket push |
| Delivery Tracking | WebSocket + Maps |
| Restaurant Prep Time | Real-time updates |

---

## 5. Parcel Delivery

### Bangladesh (BD) Parcel System
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/parcel/bd/zones` | Get delivery zones | Yes |
| GET | `/api/parcel/bd/rates` | Get zone-based rates | Yes |
| POST | `/api/parcel/bd/request` | Create parcel request | Yes |
| GET | `/api/parcel/bd/my-parcels` | My parcel history | Yes |
| GET | `/api/parcel/bd/:id` | Parcel details | Yes |

### United States (US) Parcel System
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/parcel/us/request` | Create parcel request | Yes |
| GET | `/api/parcel/us/my-parcels` | My parcel history | Yes |

### Parcel Types
- Document, Small Package, Medium Package, Large Package

---

## 6. Payments

### Payment Methods (US)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/payments/stripe/us/setup-intent` | Create card setup | Yes |
| GET | `/api/payments/stripe/us/payment-methods` | List saved cards | Yes |
| DELETE | `/api/payments/stripe/us/payment-methods/:id` | Remove card | Yes |
| POST | `/api/payments/stripe/us/pay` | Process payment | Yes |

### Payment Methods (BD)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/customer-payment/bd/bkash/init` | Initialize bKash | Yes |
| POST | `/api/customer-payment/bd/bkash/confirm` | Confirm bKash | Yes |
| POST | `/api/customer-payment/bd/nagad/init` | Initialize Nagad | Yes |
| POST | `/api/customer-payment/bd/nagad/confirm` | Confirm Nagad | Yes |

### Third-Party Payment Providers
| Provider | Region | Purpose |
|----------|--------|---------|
| Stripe | US | Card payments |
| bKash | BD | Mobile wallet |
| Nagad | BD | Mobile wallet |
| SSLCOMMERZ | BD | Card gateway |

### Required Secrets
- `STRIPE_SECRET_KEY` - Stripe API key (US)
- `BKASH_API_KEY`, `BKASH_SECRET_KEY` - bKash credentials (BD)
- `NAGAD_API_KEY`, `NAGAD_SECRET_KEY` - Nagad credentials (BD)

---

## 7. Promotions & Coupons

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/promos/available` | Available promotions | Yes |
| POST | `/api/coupons/validate` | Validate coupon code | Yes |
| POST | `/api/coupons/apply` | Apply coupon to order | Yes |
| GET | `/api/customer/wallet/balance` | Wallet balance | Yes |

---

## 8. Loyalty & Rewards (SafeGo Points)

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/loyalty/points` | Current points balance | Yes |
| GET | `/api/loyalty/history` | Points transaction history | Yes |
| GET | `/api/loyalty/rewards` | Available rewards | Yes |
| POST | `/api/loyalty/redeem` | Redeem points | Yes |

---

## 9. Reviews & Ratings

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/rating/ride` | Rate completed ride | Yes |
| POST | `/api/rating/food-order` | Rate food order | Yes |
| POST | `/api/rating/delivery` | Rate parcel delivery | Yes |
| GET | `/api/reviews/my-reviews` | My submitted reviews | Yes |

---

## 10. Customer Support

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/customer-support/tickets` | Create support ticket | Yes |
| GET | `/api/customer-support/tickets` | My tickets | Yes |
| GET | `/api/customer-support/tickets/:id` | Ticket details | Yes |
| POST | `/api/customer-support/tickets/:id/messages` | Add message | Yes |
| GET | `/api/support/articles` | Help articles | No |
| GET | `/api/support/categories` | Help categories | No |

### Real-Time Chat
| Feature | Technology |
|---------|------------|
| Live Support Chat | WebSocket |
| Message Notifications | Push Notifications |

---

## 11. Maps & Location Services

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/maps/config` | Get Maps API key | Yes |
| POST | `/api/maps/geocode` | Geocode address | Yes |
| POST | `/api/maps/reverse-geocode` | Reverse geocode | Yes |
| POST | `/api/maps/directions` | Get directions | Yes |
| POST | `/api/maps/distance-matrix` | Distance/time matrix | Yes |

### Required APIs
- Google Maps JavaScript API
- Google Places API
- Google Directions API
- Google Geocoding API

---

## 12. Notifications

### Push Notification Events
| Event | Description |
|-------|-------------|
| `ride_accepted` | Driver accepted ride request |
| `driver_arriving` | Driver approaching pickup |
| `ride_started` | Trip started |
| `ride_completed` | Trip completed |
| `order_confirmed` | Food order confirmed |
| `order_preparing` | Restaurant preparing order |
| `order_ready` | Order ready for pickup |
| `driver_assigned` | Delivery driver assigned |
| `order_delivered` | Order delivered |
| `promo_available` | New promotion available |
| `support_reply` | Support ticket reply |

---

## 13. Data Privacy & GDPR

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/privacy-consent/status` | Consent status | Yes |
| POST | `/api/privacy-consent/update` | Update consent | Yes |
| POST | `/api/data-rights/export` | Request data export | Yes |
| POST | `/api/data-rights/delete` | Request account deletion | Yes |
| GET | `/api/data-rights/requests` | My data requests | Yes |

---

## 14. Safety Features

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/customer/emergency/sos` | Trigger SOS | Yes |
| GET | `/api/customer/emergency/contacts` | Emergency contacts | Yes |
| POST | `/api/customer/emergency/contacts` | Add emergency contact | Yes |
| POST | `/api/customer/share-trip` | Share trip link | Yes |

---

## 15. Third-Party Service Dependencies

### Required External Services
| Service | Provider | Purpose | Required For |
|---------|----------|---------|--------------|
| Maps | Google | Mapping, directions | All location features |
| Payments (US) | Stripe | Card processing | US payments |
| Payments (BD) | bKash/Nagad | Mobile wallet | BD payments |
| SMS OTP | Twilio | Phone verification | Registration, 2FA |
| Email | AgentMail | Transactional emails | Notifications |
| Push Notifications | Firebase/APNs | Mobile notifications | All apps |

### Required Secrets (Customer App)
```
GOOGLE_MAPS_API_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

---

## 16. API Rate Limits

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Authentication | 5 req/min per IP |
| Ride Requests | 10 req/min per user |
| Food Orders | 10 req/min per user |
| General API | 100 req/min per user |
| Maps Proxy | 30 req/min per user |

---

## 17. Minimum App Requirements

| Platform | Minimum Version |
|----------|-----------------|
| iOS | 14.0+ |
| Android | 8.0 (API 26)+ |

### Required Permissions
| Permission | Purpose |
|------------|---------|
| Location (Always) | Ride tracking, delivery |
| Camera | Profile photo, KYC docs |
| Notifications | Order/ride updates |
| Storage | Save receipts |

---

## 18. Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### Common Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid/expired token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal error |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | SafeGo Engineering | Initial release |

