cd "c:\Users\vitor\Downloads\Png\SafeGo-platform\SafeGo-platform"

echo Checking git status...
git status

echo.
echo Committing resolved rebase...
git add .
git commit -m "fix: resolve rebase conflicts and verify lucide-react dependency" 2>&1

echo.
echo Pushing to origin...
git push origin main 2>&1

echo.
echo Final commit log...
git log --oneline -3
