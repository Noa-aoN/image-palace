#!/bin/bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
使い方:
  ./scripts/collect_error_doc_context.sh <commit>

動作:
  - 指定コミットの error doc 作成に必要な調査材料をまとめて表示
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

commit="$1"
short_hash="$(git rev-parse --short "$commit")"
subject="$(git log -1 --format='%s' "$commit")"
commit_date="$(git log -1 --format='%cs' "$commit")"

changed_files="$(git show --name-only --format='' "$commit" | sed '/^$/d')"
test_files="$(printf '%s\n' "$changed_files" | rg '(^|/)(test|spec)/|test\.' || true)"
doc_files="$(printf '%s\n' "$changed_files" | rg '^docs/' || true)"
auth_files="$(printf '%s\n' "$changed_files" | rg 'auth|devise|oauth|login|signup|registration|token|session' || true)"

echo "# Error Doc Context"
echo
echo "## Commit"
echo "- Hash: ${short_hash}"
echo "- Date: ${commit_date}"
echo "- Subject: ${subject}"
echo
echo "## Summary"
git show --stat --summary --format=medium "$commit"
echo
echo "## Changed Files"
printf '%s\n' "$changed_files"
echo
echo "## Changed Test Files"
if [ -n "$test_files" ]; then
  printf '%s\n' "$test_files"
else
  echo "(none)"
fi
echo
echo "## Changed Docs"
if [ -n "$doc_files" ]; then
  printf '%s\n' "$doc_files"
else
  echo "(none)"
fi
echo
echo "## Auth Related Files"
if [ -n "$auth_files" ]; then
  printf '%s\n' "$auth_files"
else
  echo "(none)"
fi
