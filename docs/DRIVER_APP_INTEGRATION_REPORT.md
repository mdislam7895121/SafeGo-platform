# SafeGo Driver App - Integration Report

**Version:** 1.0
**Generated:** January 2026
**Status:** Production Ready

---

## Executive Summary

This document provides a comprehensive report of all API endpoints, services, and third-party integrations that connect to the SafeGo Driver mobile application. This is required for App Store/Play Store submission and production deployment.

---

## 1. Authentication & Session Management

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/signup` | Driver registration | No |
| POST | `/api/auth/login` | Driver login | No |
| POST | `/api/auth/logout` | Session termination | Yes |
| POST | `/api/auth/refresh-token` | Refresh JWT token | Yes (refresh token) |
| POST | `/api/auth/forgot-password` | Password reset request | No |
| POST | `/api/auth/reset-password` | Password reset confirmation | No |
| GET | `/api/auth/me` | Get current user profile | Yes |

### Security Features
- JWT access tokens (15-minute expiry)
- Refresh token rotation with SHA-256 hashing + pepper
- Device fingerprinting with anti-fraud detection
- Login throttling (5 attempts before lockout)
- 2FA support (TOTP/SMS)
- Fake GPS detection
- One-account-per-device enforcement

### Dependencies
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT generation/validation
- **otpauth** - TOTP 2FA

---

## 2. Driver Registration & Onboarding

### Partner Registration Flow
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/partner-driver/registration/status` | Get registration status | Yes |
| POST | `/api/partner-driver/registration/submit` | Submit registration | Yes |
| POST | `/api/partner-driver/registration/save-step` | Save onboarding step | Yes |

### Delivery Driver Onboarding
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/partner/delivery-driver/init` | Initialize onboarding | Yes |
| POST | `/api/partner/delivery-driver/onboarding/init` | Start onboarding | Yes |
| GET | `/api/partner/delivery-driver/onboarding/draft` | Get saved draft | Yes |
| PUT | `/api/partner/delivery-driver/onboarding/step/:n` | Save step N | Yes |
| POST | `/api/partner/delivery-driver/onboarding/submit` | Final submission | Yes |

### Onboarding Steps
1. Personal Information
2. Contact Details
3. Driver's License Upload
4. Vehicle Information
5. Insurance Documents
6. Background Check Consent

---

## 3. Driver Profile & Verification

### Profile Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver/profile` | Get driver profile | Yes |
| PUT | `/api/driver/profile` | Update profile | Yes |
| POST | `/api/driver/profile/photo` | Upload profile photo | Yes |
| GET | `/api/driver/public-profile/:id` | Public profile card | No |

### KYC & Verification
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver-onboarding/status` | Verification status | Yes |
| POST | `/api/driver-onboarding/documents` | Upload documents | Yes |
| GET | `/api/driver-onboarding/documents` | List documents | Yes |
| POST | `/api/driver-onboarding/submit-for-review` | Submit for review | Yes |

### Required Documents (BD)
- National ID Card (NID)
- Valid Driving License
- Vehicle Registration Certificate
- Tax Identification (if applicable)

### Required Documents (US)
- Government-issued ID
- Valid Driver's License
- Vehicle Registration
- Vehicle Insurance
- Background Check Clearance

### Third-Party Verification Services
| Service | Provider | Purpose |
|---------|----------|---------|
| Background Check | Checkr | Criminal record check (US) |
| ID Verification | Persona/Onfido | Document verification |
| Facial Recognition | AWS Rekognition | Driver identity match |

---

## 4. Online/Offline Status & Availability

### Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/driver/go-online` | Set driver online | Yes |
| POST | `/api/driver/go-offline` | Set driver offline | Yes |
| GET | `/api/driver/status` | Get current status | Yes |
| PUT | `/api/driver/location` | Update location | Yes |

### Real-Time Location Updates
| Feature | Technology | Endpoint |
|---------|------------|----------|
| Location Push | WebSocket | `ws://*/dispatch` |
| Heartbeat | WebSocket | Every 5 seconds |
| GPS Coordinates | Device GPS | Required accuracy: 10m |

---

## 5. Ride-Hailing (Trip Management)

