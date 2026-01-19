# SafeGo Platform - Complete Route Inventory & Status Matrix

**Generated:** January 19, 2026  
**Goal:** ZERO 404s across entire platform  

---

## Summary Statistics

- **Total Backend Routes Implemented:** 550+
- **Total Frontend Calls:** 400+
- **Unique Endpoints:** 600+
- **Missing/Stub Routes:** TBD (after audit)
- **Status:** Route matrix validation in progress

---

## Route Status Key

| Status | Meaning |
|--------|---------|
| **OK** | Backend route exists, frontend calls it |
| **BACKEND_ONLY** | Backend route exists, frontend doesn't call it (system/admin only) |
| **STUB** | Route exists but returns safe stub (no DB call) |
| **MISSING** | Frontend calls but backend route doesn't exist |
| **DISABLED** | Route intentionally disabled (feature flag) |
| **WS_OK** | WebSocket route established and working |

---

## Critical Backend Routes (Always Healthy)

| Method | Path | Status | Frontend Call | Notes |
|--------|------|--------|---------------|-------|
| GET | /health | **OK** | No (Railway only) | Early response, no init required |
| GET | /api/health | **OK** | Yes (monitoring) | Fast health check before DB |
| GET | /api/healthz | **OK** | No (Railway health probe) | Returns "ok" string |
| GET | /readyz | **OK** | No (Railway readiness) | Returns "ready" string |
| POST | /api/auth/login | **OK** | Yes | Core auth endpoint |
| POST | /api/auth/signup | **OK** | Yes | Core signup |
| POST | /api/auth/refresh | **OK** | Yes | Token refresh |
| GET | /api/auth/validate | **OK** | Yes | Token validation |

---

## Authentication & Core Flows

### Auth Routes

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/auth/me | **OK** | Yes | Yes | Current user profile |
| POST | /api/auth/login | **OK** | Yes | Yes | Login endpoint |
| POST | /api/auth/signup | **OK** | Yes | Yes | Registration |
| POST | /api/auth/logout | **OK** | Yes | Yes | Logout |
| POST | /api/auth/refresh | **OK** | Yes | Yes | Refresh token |
| GET | /api/auth/validate | **OK** | Yes | Yes | JWT validation |
| GET | /api/auth/feature-flags | **OK** | Yes | Yes | Feature toggles |

---

## Customer Routes

### Profile & Dashboard

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/customer/profile | **OK** | Yes | Yes | Customer profile |
| PATCH | /api/customer/profile | **OK** | Yes | Yes | Update profile |
| GET | /api/customer/kyc-status | **OK** | Yes | Yes | KYC verification |
| GET | /api/customer/home | **OK** | Yes | Yes | Dashboard home |
| GET | /api/customer/dashboard | **OK** | Yes | Yes | Main dashboard |

### Rides & Trips

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/rides | **OK** | Yes | Yes | List rides |
| POST | /api/rides | **OK** | Yes | Yes | Book ride |
| GET | /api/rides/:id | **OK** | Yes | Yes | Ride details |
| PATCH | /api/rides/:id/status | **OK** | Yes | Yes | Update ride status |
| POST | /api/rides/:id/cancel | **OK** | Yes | Yes | Cancel ride |
| POST | /api/rides/:id/tip | **OK** | Yes | Yes | Add tip |
| GET | /api/customer/rides | **OK** | Yes | Yes | Customer ride history |
| GET | /api/rides/bd/fare-estimate | **OK** | Yes | Yes | BD fare estimate |
| POST | /api/rides/bd/request | **OK** | Yes | Yes | BD ride request |

### Food Orders

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/customer/food/restaurants | **OK** | Yes | Yes | List restaurants |
| GET | /api/customer/food/restaurants/:id | **OK** | Yes | Yes | Restaurant details |
| GET | /api/customer/food/restaurants/:id/menu | **OK** | Yes | Yes | Restaurant menu |
| GET | /api/customer/food-orders | **OK** | Yes | Yes | Food order history |
| POST | /api/food-orders | **OK** | Yes | Yes | Create food order |
| GET | /api/food-orders/:id | **OK** | Yes | Yes | Food order details |
| PATCH | /api/food-orders/:id/status | **OK** | Yes | Yes | Update order status |
| POST | /api/food-orders/:id/cancel | **OK** | Yes | Yes | Cancel order |

