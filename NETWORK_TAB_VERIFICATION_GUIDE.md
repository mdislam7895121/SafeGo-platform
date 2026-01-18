# Browser Network Tab - Visual Guide

## Quick Reference: What You'll See

When you login/signup through the frontend, here's what appears in DevTools Network tab:

---

## Network Request Details

### Request URL Format

```
http://localhost:3000/api/auth/login
```

**Breakdown**:
- `http://` — Protocol
- `localhost` — Hostname (not example.com, not 127.0.0.1)
- `:3000` — **Port 3000 (CORRECT)** ✅
- `/api/auth/login` — Endpoint path

**DO NOT SEE**:
- ✗ `localhost:8080` (old port)
- ✗ `localhost:5173` (frontend port)
- ✗ `example.com` (wrong domain)

---

## Network Tab Columns to Check

### Essential Columns

| Column | Expected Value | Why It Matters |
|--------|---|---|
| **Name** | `auth/login` | Shows endpoint name |
| **Type** | `fetch` or `xhr` | Shows it's an API call |
| **Status** | `401` or `200` | Means backend responded (not 404) |
| **Initiator** | `apiFetch()` or auth module | Shows which component made call |
| **Size** | `100 B - 1 KB` | Reasonable response size |
| **Time** | `100ms - 500ms` | Round-trip time |

### Full URL Column

**Click on the request** → inspect the "Headers" tab → look for:

```
Request URL: http://localhost:3000/api/auth/login
```

---

## Request Headers (What Frontend Sends)

```
POST /api/auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 77
Origin: http://localhost:5173
Referer: http://localhost:5173/

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Key Headers**:
- ✅ `Host: localhost:3000` — Confirms port 3000
- ✅ `Origin: http://localhost:5173` — Frontend sending from port 5173
- ✅ `Content-Type: application/json` — Auto-injected by apiFetch()

---

## Response Headers (What Backend Returns)

```
HTTP/1.1 401 Unauthorized
Server: Express
Content-Type: application/json; charset=utf-8
Content-Length: 31
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Date: Sun, 18 Jan 2026 18:48:06 GMT
```

**Key Response Headers**:
- ✅ `Access-Control-Allow-Origin: *` — CORS enabled
- ✅ `Content-Type: application/json` — Response is JSON
- ✅ `HTTP/1.1 401` — Backend is responding (not HTML error page)

---

## Response Body (What Backend Sends Back)

### Success (HTTP 200)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-123",
    "email": "user@example.com",
    "role": "customer",
    "countryCode": "BD"
  }
}
```

### Error (HTTP 401)

```json
{
  "error": "Invalid credentials"
}
```

### Error (HTTP 400)

```json
{
  "error": "Email is required"
}
```

**Key**: Response is always **JSON**, never HTML

---

## DevTools Network Tab - Step by Step

### Step 1: Open Frontend
```
Go to: http://localhost:5173
```

### Step 2: Open DevTools
```
Press: F12 (or right-click → Inspect)
```

### Step 3: Go to Network Tab
```
Click: "Network" tab
```

### Step 4: Clear Previous Requests
```
Right-click on requests → Clear browser cache
(optional, to start fresh)
```

### Step 5: Try Login
```
Fill in email: test@example.com
Fill in password: anything
Click: Login button
```

### Step 6: Look for New Request
```
In Network tab, you should see new request appear:
- Name: "login" (highlighted)
- Type: "fetch"
- Status: "401" or "200"
```

### Step 7: Click on Request
```
Left-click on "login" request in the list
```

### Step 8: Check Details
```
Look for tabs at the bottom:
- Headers: Shows "Request URL: http://localhost:3000/api/auth/login"
- Request: Shows JSON body you sent
- Response: Shows JSON response from backend
- Timing: Shows how long it took
```

---

## Common Issues & Fixes

### Issue 1: Request URL shows localhost:8080
**Problem**: Frontend is still calling old port  
**Fix**: Update `.env.local` to `VITE_API_BASE_URL=http://localhost:3000`  
**Verify**: Restart frontend dev server (Ctrl+C, then `npm run dev`)

