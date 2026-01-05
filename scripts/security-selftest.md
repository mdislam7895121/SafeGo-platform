# Security Self-Test Checklist

This document provides manual testing steps to verify the security hardening implementation.

## Prerequisites

- Server running on port 5000
- Valid test user credentials
- curl or similar HTTP client

## 1. Rate Limiting Tests

### 1.1 OTP Rate Limit (429)
```bash
# Send multiple OTP requests quickly - should hit 429 after 3/minute
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/auth/otp/request \
    -H "Content-Type: application/json" \
    -d '{"phone": "+8801700000001"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.5
done
```
**Expected**: First 3 return 200, remaining return 429

### 1.2 Auth Rate Limit
```bash
# Send multiple login attempts - should hit 429 after 5 per identifier
for i in {1..7}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "wrongpass"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 0.3
done
```
**Expected**: Returns 429 after 5 attempts for same email

### 1.3 Landing Rate Limit
```bash
# Hit landing page rapidly
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/
done | sort | uniq -c
```
**Expected**: ~100 return 200, remaining return 429

## 2. Input Validation Tests

### 2.1 Invalid Signup Body (400)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "not-an-email"}' \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 400 with VALIDATION_ERROR code and issues array

### 2.2 Missing Required Fields
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 400 with validation error about missing email/password

## 3. Authorization Tests

### 3.1 Ride Ownership Check
```bash
# Get a valid token for User A
TOKEN_A="<user_a_token>"

# Try to access User B's ride
curl -X GET http://localhost:5000/api/rides/<user_b_ride_id> \
  -H "Authorization: Bearer $TOKEN_A" \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 403 "Access denied. You do not own this ride."

### 3.2 Food Order Ownership
```bash
# Try to access another user's order
curl -X GET http://localhost:5000/api/food-orders/<other_user_order_id> \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 403 access denied

## 4. Webhook Deduplication Tests (Drizzle ORM)

The webhook deduplication is implemented using Drizzle ORM with the `stripe_webhook_events` table.

### 4.1 Duplicate Webhook Event
```bash
# Send same Stripe event ID twice
EVENT_ID="evt_test_$(date +%s)"

# First request - should insert and process
curl -X POST http://localhost:5000/api/payment-webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test_sig" \
  -d '{"id": "'$EVENT_ID'", "type": "payment_intent.succeeded"}' \
  -w "\nStatus: %{http_code}\n"

# Second request (duplicate) - should return duplicate:true immediately
curl -X POST http://localhost:5000/api/payment-webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test_sig" \
  -d '{"id": "'$EVENT_ID'", "type": "payment_intent.succeeded"}' \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 
- First returns 200 with `{"received": true}` (or 400 if signature validation fails in prod)
- Second returns 200 with `{"received": true, "duplicate": true}` immediately

### 4.2 Verify Database Deduplication Table
```sql
-- Check the stripe_webhook_events table contains one row per event id
SELECT id, "stripeEventId", "eventType", status, "processedAt" 
FROM stripe_webhook_events 
ORDER BY "processedAt" DESC 
LIMIT 10;
```
**Expected**: One row per unique Stripe event ID with status "processed" or "failed"

### 4.3 Console Log Verification (Development)
In development mode, check server logs for:
```
[WebhookDedupe] New event recorded: evt_xxx (payment_intent.succeeded)
[WebhookDedupe] Duplicate event detected: evt_xxx (payment_intent.succeeded)
```

## 5. Security Headers Tests

### 5.1 Check Security Headers
```bash
curl -I http://localhost:5000/ 2>/dev/null | grep -E "^(X-|Content-Security|Strict-Transport)"
```
**Expected Headers**:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=...
- Content-Security-Policy: ...

### 5.2 CORS Origin Check
```bash
# Valid origin
curl -X OPTIONS http://localhost:5000/api/auth/login \
  -H "Origin: http://localhost:5000" \
  -H "Access-Control-Request-Method: POST" \
  -I 2>/dev/null | grep "Access-Control"

# Invalid origin (production mode)
curl -X OPTIONS http://localhost:5000/api/auth/login \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -I 2>/dev/null | grep "Access-Control"
```

## 6. Log Redaction Tests

### 6.1 Verify Sensitive Data Not Logged
Check server logs after making requests with sensitive data:
```bash
# Make request with password
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SuperSecret123!"}'