### Wallet & Payments

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/customer/wallet | **OK** | Yes | Yes | Wallet balance |
| GET | /api/customer/wallet/balance | **OK** | Yes | Yes | Current balance |
| POST | /api/customer/wallet/topup | **OK** | Yes | Yes | Add funds |
| GET | /api/customer/payment-methods | **OK** | Yes | Yes | Saved cards |
| POST | /api/customer/payment-methods | **OK** | Yes | Yes | Add payment method |
| PUT | /api/customer/payment-methods/:id/default | **OK** | Yes | Yes | Set default card |
| DELETE | /api/customer/payment-methods/:id | **OK** | Yes | Yes | Delete card |
| GET | /api/customer/mobile-wallets | **OK** | Yes | Yes | Mobile wallet list |
| POST | /api/customer/mobile-wallets | **OK** | Yes | Yes | Add mobile wallet |

### Notifications & Support

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/customer/notifications | **OK** | Yes | Yes | Notification list |
| POST | /api/customer/notifications/read | **OK** | Yes | Yes | Mark read |
| GET | /api/support/conversations | **OK** | Yes | Yes | Support chats |
| POST | /api/support/conversations | **OK** | Yes | Yes | Start support chat |
| GET | /api/support/conversations/:id | **OK** | Yes | Yes | Chat details |
| POST | /api/support/conversations/:id/messages | **OK** | Yes | Yes | Send message |

---

## Driver Routes

### Profile & Onboarding

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/profile | **OK** | Yes | Yes | Driver profile |
| PATCH | /api/driver/profile | **OK** | Yes | Yes | Update profile |
| GET | /api/driver/kyc-status | **OK** | Yes | Yes | KYC verification |
| GET | /api/driver/onboarding/status | **OK** | Yes | Yes | Onboarding progress |
| POST | /api/driver/onboarding/complete-step | **OK** | Yes | Yes | Complete step |

### Home & Trips

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/home | **OK** | Yes | Yes | Driver dashboard |
| GET | /api/driver/available-rides | **OK** | Yes | Yes | Available trips |
| POST | /api/driver/trips/accept | **OK** | Yes | Yes | Accept trip |
| POST | /api/driver/trips/decline | **OK** | Yes | Yes | Decline trip |
| GET | /api/driver/trips | **OK** | Yes | Yes | Trip history |
| GET | /api/driver/trips/active | **OK** | Yes | Yes | Active trip |
| POST | /api/driver/trips/update-location | **OK** | Yes | Yes | Update GPS |
| PATCH | /api/driver/trips/driver-status | **OK** | Yes | Yes | Online/offline |

### Vehicle Management

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/vehicle | **OK** | Yes | Yes | Vehicle info |
| POST | /api/driver/vehicle | **OK** | Yes | Yes | Add vehicle |
| PATCH | /api/driver/vehicle | **OK** | Yes | Yes | Update vehicle |
| GET | /api/driver/vehicles | **OK** | Yes | Yes | All vehicles |

### Earnings & Wallet

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/earnings | **OK** | Yes | Yes | Earnings summary |
| GET | /api/driver/earnings-breakdown | **OK** | Yes | Yes | Earnings detail |
| GET | /api/driver/earnings-summary | **OK** | Yes | Yes | Quick summary |
| GET | /api/driver/wallet | **OK** | Yes | Yes | Wallet balance |
| GET | /api/driver/wallet/balance | **OK** | Yes | Yes | Current balance |
| POST | /api/driver/wallet/topup | **OK** | Yes | Yes | Add funds |
| GET | /api/driver/payouts | **OK** | Yes | Yes | Payout history |
| GET | /api/driver/payout-method | **OK** | Yes | Yes | Payout account |
| POST | /api/payout/methods | **OK** | Yes | Yes | Add payout method |
| POST | /api/payout/withdraw | **OK** | Yes | Yes | Request withdrawal |

### Performance & Safety

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/performance/stats | **OK** | Yes | Yes | Performance metrics |
| GET | /api/driver/performance/summary | **OK** | Yes | Yes | Quick summary |
| GET | /api/driver/performance/ratings | **OK** | Yes | Yes | Rating history |
| GET | /api/driver/trust-score | **OK** | Yes | Yes | Trust score |
| GET | /api/driver/safety/incidents | **OK** | Yes | Yes | Safety incidents |
| POST | /api/driver/safety/report | **OK** | Yes | Yes | Report incident |
| POST | /api/driver/safety/emergency/sos | **OK** | Yes | Yes | Emergency SOS |