### Issue 2: Status shows 404 Not Found
**Problem**: Backend endpoint doesn't exist or wrong URL  
**Fix**: Check backend is running on port 3000  
**Verify**: `curl -i http://localhost:3000/health`

### Issue 3: Status shows 502 Bad Gateway
**Problem**: Backend is not responding  
**Fix**: Restart backend server  
**Verify**: `curl -i http://localhost:3000/health`

### Issue 4: Request goes to localhost:5173
**Problem**: Frontend is calling itself (broken setup)  
**Fix**: Check `.env.local` and rebuild frontend cache  
**Verify**: Delete `.vite` folder in node_modules, restart `npm run dev`

### Issue 5: CORS Error in Console
**Problem**: Frontend can't access backend response  
**Fix**: Ensure backend has CORS headers (should be automatic)  
**Verify**: Response headers include `Access-Control-Allow-Origin: *`

---

## Timeline Example: Successful Request

```
Time    Event
----    -----
18:48:00  User opens http://localhost:5173
18:48:05  User enters email and password
18:48:06  User clicks "Login" button
18:48:06  Frontend runs: apiFetch("/api/auth/login", {...})
18:48:06  Frontend constructs URL: "http://localhost:3000/api/auth/login"
18:48:06  Frontend sends: POST http://localhost:3000/api/auth/login
18:48:06  Backend receives request
18:48:06  Backend validates credentials
18:48:06  Backend sends response (200 or 401)
18:48:06  Frontend receives response
18:48:06  Frontend updates state
18:48:07  Browser redirects to dashboard (if login successful)
```

**Network Tab shows**: 1 request, status 200/401, time ~200ms

---

## Success Criteria

✅ You can see all of:

1. **Request URL** shows `http://localhost:3000/api/auth/login`
2. **Request Method** is `POST`
3. **Status Code** is `200` (success) or `401` (invalid credentials)
4. **Response Headers** include `Access-Control-Allow-*`
5. **Response Body** is JSON (starts with `{`)
6. **Remote Address** shows `127.0.0.1:3000` (port 3000)
7. **Initiator** shows it came from apiFetch or auth module

---

## Still Debugging?

### Check Backend Log

```bash
# In same terminal where you ran: npx tsx server/index.ts
# You should see log entries like:

[auth] Login attempt: user@example.com
[auth] Login successful
```

### Check Frontend Console

```javascript
// In browser DevTools Console tab (F12)
// If you see errors like:

Failed to fetch from http://localhost:8080
// This means .env.local wasn't updated

CORS error from http://localhost:3000
// This means CORS headers missing (shouldn't happen)
```

### Manually Test Backend

```bash
# In PowerShell/terminal:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Should return: {"error":"Invalid credentials"} (or similar)
```

If this curl works but frontend doesn't, the issue is frontend configuration.

---

## Reference: Architecture

```
Browser (localhost:5173)
     ↓
     ├→ apiFetch("/api/auth/login", {...})
     │
     ├→ buildApiUrl("/api/auth/login")
     │
     ├→ Read: VITE_API_BASE_URL = "http://localhost:3000"
     │
     ├→ Construct: "http://localhost:3000/api/auth/login"
     │
     ├→ fetch("http://localhost:3000/api/auth/login", {...})
     │
     └→ POST request sent to localhost:3000 ✅
              ↓
         Backend (localhost:3000)
              ↓
         Route: /api/auth/login
              ↓
         Handler: authRoutes.ts
              ↓
         Database: PostgreSQL
              ↓
         Response: 200 OK + JSON
              ↓
         Back to Browser ✅
```

---

## Final Checklist

Before concluding verification:

- [ ] Frontend opened at `http://localhost:5173`
- [ ] DevTools Network tab visible
- [ ] Attempted login/signup
- [ ] New request appeared in Network tab
- [ ] Request URL includes `localhost:3000`
- [ ] Status code is not 404 or 502
- [ ] Response headers include `Access-Control-Allow-*`
- [ ] Response body is valid JSON
- [ ] No console errors about CORS or network failures

✅ **All items checked** = Setup is correct!

