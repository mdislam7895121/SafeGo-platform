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

## 4. Webhook Deduplication Tests

### 4.1 Duplicate Webhook Event
```bash
# Send same Stripe event ID twice
EVENT_ID="evt_test_12345"

# First request
curl -X POST http://localhost:5000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: <valid_signature>" \
  -d '{"id": "'$EVENT_ID'", "type": "payment_intent.succeeded", ...}' \
  -w "\nStatus: %{http_code}\n"

# Second request (duplicate)
curl -X POST http://localhost:5000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: <valid_signature>" \
  -d '{"id": "'$EVENT_ID'", "type": "payment_intent.succeeded", ...}' \
  -w "\nStatus: %{http_code}\n"
```
**Expected**: First returns 200 with processing, second returns 200 immediately (idempotent)

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

## Notes

- Run tests in development environment first
- Some tests may require database setup
- Rate limit windows reset after configured time
- Webhook tests require valid Stripe signature in production