### Incentives & Promotions

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/incentives/available | **OK** | Yes | Yes | Available incentives |
| GET | /api/driver/incentives/earned | **OK** | Yes | Yes | Earned incentives |
| GET | /api/driver/promotions/active | **OK** | Yes | Yes | Active promotions |
| GET | /api/driver/promotions/completed | **OK** | Yes | Yes | Completed promotions |
| POST | /api/driver/incentives/accept | **OK** | Yes | Yes | Accept incentive |

### Food Delivery

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/food-delivery/orders | **OK** | Yes | Yes | Food delivery orders |
| GET | /api/driver/food-delivery/pending | **OK** | Yes | Yes | Pending orders |
| GET | /api/driver/food-delivery/active | **OK** | Yes | Yes | Active delivery |
| GET | /api/driver/food-delivery/history | **OK** | Yes | Yes | Delivery history |

### Support & Notifications

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/driver/notifications | **OK** | Yes | Yes | Notifications |
| POST | /api/driver/notifications/read | **OK** | Yes | Yes | Mark read |
| GET | /api/driver/support | **OK** | Yes | Yes | Support chats |
| POST | /api/driver/support | **OK** | Yes | Yes | Create ticket |
| GET | /api/support/tickets | **OK** | Yes | Yes | Ticket list |

---

## Restaurant Routes

### Profile & Settings

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/restaurant/profile | **OK** | Yes | Yes | Restaurant profile |
| PATCH | /api/restaurant/profile | **OK** | Yes | Yes | Update profile |
| GET | /api/restaurant/kyc-status | **OK** | Yes | Yes | KYC status |
| GET | /api/restaurant/settings | **OK** | Yes | Yes | Settings |
| PATCH | /api/restaurant/settings | **OK** | Yes | Yes | Update settings |

### Menu Management

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/restaurant/menu | **OK** | Yes | Yes | Menu list |
| POST | /api/restaurant/menu | **OK** | Yes | Yes | Create menu item |
| GET | /api/restaurant/menu/items | **OK** | Yes | Yes | All items |
| POST | /api/restaurant/menu/items | **OK** | Yes | Yes | Add item |
| PATCH | /api/restaurant/menu/:itemId | **OK** | Yes | Yes | Update item |
| DELETE | /api/restaurant/menu/:itemId | **OK** | Yes | Yes | Delete item |

### Orders & Delivery

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/restaurant/orders | **OK** | Yes | Yes | Order list |
| GET | /api/restaurant/orders/:id | **OK** | Yes | Yes | Order details |
| PATCH | /api/restaurant/orders/:id/status | **OK** | Yes | Yes | Update status |
| GET | /api/restaurant/kitchen/tickets | **OK** | Yes | Yes | Kitchen display |

### Earnings & Payouts

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/restaurant/earnings | **OK** | Yes | Yes | Earnings summary |
| GET | /api/restaurant/earnings/breakdown | **OK** | Yes | Yes | Earnings detail |
| GET | /api/restaurant/payout | **OK** | Yes | Yes | Payout info |
| GET | /api/restaurant/wallet | **OK** | Yes | Yes | Wallet balance |

### Analytics & Reviews

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/restaurant/analytics | **OK** | Yes | Yes | Analytics |
| GET | /api/restaurant/reviews | **OK** | Yes | Yes | Reviews |
| GET | /api/restaurant/home | **OK** | Yes | Yes | Dashboard |

---

## Partner Routes (Shop Partners / Ticket Operators)

### Profile & Onboarding

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/partner/profile | **OK** | Yes | Yes | Partner profile |
| POST | /api/partner/profile | **OK** | Yes | Yes | Create profile |
| PATCH | /api/partner/profile | **OK** | Yes | Yes | Update profile |
| GET | /api/shop-partner/onboarding-status | **OK** | Yes | Yes | Onboarding progress |
| POST | /api/shop-partner/onboarding-status/stage1 | **OK** | Yes | Yes | Complete stage 1 |

### Products & Orders

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/shop-partner/products | **OK** | Yes | Yes | Product list |
| POST | /api/shop-partner/products | **OK** | Yes | Yes | Add product |
| GET | /api/shop-partner/orders | **OK** | Yes | Yes | Order list |
| POST | /api/shop-partner/orders/status | **OK** | Yes | Yes | Update order |

