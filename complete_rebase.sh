#!/bin/bash
cd "c:\Users\vitor\Downloads\Png\SafeGo-platform\SafeGo-platform"
GIT_EDITOR=true git rebase --continue 2>&1 || git rebase --skip 2>&1
sleep 1
if [ -d .git/rebase-merge ]; then
  echo "Rebase still in progress"
else
  echo "Rebase completed"
  git log --oneline -5
fi