# Check logs don't contain password
grep -i "SuperSecret123" /var/log/safego/*.log
```
**Expected**: No matches found

### 6.2 Authorization Header Redaction
```bash
# Make authenticated request
curl -X GET http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Check logs don't contain full token
grep "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" /var/log/safego/*.log
```
**Expected**: No matches or shows [REDACTED]

## 7. Authentication Tests

### 7.1 Expired Token Rejection
```bash
EXPIRED_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxfQ.xxx"

curl -X GET http://localhost:5000/api/user/profile \
  -H "Authorization: Bearer $EXPIRED_TOKEN" \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 403 "Invalid or expired token"

### 7.2 Missing Token Rejection
```bash
curl -X GET http://localhost:5000/api/user/profile \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 401 "Access token required"

## 8. Refresh Token Rotation & Reuse Detection Tests

The refresh token system implements database-backed token rotation with reuse detection.
Table: `auth_refresh_tokens` (Drizzle ORM)

### 8.1 Normal Token Rotation
```bash
# Login to get initial tokens
LOGIN_RESP=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPass123!"}')
ACCESS_TOKEN=$(echo $LOGIN_RESP | jq -r '.token')

# First refresh - should succeed and rotate token
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/refresh \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 200 with new access token, cookie updated with rotated refresh token

### 8.2 Reuse Detection (Security Critical)
```bash
# Step 1: Login
curl -s -c cookies1.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPass123!"}'

# Step 2: Copy cookie for "attacker" simulation
cp cookies1.txt cookies_attacker.txt

# Step 3: Legitimate user refreshes (rotates token)
curl -s -b cookies1.txt -c cookies1.txt -X POST http://localhost:5000/api/auth/refresh
echo "First refresh: Success (token rotated)"

# Step 4: Attacker tries to use OLD token (should trigger reuse detection)
curl -s -b cookies_attacker.txt -X POST http://localhost:5000/api/auth/refresh \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 
- Step 3: 200 success
- Step 4: 401 with `{"error": "Session invalidated for security...", "code": "TOKEN_REUSE_DETECTED"}`
- All user sessions are revoked (global logout)

### 8.3 Logout Revocation
```bash
# Login
curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPass123!"}'
ACCESS_TOKEN=$(curl -s -b cookies.txt -X POST http://localhost:5000/api/auth/refresh | jq -r '.token')

# Logout (revokes refresh token in database)
curl -s -b cookies.txt -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Try to refresh after logout (should fail)
curl -s -b cookies.txt -X POST http://localhost:5000/api/auth/refresh \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: 401 "Token not found" or "Token revoked"

### 8.4 Verify Database Token Storage
```sql
-- Check refresh tokens table (token_hash is hashed, never plaintext)
SELECT id, user_id, 
       LEFT(token_hash, 16) || '...' as token_hash_preview,
       created_at, expires_at, revoked_at, replaced_by_token_id
FROM auth_refresh_tokens 
ORDER BY created_at DESC 
LIMIT 10;
```
**Expected**: 
- `token_hash` contains SHA-256 hash (not plaintext)
- `revoked_at` is set for used/revoked tokens
- `replaced_by_token_id` links to new token after rotation

### 8.5 Console Log Verification (Development)
Check server logs for:
```
[RefreshToken] Issued token for user abc12345...
[RefreshToken] Rotated token for user abc12345...
[RefreshToken] REUSE DETECTED for user abc12345... - revoking all tokens
[RefreshToken] Revoked 3 tokens for user abc12345...
```
**Note**: Token values are NEVER logged

## Test Results Summary

| Test Category | Test Name | Expected | Actual | Pass/Fail |
|--------------|-----------|----------|--------|-----------|
| Rate Limiting | OTP 429 | 429 after 3 | | |
| Rate Limiting | Auth 429 | 429 after 5 | | |
| Validation | Invalid email | 400 | | |
| Authorization | Ride ownership | 403 | | |
| Webhook | Duplicate dedupe | 200 idempotent | | |
| Headers | X-Frame-Options | DENY | | |
| Auth | Expired token | 403 | | |
| Refresh Token | Normal rotation | 200 + new token | | |
| Refresh Token | Reuse detection | 401 + global logout | | |
| Refresh Token | Logout revocation | 401 after logout | | |

## Notes

- Run tests in development environment first
- Some tests may require database setup
- Rate limit windows reset after configured time
- Webhook tests require valid Stripe signature in production