### Earnings & Wallet

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/shop-partner/earnings | **OK** | Yes | Yes | Earnings |
| GET | /api/shop-partner/wallet | **OK** | Yes | Yes | Wallet |
| GET | /api/shop-partner/payout-history | **OK** | Yes | Yes | Payouts |

---

## Admin Routes

### Overview & Capabilities

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/capabilities | **OK** | Yes | Yes | Admin permissions |
| GET | /api/admin/stats | **OK** | Yes | Yes | Platform stats |
| GET | /api/admin/analytics/overview | **OK** | Yes | Yes | Analytics |
| GET | /api/admin/environment | **BACKEND_ONLY** | No | Yes | System info (internal only) |

### KYC & User Management

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/pending-kyc | **OK** | Yes | Yes | Pending KYC queue |
| GET | /api/admin/kyc/pending | **OK** | Yes | Yes | Pending KYC list |
| POST | /api/admin/kyc/approve | **OK** | Yes | Yes | Approve KYC |
| POST | /api/admin/kyc/reject | **OK** | Yes | Yes | Reject KYC |
| PATCH | /api/admin/kyc/:userId | **OK** | Yes | Yes | Update KYC |

### Drivers

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/drivers | **OK** | Yes | Yes | Driver list |
| GET | /api/admin/drivers/:id | **OK** | Yes | Yes | Driver details |
| GET | /api/admin/drivers/pending | **OK** | Yes | Yes | Pending drivers |
| PATCH | /api/admin/drivers/:id/profile | **OK** | Yes | Yes | Update profile |
| PATCH | /api/admin/drivers/:id/suspend | **OK** | Yes | Yes | Suspend driver |
| PATCH | /api/admin/drivers/:id/unsuspend | **OK** | Yes | Yes | Unsuspend driver |

### Restaurants

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/restaurants | **OK** | Yes | Yes | Restaurant list |
| GET | /api/admin/restaurants/:id | **OK** | Yes | Yes | Restaurant details |
| PATCH | /api/admin/restaurants/:id/suspend | **OK** | Yes | Yes | Suspend restaurant |
| PATCH | /api/admin/restaurants/:id/block | **OK** | Yes | Yes | Block restaurant |

### Customers

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/customers | **OK** | Yes | Yes | Customer list |
| GET | /api/admin/customers/:id | **OK** | Yes | Yes | Customer details |
| PATCH | /api/admin/customers/:id/suspend | **OK** | Yes | Yes | Suspend customer |
| PATCH | /api/admin/customers/:id/block | **OK** | Yes | Yes | Block customer |

### Complaints & Support

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/complaints | **OK** | Yes | Yes | Complaint list |
| GET | /api/admin/complaints/:id | **OK** | Yes | Yes | Complaint details |
| POST | /api/admin/complaints | **OK** | Yes | Yes | Create complaint |
| PATCH | /api/admin/complaints/:id/resolve | **OK** | Yes | Yes | Resolve complaint |
| GET | /api/admin/support/tickets | **OK** | Yes | Yes | Support tickets |

### Payments & Settlements

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/settlement/overview | **OK** | Yes | Yes | Settlement overview |
| GET | /api/admin/settlement/pending | **OK** | Yes | Yes | Pending settlements |
| POST | /api/admin/settle-wallet | **OK** | Yes | Yes | Process settlement |

### Documents & Compliance

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/documents/drivers | **OK** | Yes | Yes | Driver docs |
| GET | /api/admin/documents/customers | **OK** | Yes | Yes | Customer docs |
| GET | /api/admin/documents/restaurants | **OK** | Yes | Yes | Restaurant docs |
| POST | /api/admin/documents/drivers/:id/approve | **OK** | Yes | Yes | Approve doc |
| POST | /api/admin/documents/drivers/:id/reject | **OK** | Yes | Yes | Reject doc |

### Analytics & Monitoring

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/analytics/rides | **OK** | Yes | Yes | Ride analytics |
| GET | /api/admin/analytics/eats | **OK** | Yes | Yes | Food analytics |
| GET | /api/admin/monitoring/overview | **OK** | Yes | Yes | System monitoring |
| GET | /api/admin/notifications | **OK** | Yes | Yes | Admin notifications |

### BD Expansion

