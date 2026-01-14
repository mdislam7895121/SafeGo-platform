# ============================================================================
# SafeGo-platform: Windows Deployment Readiness Runbook
# ============================================================================
# This script proves end-to-end deployment readiness on Windows:
# - Unblocks Windows EPERM Prisma DLL lock
# - Cleans and reinstalls dependencies
# - Builds project with TypeScript
# - Boots server without DATABASE_URL
# - Verifies all 3 health endpoints return HTTP 200
#
# USAGE: Run this entire script end-to-end in PowerShell
# ============================================================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "SafeGo Deployment Readiness Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# STEP 1: Stop all node processes
Write-Host "`n[STEP 1] Stopping Node Processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "✓ Node processes stopped" -ForegroundColor Green

# STEP 2: Clean node_modules and dist
Write-Host "`n[STEP 2] Cleaning Directories..." -ForegroundColor Yellow
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Write-Host "✓ Cleaned: node_modules/, dist/" -ForegroundColor Green

# STEP 3: Reinstall dependencies
Write-Host "`n[STEP 3] Reinstalling Dependencies (npm ci)..." -ForegroundColor Yellow
$npmCiOutput = npm ci 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ npm ci succeeded" -ForegroundColor Green
    Write-Host ($npmCiOutput | Select-Object -Last 3 | Out-String) -ForegroundColor Gray
} else {
    Write-Host "✗ npm ci FAILED (exit code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host ($npmCiOutput | Select-Object -Last 10 | Out-String)
    exit 1
}

# STEP 4: Build project
Write-Host "`n[STEP 4] Building Project (npm run build)..." -ForegroundColor Yellow
$buildOutput = npm run build 2>&1
if ((Test-Path .\dist\server\index.js) -eq $true) {
    Write-Host "✓ Build succeeded, dist/server/index.js exists ($(Get-Item .\dist\server\index.js | Select-Object -ExpandProperty Length) bytes)" -ForegroundColor Green
} else {
    Write-Host "✗ Build FAILED - dist/server/index.js missing" -ForegroundColor Red
    Write-Host ($buildOutput | Select-Object -Last 10 | Out-String)
    exit 1
}

# STEP 5: Resolve path aliases
Write-Host "`n[STEP 5] Resolving TypeScript Path Aliases (tsc-alias)..." -ForegroundColor Yellow
npx tsc-alias -p server/tsconfig.build.json 2>&1 | Out-Null
$vehicleTest = Select-String -Path '.\dist\server\routes\driver.js' -Pattern 'require.*shared/vehicleCategories' -ErrorAction SilentlyContinue
if ($null -ne $vehicleTest) {
    Write-Host "✓ Path aliases resolved correctly" -ForegroundColor Green
} else {
    Write-Host "✗ Path alias resolution may have failed" -ForegroundColor Red
}

# STEP 6: Boot server without DATABASE_URL
Write-Host "`n[STEP 6] Booting Server (No DATABASE_URL)..." -ForegroundColor Yellow
$env:JWT_SECRET = "local-test-secret-12345678901234567890"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$env:PORT = "8080"

$serverJob = Start-Job -Name BootTest -ScriptBlock {
    Set-Location "c:\Users\vitor\Downloads\Png\SafeGo-platform\SafeGo-platform"
    $env:JWT_SECRET = "local-test-secret-12345678901234567890"
    $env:PORT = "8080"
    node .\dist\server\index.js 2>&1
}

Start-Sleep -Seconds 8

# Check if server is still running
if ((Get-Job -Name BootTest).State -eq "Running") {
    Write-Host "✓ Server booted successfully" -ForegroundColor Green
    $bootLogs = Receive-Job -Job $serverJob -Keep 2>&1
    $listeningLine = $bootLogs | Select-String "listening on"
    if ($null -ne $listeningLine) {
        Write-Host "  $listeningLine" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ Server FAILED to boot" -ForegroundColor Red
    $errorLogs = Receive-Job -Job $serverJob 2>&1
    Write-Host ($errorLogs | Select-Object -Last 15 | Out-String)
    exit 1
}

# STEP 7: Test health endpoints
Write-Host "`n[STEP 7] Testing Health Endpoints..." -ForegroundColor Yellow

$healthz = curl.exe -s -w "`nSTATUS:%{http_code}" http://localhost:8080/healthz 2>&1
$health = curl.exe -s -w "`nSTATUS:%{http_code}" http://localhost:8080/health 2>&1
$apiHealth = curl.exe -s -w "`nSTATUS:%{http_code}" http://localhost:8080/api/health 2>&1

$healthzStatus = if ($healthz -match "STATUS:200") { "200 OK" } else { "FAILED" }
$healthStatus = if ($health -match "STATUS:200") { "200 OK" } else { "FAILED" }
$apiHealthStatus = if ($apiHealth -match "STATUS:200") { "200 OK" } else { "FAILED" }

Write-Host "  GET /healthz:     HTTP $healthzStatus" -ForegroundColor $(if ($healthzStatus -eq "200 OK") { "Green" } else { "Red" })
Write-Host "  GET /health:      HTTP $healthStatus" -ForegroundColor $(if ($healthStatus -eq "200 OK") { "Green" } else { "Red" })
Write-Host "  GET /api/health:  HTTP $apiHealthStatus" -ForegroundColor $(if ($apiHealthStatus -eq "200 OK") { "Green" } else { "Red" })

# Stop server
Write-Host "`n[STEP 8] Cleaning Up..." -ForegroundColor Yellow
Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
Write-Host "✓ Server stopped" -ForegroundColor Green

# Final verdict
Write-Host "`n================================" -ForegroundColor Cyan
if (($healthzStatus -eq "200 OK") -and ($healthStatus -eq "200 OK") -and ($apiHealthStatus -eq "200 OK")) {
    Write-Host "✓ DEPLOYMENT READY" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "`nAll checks PASSED:" -ForegroundColor Green
    Write-Host "  ✓ npm ci succeeded (no Windows EPERM)"
    Write-Host "  ✓ npm run build succeeded"
    Write-Host "  ✓ dist/server/index.js exists"
    Write-Host "  ✓ Server boots without DATABASE_URL"
    Write-Host "  ✓ All 3 health endpoints return HTTP 200"
    Write-Host "`nReady for Railway deployment.`n"
    exit 0
} else {
    Write-Host "✗ DEPLOYMENT NOT READY" -ForegroundColor Red
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "`nFailed checks:" -ForegroundColor Red
    if ($healthzStatus -ne "200 OK") { Write-Host "  ✗ GET /healthz failed" }
    if ($healthStatus -ne "200 OK") { Write-Host "  ✗ GET /health failed" }
    if ($apiHealthStatus -ne "200 OK") { Write-Host "  ✗ GET /api/health failed" }
    Write-Host "`nReview server logs above.`n"
    exit 1
}