### Trip Flow Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver/trips/available` | Available trip requests | Yes |
| POST | `/api/driver/trips/:id/accept` | Accept trip | Yes |
| POST | `/api/driver/trips/:id/decline` | Decline trip | Yes |
| POST | `/api/driver-ride-actions/:id/arrived` | Arrived at pickup | Yes |
| POST | `/api/driver-ride-actions/:id/start` | Start trip | Yes |
| POST | `/api/driver-ride-actions/:id/complete` | Complete trip | Yes |
| POST | `/api/driver-ride-actions/:id/cancel` | Cancel trip | Yes |
| GET | `/api/driver/trips/active` | Get active trip | Yes |
| GET | `/api/driver/trips/history` | Trip history | Yes |

### Trip Status Flow
```
requested → accepted → driver_arrived → in_progress → completed
                    ↘ cancelled (any point)
```

### Real-Time Features
| Feature | Technology | Endpoint |
|---------|------------|----------|
| New Trip Alerts | WebSocket | `ws://*/dispatch` |
| Customer Location | WebSocket | Real-time updates |
| Chat with Customer | WebSocket | `ws://*/ride-chat` |

---

## 6. Food Delivery

### Delivery Assignment
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver-food-delivery/available` | Available orders | Yes |
| POST | `/api/driver-food-delivery/:id/accept` | Accept order | Yes |
| POST | `/api/driver-food-delivery/:id/decline` | Decline order | Yes |
| POST | `/api/driver-food-delivery/:id/picked-up` | Picked up from restaurant | Yes |
| POST | `/api/driver-food-delivery/:id/on-the-way` | On the way | Yes |
| POST | `/api/driver-food-delivery/:id/delivered` | Mark delivered | Yes |
| GET | `/api/driver-food-delivery/active` | Active deliveries | Yes |
| GET | `/api/driver-food-delivery/history` | Delivery history | Yes |

### Food Order Status Flow
```
assigned → arrived_restaurant → picked_up → on_the_way → delivered
                              ↘ cancelled (any point)
```

### Real-Time Features
| Feature | Technology |
|---------|------------|
| New Order Alerts | WebSocket + Push |
| Restaurant Ready Status | Real-time updates |
| Customer Chat | WebSocket |

---

## 7. Parcel Delivery

### Parcel Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/parcel/driver/available` | Available parcels | Yes |
| POST | `/api/parcel/driver/:id/accept` | Accept parcel job | Yes |
| POST | `/api/parcel/driver/:id/picked-up` | Picked up parcel | Yes |
| POST | `/api/parcel/driver/:id/on-the-way` | On the way | Yes |
| POST | `/api/parcel/driver/:id/delivered` | Mark delivered | Yes |
| GET | `/api/parcel/driver/my-jobs` | My parcel jobs | Yes |

---

## 8. Earnings & Wallet

### Wallet Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver-wallet/balance` | Get wallet balance | Yes |
| GET | `/api/driver-wallet/transactions` | Transaction history | Yes |
| GET | `/api/driver-wallet/summary` | Earnings summary | Yes |

### Earnings Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/earnings/driver/daily` | Daily earnings | Yes |
| GET | `/api/earnings/driver/weekly` | Weekly earnings | Yes |
| GET | `/api/earnings/driver/monthly` | Monthly earnings | Yes |
| GET | `/api/earnings/driver/breakdown` | Earnings breakdown | Yes |

### Wallet Fields
- `availableBalance` - Available for withdrawal
- `negativeBalance` - Outstanding commission (BD)
- `pendingEarnings` - Pending clearance

### Earnings Breakdown
- Ride fares
- Delivery fees
- Tips (100% to driver)
- Bonuses & incentives
- Deductions (commission, tax)

---

## 9. Payouts

### Payout Endpoints (US - Direct Deposit)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/payout/driver/methods` | Payout methods | Yes |
| POST | `/api/payout/driver/bank-account` | Add bank account | Yes |
| PUT | `/api/payout/driver/bank-account/:id` | Update bank info | Yes |
| GET | `/api/payout/driver/history` | Payout history | Yes |
| GET | `/api/payout/driver/schedule` | Payout schedule | Yes |