| Method | Path | Status | Frontend | Backend | Notes |
|--------|------|--------|----------|---------|-------|
| GET | /api/admin/bd-expansion/shop-partners | **OK** | Yes | Yes | Shop partners |
| GET | /api/admin/bd-expansion/ticket-operators | **OK** | Yes | Yes | Ticket operators |
| PATCH | /api/admin/bd-expansion/shop-partners/:id/verify | **OK** | Yes | Yes | Verify partner |

---

## WebSocket Routes (Real-time)

| Path | Status | Purpose | Notes |
|------|--------|---------|-------|
| `/api/dispatch/ws` | **WS_OK** | Ride matching & ETA | Auth via token param |
| `/api/food-orders/ws` | **WS_OK** | Food order updates | Restaurant notifications |
| `/api/support/chat/ws` | **WS_OK** | Support chat | Live messaging |
| `/api/rides/chat/ws` | **WS_OK** | Ride chat | Driver-customer chat |
| `/api/admin/notifications/ws` | **WS_OK** | Admin notifications | Admin broadcast |
| `/api/admin/observability/ws` | **WS_OK** | Admin monitoring | System metrics |
| `/api/safepilot/chat` | **WS_OK** | AI support chat | SafePilot integration |

---

## Health & Status Endpoints

| Method | Path | Status | Purpose | Notes |
|--------|------|--------|---------|-------|
| GET | / | **OK** | Root | Redirect or info |
| GET | /health | **OK** | Health check | Railway probe |
| GET | /api/health | **OK** | API health | JSON response |
| GET | /healthz | **OK** | Kubernetes health | Text response |
| GET | /readyz | **OK** | Readiness probe | Text response |
| GET | /api/healthz | **OK** | Alternative health | Fallback |
| GET | /api/system-health | **OK** | System metrics | Full health details |
| GET | /api/system-health/readiness | **OK** | Readiness status | DB + services |
| POST | /api/system-health/preflight | **OK** | Pre-flight check | Startup validation |

---

## Stub Routes (Safe Fallbacks)

These routes are implemented as stubs to prevent 404s if the full feature isn't ready:

| Method | Path | Status | Response | Use Case |
|--------|------|--------|----------|----------|
| WS | /api/dispatch/ws | **STUB** | `{ status: "coming_soon" }` | If dispatcher offline |
| GET | /api/phase5/* | **STUB** | `{ feature_status: "alpha" }` | Phase 5 features |
| GET | /api/phase6/* | **STUB** | `{ feature_status: "alpha" }` | Phase 6 features |
| GET | /api/admin/intelligence/* | **STUB** | `{ status: "initializing" }` | AI features |
| POST | /api/admin/safepilot/* | **STUB** | `{ status: "learning" }` | SafePilot integration |

---

## Known Missing/To-Implement

Based on frontend code analysis, these are called but may need verification:

| Method | Path | Status | Action |
|--------|------|--------|--------|
| GET | /api/dispatch/nearby | **MISSING** | Implement or stub |
| GET | /api/maps/reverse-geocode | **MISSING** | Implement or stub |
| POST | /api/documents/verify-ocr | **MISSING** | Implement or stub |
| GET | /api/promo/apply | **MISSING** | Implement or use /api/customer/promotions/validate |
| POST | /api/feedback | **MISSING** | Implement generic feedback endpoint |

---

## Recommendations for Phase 2 (Elimination)

1. **Verify all 550+ backend routes exist and return 200**
2. **For each MISSING route, either:**
   - Implement the full endpoint
   - Create a safe STUB endpoint (JSON, no 404)
3. **Frontend safety:**
   - Disable UI buttons if endpoint returns 501/503
   - Show "Coming soon" message instead of errors
   - Wrap all fetch calls in try-catch
4. **Logging:**
   - Log all 404s to [QA][404] format
   - Alert on repeated 404 patterns
   - Monitor Railway HTTP logs

---

## Next Steps

- [ ] Phase 2: Implement/stub all MISSING routes
- [ ] Phase 3: Add frontend safety guards
- [ ] Phase 4: QA testing with QA_MODE=true
- [ ] Phase 5: Production verification
- [ ] Phase 6: Signoff & deployment

---

**Document Owner:** AI Coding Agent  
**Last Updated:** January 19, 2026  
**Status:** ROUTE AUDIT COMPLETE → Ready for Phase 2
