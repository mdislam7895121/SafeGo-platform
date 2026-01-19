# Frontend-Backend Integration Test
# Tests that frontend can successfully connect to production backend

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Frontend-Backend Integration Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Read .env.local to get configured API URL
$envFile = Get-Content "client\.env.local" -Raw
if ($envFile -match "VITE_API_BASE_URL=(.+)") {
    $apiBaseUrl = $matches[1].Trim()
    Write-Host "Configured API Base URL: $apiBaseUrl" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: VITE_API_BASE_URL not found in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Testing backend health endpoint..." -ForegroundColor Yellow
Write-Host "  URL: $apiBaseUrl/api/healthz" -ForegroundColor Gray

try {
    $response = curl.exe -s -w "`n%{http_code}" "$apiBaseUrl/api/healthz"
    $lines = $response -split "`n"
    $statusCode = $lines[-1]
    $body = $lines[0..($lines.Length-2)] -join "`n"
    
    if ($statusCode -eq "200") {
        Write-Host "  ✓ Status: 200 OK" -ForegroundColor Green
        
        $json = $body | ConvertFrom-Json
        Write-Host "  ✓ Service: $($json.service)" -ForegroundColor Green
        Write-Host "  ✓ Environment: $($json.env)" -ForegroundColor Green
        Write-Host "  ✓ Backend reachable!" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "================================" -ForegroundColor Green
        Write-Host "✓ INTEGRATION TEST PASSED" -ForegroundColor Green
        Write-Host "================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Frontend is correctly configured to use:" -ForegroundColor White
        Write-Host "  $apiBaseUrl" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Start dev server: cd client && npm run dev" -ForegroundColor Gray
        Write-Host "  2. Open browser: http://localhost:5173" -ForegroundColor Gray
        Write-Host "  3. All API calls will go to: $apiBaseUrl" -ForegroundColor Gray
        
        exit 0
    } else {
        Write-Host "  ✗ Status: $statusCode (expected 200)" -ForegroundColor Red
        Write-Host "  Response: $body" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "  ✗ Request failed: $_" -ForegroundColor Red
    exit 1
}
