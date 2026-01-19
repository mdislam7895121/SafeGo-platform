# SafeGo Production Smoke Test
# Tests critical health endpoints and reports pass/fail
# Exit code: 0 = pass, 1 = fail

param(
    [string]$RailwayDomain = "https://safego-platform-production.up.railway.app",
    [string]$CustomDomain = "https://api.safegoglobal.com"
)

$ErrorActionPreference = "Continue"
$failures = 0
$tests = 0

Write-Host "================================" -ForegroundColor Cyan
Write-Host "SafeGo Production Smoke Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Railway Domain Healthz
Write-Host "Test 1/2: Railway Domain Health Check" -ForegroundColor Yellow
Write-Host "  Endpoint: $RailwayDomain/api/healthz" -ForegroundColor Gray
$tests++

try {
    $response = curl.exe -s -w "`n%{http_code}" "$RailwayDomain/api/healthz"
    $lines = $response -split "`n"
    $statusCode = $lines[-1]
    $body = $lines[0..($lines.Length-2)] -join "`n"
    
    if ($statusCode -eq "200") {
        Write-Host "  ✓ Status: 200 OK" -ForegroundColor Green
        
        # Parse JSON and check ok field
        try {
            $json = $body | ConvertFrom-Json
            if ($json.ok -eq $true) {
                Write-Host "  ✓ Response: ok=true, service=$($json.service)" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Response: ok field is not true" -ForegroundColor Red
                $failures++
            }
        } catch {
            Write-Host "  ✗ Response: Invalid JSON" -ForegroundColor Red
            $failures++
        }
    } else {
        Write-Host "  ✗ Status: $statusCode (expected 200)" -ForegroundColor Red
        Write-Host "  Response: $body" -ForegroundColor Gray
        $failures++
    }
} catch {
    Write-Host "  ✗ Request failed: $_" -ForegroundColor Red
    $failures++
}

Write-Host ""

# Test 2: Custom Domain Healthz
Write-Host "Test 2/2: Custom Domain Health Check" -ForegroundColor Yellow
Write-Host "  Endpoint: $CustomDomain/api/healthz" -ForegroundColor Gray
$tests++

try {
    $response = curl.exe -s -w "`n%{http_code}" "$CustomDomain/api/healthz"
    $lines = $response -split "`n"
    $statusCode = $lines[-1]
    $body = $lines[0..($lines.Length-2)] -join "`n"
    
    if ($statusCode -eq "200") {
        Write-Host "  ✓ Status: 200 OK" -ForegroundColor Green
        
        try {
            $json = $body | ConvertFrom-Json
            if ($json.ok -eq $true) {
                Write-Host "  ✓ Response: ok=true, env=$($json.env)" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Response: ok field is not true" -ForegroundColor Red
                $failures++
            }
        } catch {
            Write-Host "  ✗ Response: Invalid JSON" -ForegroundColor Red
            $failures++
        }
    } else {
        Write-Host "  ✗ Status: $statusCode (expected 200)" -ForegroundColor Red
        Write-Host "  Response: $body" -ForegroundColor Gray
        $failures++
    }
} catch {
    Write-Host "  ✗ Request failed: $_" -ForegroundColor Red
    $failures++
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "RESULTS" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Tests Run:    $tests" -ForegroundColor White
Write-Host "Passed:       $($tests - $failures)" -ForegroundColor Green
Write-Host "Failed:       $failures" -ForegroundColor $(if ($failures -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failures -eq 0) {
    Write-Host "✓ ALL TESTS PASSED" -ForegroundColor Green
    Write-Host "Production health endpoints are operational." -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ SMOKE TEST FAILED" -ForegroundColor Red
    Write-Host "Production health endpoints are not responding correctly." -ForegroundColor Red
    Write-Host "Check Railway deployment logs and service status." -ForegroundColor Yellow
    exit 1
}
