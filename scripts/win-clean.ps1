# win-clean.ps1
# Windows-safe cleanup for SafeGo development
# Removes locked node_modules/dist/Prisma engine that may prevent npm ci
# Non-destructive: only deletes build artifacts and dependencies (not source code)

Write-Host "SafeGo Windows Cleanup Script" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Stop all node processes (Prisma DLL lock source)
Write-Host "`n[1] Stopping Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Killed $($nodeProcesses.Count) node process(es)" -ForegroundColor Green
} else {
    Write-Host "  ✓ No node processes running" -ForegroundColor Green
}
Start-Sleep -Seconds 2

# Remove node_modules
Write-Host "`n[2] Removing node_modules..." -ForegroundColor Yellow
if (Test-Path ".\node_modules") {
    Remove-Item ".\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed node_modules" -ForegroundColor Green
} else {
    Write-Host "  ✓ node_modules not present" -ForegroundColor Green
}

# Remove dist
Write-Host "`n[3] Removing dist..." -ForegroundColor Yellow
if (Test-Path ".\dist") {
    Remove-Item ".\dist" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed dist" -ForegroundColor Green
} else {
    Write-Host "  ✓ dist not present" -ForegroundColor Green
}

Write-Host "`n[✓] Cleanup complete" -ForegroundColor Cyan
Write-Host "Ready for: npm ci && npm run build`n" -ForegroundColor Gray
