#!/bin/bash
# Test endpoints for SafeGo production auth flow

API_BASE="https://api.safegoglobal.com"
TEST_EMAIL="test+$(date +%s)@test.com"
TEST_PASSWORD="Test@123456"

echo "======================================"
echo "SafeGo API Endpoint Tests"
echo "======================================"
echo ""

# Test 1: Health endpoint
echo "1. Testing GET /api/health"
echo "   Expected: JSON with status='ok'"
echo ""
curl -i "$API_BASE/api/health" 2>/dev/null | head -20
echo ""
echo ""

# Test 2: Signup endpoint
echo "2. Testing POST /api/auth/signup"
echo "   Email: $TEST_EMAIL"
echo "   Expected: JSON response (either success or validation error, NOT HTML)"
echo ""
curl -i -X POST "$API_BASE/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"confirmPassword\": \"$TEST_PASSWORD\",
    \"countryCode\": \"US\"
  }" 2>/dev/null | head -30
echo ""
echo ""

# Test 3: Login endpoint
echo "3. Testing POST /api/auth/login"
echo "   Email: user@example.com (may not exist)"
echo "   Expected: JSON response (either success or validation error, NOT HTML)"
echo ""
curl -i -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"user@example.com\",
    \"password\": \"Test@123456\"
  }" 2>/dev/null | head -30
echo ""
echo ""

echo "======================================"
echo "Success Criteria:"
echo "✓ All responses have Content-Type: application/json"
echo "✓ No 'Cannot POST/GET' HTML error pages"
echo "✓ Status codes: 200 (success) or 4xx/5xx with JSON error body"
echo "======================================"
