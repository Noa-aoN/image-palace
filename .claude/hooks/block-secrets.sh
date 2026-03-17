#!/usr/bin/env bash
# block-secrets.sh — ImagePalace 用セキュリティガード
# 危険なコマンドや秘密情報を含む操作をブロックする
#
# 設計方針:
#   - git commit / gh pr create の本文（heredoc）は複数行にわたるため、
#     誤検知を避けるためコマンドの先頭行のみを検査する
#   - 危険なコマンド（rm -rf, git push --force 等）は先頭行に現れるため
#     実用上の検知漏れは生じない

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# 先頭行のみを検査対象とする（heredoc 本文での誤検知を防ぐ）
FIRST_LINE=$(echo "$COMMAND" | head -1)

# ── force push ──────────────────────────────────────────────
if echo "$FIRST_LINE" | grep -qE 'git push.*(--force|-f\b)'; then
  echo '{"decision":"block","reason":"force push は禁止されています。CLAUDE.md の Do NOT Touch を参照してください。"}'
  exit 0
fi

# ── rm -rf ──────────────────────────────────────────────────
if echo "$FIRST_LINE" | grep -qE 'rm\s+-rf|rm\s+-r\s+-f|rm\s+-fr'; then
  echo '{"decision":"block","reason":"rm -rf は禁止されています。"}'
  exit 0
fi

# ── .env ファイルの cat / less / more / head / tail 系 ───────
if echo "$FIRST_LINE" | grep -qE '(cat|less|more|head|tail)\s+[^ ]*\.env'; then
  echo '{"decision":"block","reason":".env ファイルの内容表示は禁止されています。"}'
  exit 0
fi

# ── 秘密情報をコマンド引数に直書き ──────────────────────────
if echo "$FIRST_LINE" | grep -qE '(OPENAI_API_KEY|DATABASE_URL|SECRET_KEY_BASE|RAILS_MASTER_KEY)\s*=\s*[^\$\(]'; then
  echo '{"decision":"block","reason":"API キーや秘密情報をコマンドに直書きしないでください。環境変数ファイルを使用してください。"}'
  exit 0
fi

# ── git config でユーザー情報を変更 ─────────────────────────
if echo "$FIRST_LINE" | grep -qE 'git config.*(user\.email|user\.name)'; then
  echo '{"decision":"block","reason":"git config でユーザー情報を変更することは禁止されています。"}'
  exit 0
fi

# ── すべてのチェックを通過 ──────────────────────────────────
exit 0
