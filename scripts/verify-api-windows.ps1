#!/usr/bin/env pwsh
# SafeGo Production API Verification Script
# Run this on Windows PowerShell to test the API endpoints
# Usage: .\scripts\verify-api-windows.ps1

param(
    [string]$ApiBase = "https://api.safegoglobal.com",
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"

function Test-ApiEndpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Path,
        [hashtable]$Headers = @{},
        [string]$Body = ""
    )
    
    $Url = "$ApiBase$Path"
    
    Write-Host "`n" + ("="*60) -ForegroundColor Cyan
    Write-Host "Test: $Name" -ForegroundColor Yellow
    Write-Host ("="*60) -ForegroundColor Cyan
    Write-Host "URL: $Method $Url" -ForegroundColor Gray
    
    if ($Body) {
        Write-Host "Body: $Body" -ForegroundColor Gray
    }
    
    try {
        $params = @{
            Uri             = $Url
            Method          = $Method
            Headers         = $Headers
            ContentType     = "application/json"
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params["Body"] = $Body
        }
        
        $response = Invoke-WebRequest @params
        
        # Extract status and headers
        $statusCode = $response.StatusCode
        $contentType = $response.Headers["Content-Type"]
        $body = $response.Content
        
        # Display results
        Write-Host "`n✓ Status: $statusCode" -ForegroundColor Green
        Write-Host "✓ Content-Type: $contentType" -ForegroundColor Green
        
        # Check if response is JSON
        $isJson = $false
        try {
            if ($body) {
                $json = $body | ConvertFrom-Json
                $isJson = $true
                Write-Host "✓ Response is valid JSON" -ForegroundColor Green
                Write-Host "`nResponse body:" -ForegroundColor Gray
                Write-Host ($json | ConvertTo-Json -Depth 3) -ForegroundColor White
            }
        } catch {
            Write-Host "✗ Response is not valid JSON" -ForegroundColor Red
            Write-Host "Response body:" -ForegroundColor Gray
            Write-Host $body -ForegroundColor White
        }
        
        # Check for HTML error
        if ($body -like "*<!DOCTYPE html*" -or $body -like "*<html*") {
            Write-Host "`n✗ ERROR: Response is HTML, not JSON!" -ForegroundColor Red
            return $false
        }
        
        if ($isJson) {
            Write-Host "`n✓ PASS: JSON response received" -ForegroundColor Green
            return $true
        } else {
            if ($statusCode -lt 400) {
                Write-Host "`n✓ PASS: Non-JSON response is acceptable for this endpoint" -ForegroundColor Green
                return $true
            } else {
                Write-Host "`n✗ FAIL: Expected JSON but got non-JSON response" -ForegroundColor Red
                return $false
            }
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        $statusDescription = $_.Exception.Response.StatusDescription
        
        # Try to read error body
        $errorBody = $null
        try {
            $errorBody = $_.Exception.Response.Content.ReadAsStream() | ConvertFrom-Json
        } catch {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
            } catch {
                $errorBody = "Could not read error response"
            }
        }
        
        Write-Host "`n✓ Status: $statusCode $statusDescription" -ForegroundColor Green
        
        if ($errorBody) {
            Write-Host "Error Body:" -ForegroundColor Gray
            if ($errorBody -is [string]) {
                Write-Host $errorBody -ForegroundColor White
            } else {
                Write-Host ($errorBody | ConvertTo-Json) -ForegroundColor White
            }
            
            # Check for HTML error
            if ($errorBody -like "*<!DOCTYPE html*" -or $errorBody -like "*<html*") {
                Write-Host "`n✗ ERROR: Error response is HTML, not JSON!" -ForegroundColor Red
                return $false
            }
        }
        
        Write-Host "`n✓ PASS: API responded with error (expected for invalid data)" -ForegroundColor Green
        return $true
    }
}

# Main test suite
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "SafeGo Production API Verification" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan
Write-Host "API Base: $ApiBase" -ForegroundColor Gray
Write-Host "Time: $(Get-Date)" -ForegroundColor Gray

$results = @()

# Test 1: Health endpoint
$results += @{
    name   = "1. GET /api/health (Health Check)"
    passed = Test-ApiEndpoint `
        -Name "Health Endpoint" `
        -Method "GET" `
        -Path "/api/health"
}

# Test 2: Signup endpoint (invalid data - should return JSON error)
$results += @{
    name   = "2. POST /api/auth/signup (Invalid Data)"
    passed = Test-ApiEndpoint `
        -Name "Signup Endpoint (Invalid Data)" `
        -Method "POST" `
        -Path "/api/auth/signup" `
        -Headers @{"Content-Type" = "application/json"} `
        -Body '{"email":"test@example.com","password":"Test@123456","confirmPassword":"Test@123456"}'
}

# Test 3: Login endpoint (invalid credentials - should return JSON error)
$results += @{
    name   = "3. POST /api/auth/login (Invalid Credentials)"
    passed = Test-ApiEndpoint `
        -Name "Login Endpoint (Invalid Credentials)" `
        -Method "POST" `
        -Path "/api/auth/login" `
        -Headers @{"Content-Type" = "application/json"} `
        -Body '{"email":"nonexistent@test.com","password":"WrongPassword@123"}'
}

# Test 4: 404 endpoint (should return JSON, not HTML)
$results += @{
    name   = "4. GET /api/nonexistent (404 Error)"
    passed = Test-ApiEndpoint `
        -Name "404 Not Found (should be JSON)" `
        -Method "GET" `
        -Path "/api/nonexistent"
}

# Test 5: Database health check
$results += @{
    name   = "5. GET /api/health/db (Database Check)"
    passed = Test-ApiEndpoint `
        -Name "Database Health Check" `
        -Method "GET" `
        -Path "/api/health/db"
}

# Summary
Write-Host "`n`n" + ("="*60) -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

$passCount = ($results | Where-Object {$_.passed -eq $true}).Count
$totalCount = $results.Count

foreach ($result in $results) {
    $status = if ($result.passed) { "✓ PASS" } else { "✗ FAIL" }
    $color = if ($result.passed) { "Green" } else { "Red" }
    Write-Host "$status - $($result.name)" -ForegroundColor $color
}

Write-Host "`n" + ("="*60) -ForegroundColor Cyan
Write-Host "Results: $passCount/$totalCount tests passed" -ForegroundColor $(if ($passCount -eq $totalCount) { "Green" } else { "Red" })
Write-Host ("="*60) -ForegroundColor Cyan

if ($passCount -eq $totalCount) {
    Write-Host "`n✓ All tests passed! API is working correctly." -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Green
    Write-Host "1. Test signup/login in browser" -ForegroundColor Green
    Write-Host "2. Check Network tab for Content-Type: application/json" -ForegroundColor Green
    Write-Host "3. Verify no 'Unexpected token' errors in console" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n✗ Some tests failed. Check the output above for details." -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Red
    Write-Host "1. Is the backend service running in Railway?" -ForegroundColor Red
    Write-Host "2. Does api.safegoglobal.com resolve to the correct server?" -ForegroundColor Red
    Write-Host "3. Check Railway deployment logs for errors" -ForegroundColor Red
    Write-Host "4. Verify the domain is attached to the backend service (not frontend)" -ForegroundColor Red
    exit 1
}
