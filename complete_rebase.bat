@echo off
setlocal enabledelayedexpansion
cd /d "c:\Users\vitor\Downloads\Png\SafeGo-platform\SafeGo-platform"

REM Complete the rebase
for /l %%i in (1,1,10) do (
  git rebase --skip 2>&1
  if not exist .git\rebase-merge goto rebase_done
)

:rebase_done
echo Rebase completed
git log --oneline -5
echo.
echo Git status:
git status --short
