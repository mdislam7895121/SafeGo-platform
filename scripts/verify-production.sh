#!/bin/bash
# SafeGo Production Verification Tests
# Run these tests to verify the deployment is working correctly

set -e

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="https://api.safegoglobal.com"
FRONTEND_BASE="https://safego-platform.netlify.app" # Update with actual domain

echo -e "${YELLOW}=== SafeGo Production Verification ===${NC}\n"

# Test 1: Health endpoint
echo -e "${YELLOW}Test 1: Health Endpoint${NC}"
echo "Running: curl -i $API_BASE/api/health"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Status: 200 OK${NC}"
  echo "Response:"
  echo "$BODY" | jq . || echo "$BODY"
  echo ""
else
  echo -e "${RED}✗ Status: $HTTP_CODE (expected 200)${NC}"
  echo "Response: $BODY"
  echo ""
fi

# Test 2: Auth signup endpoint (should reject invalid data but return JSON)
echo -e "${YELLOW}Test 2: Auth Signup Endpoint (Invalid Data)${NC}"
echo "Running: curl -X POST $API_BASE/api/auth/signup with empty body"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "Status: $HTTP_CODE"
if [[ "$BODY" == "{" ]] || [[ "$BODY" == *"error"* ]]; then
  echo -e "${GREEN}✓ Response is JSON${NC}"
  echo "Response:"
  echo "$BODY" | jq . || echo "$BODY"
  echo ""
else
  echo -e "${RED}✗ Response does not appear to be JSON${NC}"
  echo "Response: $BODY"
  echo ""
fi

# Test 3: Check response Content-Type header
echo -e "${YELLOW}Test 3: Content-Type Headers${NC}"
echo "Checking /api/health response headers:"
curl -i -s "$API_BASE/api/health" | grep -i "content-type" || echo "No Content-Type header found"
echo ""

# Test 4: CORS preflight
echo -e "${YELLOW}Test 4: CORS Preflight${NC}"
echo "Running: OPTIONS request with Origin header"
RESPONSE=$(curl -s -i -X OPTIONS "$API_BASE/api/auth/signup" \
  -H "Origin: $FRONTEND_BASE" \
  -H "Access-Control-Request-Method: POST")

if echo "$RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
  echo -e "${GREEN}✓ CORS headers present${NC}"
  echo "$RESPONSE" | grep "Access-Control-Allow"
  echo ""
else
  echo -e "${YELLOW}⚠ CORS headers not found (may not be configured)${NC}"
  echo ""
fi

# Test 5: Check for HTML in error responses
echo -e "${YELLOW}Test 5: Verify No HTML in Error Responses${NC}"
echo "Checking /api/nonexistent endpoint:"
RESPONSE=$(curl -s "$API_BASE/api/nonexistent")
if [[ "$RESPONSE" == "{" ]] || [[ "$RESPONSE" == *"error"* ]]; then
  echo -e "${GREEN}✓ Error response is JSON${NC}"
  echo "Response:"
  echo "$RESPONSE" | jq . || echo "$RESPONSE"
  echo ""
else
  echo -e "${RED}✗ Error response may be HTML${NC}"
  echo "Response: $RESPONSE"
  echo ""
fi

# Test 6: Database health (if available)
echo -e "${YELLOW}Test 6: Database Health${NC}"
echo "Running: curl $API_BASE/api/health/db"
RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/health/db")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Database connected${NC}"
  echo "$BODY" | jq . || echo "$BODY"
else
  echo -e "${YELLOW}⚠ Database check returned $HTTP_CODE${NC}"
  echo "$BODY" | jq . || echo "$BODY"
fi
echo ""

echo -e "${YELLOW}=== Verification Complete ===${NC}"
echo -e "
If all tests passed:
- ${GREEN}✓${NC} API is accessible and returning JSON
- ${GREEN}✓${NC} Auth endpoints are available
- ${GREEN}✓${NC} CORS headers are configured
- ${GREEN}✓${NC} Error responses are JSON (not HTML)

Next steps:
1. Test signup/login in browser
2. Check browser console for any errors
3. Verify Network tab shows Content-Type: application/json
4. Check deployment logs for any warnings
"
