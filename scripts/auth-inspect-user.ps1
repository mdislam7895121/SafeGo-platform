# AUTH USER INSPECTION WRAPPER (PowerShell)
# Usage: .\scripts\auth-inspect-user.ps1 -Email "user@example.com"

param(
    [Parameter(Mandatory=$true)]
    [string]$Email
)

# Navigate to project root
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $projectRoot

Write-Host "Invoking auth user inspection..." -ForegroundColor Cyan
node scripts/auth-inspect-user.mjs $Email

$exitCode = $LASTEXITCODE
Pop-Location
exit $exitCode
