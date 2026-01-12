$rebasePath = "c:\Users\vitor\Downloads\Png\SafeGo-platform\SafeGo-platform\.git\rebase-merge"
Write-Host "Rebase directory exists: $(Test-Path $rebasePath)"

if (Test-Path $rebasePath) {
    Write-Host "Rebase is still active"
    $msgNum = Get-Content "$rebasePath\msgnum" -ErrorAction SilentlyContinue
    $end = Get-Content "$rebasePath\end" -ErrorAction SilentlyContinue
    Write-Host "Progress: $msgNum of $end"
} else {
    Write-Host "Rebase is complete"
    cd "c:\Users\vitor\Downloads\Png\SafeGo-platform\SafeGo-platform"
    & git log --oneline -5
}