### Payout Endpoints (BD - Cash Collection)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/payout/driver/settlement` | Settlement status | Yes |
| GET | `/api/payout/driver/commission-due` | Commission owed | Yes |
| POST | `/api/payout/driver/settle` | Record settlement | Yes |

### Payout Schedule
| Region | Method | Frequency |
|--------|--------|-----------|
| US | Direct Deposit | Weekly (Monday) |
| BD | Cash Settlement | Weekly (Sun-Thu) |

---

## 10. Performance & Ratings

### Performance Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver-performance/stats` | Performance stats | Yes |
| GET | `/api/driver-performance/ratings` | Customer ratings | Yes |
| GET | `/api/driver-performance/acceptance-rate` | Acceptance rate | Yes |
| GET | `/api/driver-performance/cancellation-rate` | Cancellation rate | Yes |
| GET | `/api/driver-performance/completion-rate` | Completion rate | Yes |

### Performance Metrics
- Average customer rating (1-5 stars)
- Acceptance rate (%)
- Cancellation rate (%)
- Completion rate (%)
- Online hours
- Peak hours worked

---

## 11. Incentives & Bonuses

### Incentive Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver-incentives/active` | Active incentives | Yes |
| GET | `/api/driver-incentives/cycles` | Incentive cycles | Yes |
| GET | `/api/driver-incentives/achievements` | Driver achievements | Yes |
| GET | `/api/driver-incentives/rewards` | Available rewards | Yes |
| GET | `/api/driver-incentives/tier` | Current tier | Yes |

### Incentive Types
| Type | Description |
|------|-------------|
| DAILY_TRIPS | Complete X trips per day |
| WEEKLY_TRIPS | Complete X trips per week |
| PEAK_HOURS | Work during peak hours |
| CONSECUTIVE_DAYS | Work X days in a row |
| ACCEPTANCE_RATE | Maintain high acceptance |
| RATING_BONUS | Maintain 4.8+ rating |

### Achievement Badges
- First Trip
- 100 Rides
- 5-Star Week
- Zero Cancellations
- Loyalty Streaks

### Driver Tiers
| Tier | Requirements |
|------|--------------|
| Bronze | New driver |
| Silver | 100+ trips, 4.5+ rating |
| Gold | 500+ trips, 4.7+ rating |
| Platinum | 1000+ trips, 4.9+ rating |

---

## 12. Trust Score

### Trust Score Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/driver-trust-score/score` | Current trust score | Yes |
| GET | `/api/driver-trust-score/factors` | Score factors | Yes |
| GET | `/api/driver-trust-score/history` | Score history | Yes |

### Trust Score Factors
- Document verification status
- Background check status
- Customer ratings
- Cancellation rate
- Reported incidents
- Account age

---

## 13. Safety Features

### Safety Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/driver-safety/sos` | Trigger SOS | Yes |
| POST | `/api/driver-safety/incident/report` | Report incident | Yes |
| GET | `/api/driver-safety/incidents` | My incident reports | Yes |
| POST | `/api/driver-safety/unsafe-location` | Report unsafe location | Yes |
| GET | `/api/driver-safety/training` | Safety training modules | Yes |

### SOS Features
- Emergency contact notification
- Real-time location sharing
- Police dispatch integration
- Audio recording (with consent)

---

## 14. Driver Support

### Support Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/driver-support/tickets` | Create ticket | Yes |
| GET | `/api/driver-support/tickets` | My tickets | Yes |
| GET | `/api/driver-support/tickets/:id` | Ticket details | Yes |
| POST | `/api/driver-support/tickets/:id/messages` | Add message | Yes |
| GET | `/api/driver-support/articles` | Help articles | Yes |
| GET | `/api/driver-support/categories` | Help categories | Yes |

### Support Categories
- Earnings & Payouts
- Account Issues
- Trip Problems
- Safety Concerns
- Vehicle Issues
- App Technical Support

---

## 15. Navigation & Maps

### Navigation Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/maps/config` | Get Maps API key | Yes |
| POST | `/api/maps/directions` | Get directions | Yes |
| POST | `/api/maps/optimize-route` | Optimize route | Yes |

