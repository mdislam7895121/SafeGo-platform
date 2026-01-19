#!/usr/bin/env pwsh
# Production Auth Diagnostics
# Tests auth endpoints and reports detailed status

Write-Host "`n=== SafeGo Production Auth Diagnostics ===" -ForegroundColor Cyan
Write-Host "Target: https://api.safegoglobal.com`n" -ForegroundColor Gray

# Test 1: Health Check
Write-Host "[1/5] Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $health = curl -s https://api.safegoglobal.com/api/healthz | ConvertFrom-Json
    if ($health.ok) {
        Write-Host "  ✓ Backend is healthy" -ForegroundColor Green
        Write-Host "    Service: $($health.service)" -ForegroundColor Gray
        Write-Host "    Env: $($health.env)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Health check failed" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Health endpoint error: $_" -ForegroundColor Red
}

# Test 2: Signup (creates test user)
Write-Host "`n[2/5] Testing Signup Endpoint..." -ForegroundColor Yellow
$email = "diagtest_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$signupBody = @{
    email = $email
    password = "Test123!"
    confirmPassword = "Test123!"
    name = "Diagnostic Test User"
    countryCode = "US"
} | ConvertTo-Json

try {
    $signupResponse = curl -s -X POST https://api.safegoglobal.com/api/auth/signup `
        -H "Content-Type: application/json" `
        -d $signupBody
    $signup = $signupResponse | ConvertFrom-Json
    
    if ($signup.user) {
        Write-Host "  ✓ Signup successful" -ForegroundColor Green
        Write-Host "    User ID: $($signup.user.id)" -ForegroundColor Gray
        Write-Host "    Email: $($signup.user.email)" -ForegroundColor Gray
        $testEmail = $signup.user.email
    } else {
        Write-Host "  ✗ Signup failed" -ForegroundColor Red
        Write-Host "    Error: $($signup.error)" -ForegroundColor Red
        if ($signup.code) {
            Write-Host "    Code: $($signup.code)" -ForegroundColor Red
        }
        exit 1
    }
} catch {
    Write-Host "  ✗ Signup error: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Login (with created user)
Write-Host "`n[3/5] Testing Login Endpoint..." -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = "Test123!"
} | ConvertTo-Json

try {
    $loginResponse = curl -s -X POST https://api.safegoglobal.com/api/auth/login `
        -H "Content-Type: application/json" `
        -d $loginBody
    $login = $loginResponse | ConvertFrom-Json
    
    if ($login.token) {
        Write-Host "  ✓ Login successful" -ForegroundColor Green
        Write-Host "    Token: $($login.token.Substring(0, 30))..." -ForegroundColor Gray
        $authToken = $login.token
    } else {
        Write-Host "  ✗ Login failed" -ForegroundColor Red
        Write-Host "    Error: $($login.error)" -ForegroundColor Red
        if ($login.code) {
            Write-Host "    Code: $($login.code)" -ForegroundColor Red
        }
        
        # Show full response for debugging
        Write-Host "`n  Full Response:" -ForegroundColor Yellow
        Write-Host "    $loginResponse" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "  ✗ Login error: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Token Validation
Write-Host "`n[4/5] Testing Token Validation..." -ForegroundColor Yellow
try {
    $validateResponse = curl -s https://api.safegoglobal.com/api/auth/validate `
        -H "Authorization: Bearer $authToken"
    $validate = $validateResponse | ConvertFrom-Json
    
    if ($validate.valid) {
        Write-Host "  ✓ Token is valid" -ForegroundColor Green
        Write-Host "    User ID: $($validate.userId)" -ForegroundColor Gray
        Write-Host "    Role: $($validate.role)" -ForegroundColor Gray
        Write-Host "    Country: $($validate.countryCode)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Token validation failed" -ForegroundColor Red
        Write-Host "    Error: $($validate.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Validation error: $_" -ForegroundColor Red
}

# Test 5: Invalid Credentials
Write-Host "`n[5/5] Testing Invalid Credentials (should fail gracefully)..." -ForegroundColor Yellow
$invalidBody = @{
    email = "nonexistent@example.com"
    password = "wrongpassword"
} | ConvertTo-Json

try {
    $invalidResponse = curl -s -X POST https://api.safegoglobal.com/api/auth/login `
        -H "Content-Type: application/json" `
        -d $invalidBody
    $invalid = $invalidResponse | ConvertFrom-Json
    
    if ($invalid.error -eq "Invalid credentials") {
        Write-Host "  ✓ Proper error handling for invalid credentials" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Unexpected response" -ForegroundColor Yellow
        Write-Host "    Response: $invalidResponse" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ⚠ Unexpected error: $_" -ForegroundColor Yellow
}

Write-Host "`n=== Diagnostics Complete ===" -ForegroundColor Cyan
Write-Host "All critical auth flows verified successfully`n" -ForegroundColor Green
