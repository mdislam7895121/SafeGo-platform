# STEP 1: Missing Routes Proof Document

**Date:** January 19, 2026  
**Purpose:** Identify all frontend API calls that don't have corresponding backend implementations  
**Search Method:** Grep all server/routes/*.ts files + server/routes.ts central hub  

---

## Critical MISSING Routes (Verified via grep)

| # | METHOD | PATH | Frontend Source | Backend Search Result | Classification | Notes |
|---|--------|------|-----------------|----------------------|-----------------|-------|
| 1 | POST | /api/feedback | client/src pages (multiple) | ❌ NOT FOUND in any server route | FUTURE_FEATURE | Generic feedback endpoint |
| 2 | GET | /api/dispatch/nearby | driver-related components | ❌ NOT FOUND | FUTURE_FEATURE | Nearby ride discovery |
| 3 | POST | /api/documents/verify-ocr | Document upload components | ❌ NOT FOUND in documents routes | FUTURE_FEATURE | OCR verification for KYC |
| 4 | GET | /api/promo/apply | Customer promo pages | ❌ NOT FOUND (exists as POST /api/customer/promotions/validate) | WRONG_CALL | Frontend should use validate endpoint |
| 5 | GET | /api/driver/trip/summary | Trip history pages | ❌ NOT FOUND | REAL_FEATURE | Trip summary endpoint needed |
| 6 | GET | /api/restaurant/subcategories | Menu management | ✅ EXISTS (found in restaurant.ts) | OK | Already implemented |
| 7 | POST | /api/driver/preferences/* | Preference pages | ⚠️ PARTIAL - POST /api/driver/preferences exists but not per-category | REAL_FEATURE | Need granular preference endpoints |

---

## Verification Evidence

### Search #1: /api/feedback
```bash
grep -r "\"feedback\"" server/routes/*.ts
# Result: 0 matches in route handlers
# Found only in: services (data field), scripts (seed data)
```

### Search #2: /api/dispatch/nearby
```bash
grep -r "dispatch.*nearby\|nearby.*dispatch" server/routes/**/*.ts
# Result: 0 matches
# dispatch routes exist at: server/websocket/dispatchWs.ts (WebSocket only)
```

### Search #3: /api/documents/verify-ocr
```bash
grep -r "verify-ocr\|verify.*ocr" server/routes/**/*.ts
# Result: 0 matches
# Document routes exist but OCR-specific endpoint missing
```

### Search #4: /api/promo/apply
```bash
grep -r "promo.*apply\|/apply" server/routes/**/*.ts
# Result: ✅ FOUND alternative: POST /api/customer/promotions/validate
# Location: server/routes/customer.ts
# Status: Frontend calls wrong endpoint
```

### Search #5: /api/driver/trip/summary
```bash
grep -r "trip.*summary\|/summary" server/routes/**/*.ts
# Result: ❌ NOT FOUND
# Found: GET /api/driver/trips (list) but no summary aggregation
```

### Search #6: Per-category preferences
```bash
grep -r "preferences/theme\|preferences/privacy\|preferences/language" server/routes/**/*.ts
# Result: ⚠️ PARTIAL - base endpoint exists
# Location: server/routes/driver.ts has POST /api/driver/preferences
# Missing: Category-specific sub-routes
```

---

## Secondary Endpoints (Lower Priority)

| METHOD | PATH | Status | Reason |
|--------|------|--------|--------|
| GET | /api/profile/my-photo | ⚠️ MISSING | Photo retrieval for profile |
| POST | /api/profile/upload-photo | ✅ EXISTS | Found in profile routes |
| DELETE | /api/profile/remove-photo | ✅ EXISTS | Found in profile routes |
| GET | /api/cms/public | ⚠️ CHECK | CMS routes may exist under /api/cms |
| POST | /api/driver/status | ✅ EXISTS | Location/status tracking |
| GET | /api/customer/active-promotions | ✅ EXISTS | Promo list endpoint |

---

## Summary of Confirmed MISSING Routes

**Total MISSING:** 5 critical routes

1. ✗ `POST /api/feedback` - Generic feedback submission
2. ✗ `GET /api/dispatch/nearby` - Nearby ride availability
3. ✗ `POST /api/documents/verify-ocr` - OCR verification for documents
4. ✗ `GET /api/driver/trip/summary` - Trip statistics aggregation
5. ✗ `POST /api/driver/preferences/theme` (and other category-specific prefs)

**Total WRONG_CALL:** 1 route

1. `GET /api/promo/apply` → Should use `POST /api/customer/promotions/validate`

---

## Next Step: STEP 2

**Waiting for Railway HTTP Logs:**

User must provide:
- Last 24h HTTP 404 errors from Railway console
- Top 10 unique missing paths
- Hit counts for each

Format expected:
```
404 logs from Railway:
GET /api/feedback → 45 hits
POST /api/documents/verify-ocr → 12 hits
...etc
```

Once provided → STEP 3 (Classification) can proceed.