### Third-Party Navigation
| Service | Purpose | Integration |
|---------|---------|-------------|
| Google Maps | In-app navigation | Deep link |
| Waze | Turn-by-turn navigation | Deep link |
| Apple Maps | iOS navigation | Deep link |

### Navigation Disclaimer
Drivers are responsible for:
- Verifying route directions
- Following traffic laws
- Making safe driving decisions

SafeGo is not liable for navigation errors.

---

## 16. Real-Time Dispatch System

### WebSocket Connections
| Channel | Purpose | Data |
|---------|---------|------|
| `/dispatch` | Trip/order assignments | New requests |
| `/location` | Location updates | GPS coordinates |
| `/ride-chat` | Customer chat | Messages |
| `/notifications` | System alerts | Push notifications |

### WebSocket Events (Driver Receives)
| Event | Description |
|-------|-------------|
| `new_trip_request` | New ride request |
| `new_food_order` | New food delivery |
| `new_parcel_job` | New parcel delivery |
| `trip_cancelled` | Customer cancelled |
| `chat_message` | New chat message |
| `system_alert` | Platform announcement |

### WebSocket Events (Driver Sends)
| Event | Description |
|-------|-------------|
| `location_update` | GPS coordinates |
| `status_change` | Online/offline |
| `trip_action` | Accept/decline/complete |
| `chat_message` | Send message |

---

## 17. Background Services

### Required Background Processes
| Service | Purpose | Frequency |
|---------|---------|-----------|
| Location Tracking | GPS updates | Every 5 seconds (online) |
| WebSocket Keepalive | Connection maintenance | Every 30 seconds |
| Push Notifications | Trip alerts | Real-time |
| Telemetry | Device health | Every 5 minutes |

---

## 18. Third-Party Service Dependencies

### Required External Services
| Service | Provider | Purpose |
|---------|----------|---------|
| Maps | Google | Mapping, directions |
| Background Check | Checkr | US driver verification |
| ID Verification | Persona/Onfido | Document verification |
| Face Recognition | AWS Rekognition | Driver ID match |
| Push Notifications | Firebase/APNs | Trip alerts |
| SMS OTP | Twilio | Phone verification |

### Required Secrets (Driver App)
```
GOOGLE_MAPS_API_KEY
CHECKR_API_KEY (US)
PERSONA_API_KEY / ONFIDO_API_KEY
AWS_REKOGNITION_ACCESS_KEY
AWS_REKOGNITION_SECRET_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
```

---

## 19. API Rate Limits

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Authentication | 5 req/min per IP |
| Location Updates | 12 req/min per user |
| Trip Actions | 10 req/min per user |
| General API | 100 req/min per user |

---

## 20. Minimum App Requirements

| Platform | Minimum Version |
|----------|-----------------|
| iOS | 14.0+ |
| Android | 8.0 (API 26)+ |

### Required Permissions
| Permission | Purpose |
|------------|---------|
| Location (Always) | Trip tracking, dispatch |
| Camera | Document upload, delivery proof |
| Notifications | Trip alerts |
| Microphone | Safety recording |
| Storage | Offline data |
| Background Location | Active trip tracking |

---

## 21. Fraud Prevention

### Anti-Fraud Features
| Feature | Description |
|---------|-------------|
| Fake GPS Detection | Blocks location spoofing |
| Device Fingerprinting | Unique device ID |
| One Account Per Device | Prevents multi-accounting |
| Behavioral Analysis | Trip pattern anomalies |
| IP Anomaly Detection | VPN/proxy detection |

---

## 22. Error Handling

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
| FORBIDDEN | 403 | Account suspended |
| NOT_VERIFIED | 403 | KYC not completed |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |
| OFFLINE | 503 | Driver not online |

---

## 23. Account Status Codes

| Status | Description | App Behavior |
|--------|-------------|--------------|
| `active` | Normal operation | Full access |
| `pending_verification` | KYC in progress | Limited access |
| `under_review` | Account under review | Read-only |
| `suspended` | Temporarily blocked | Login only |
| `banned` | Permanently blocked | No access |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | SafeGo Engineering | Initial release |

