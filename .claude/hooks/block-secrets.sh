#!/bin/bash
# PreToolUse hook: Block hardcoded secrets in bash commands
# Matcher: Bash
# Registered in: .claude/settings.json (statusMessage: "セキュリティチェック中...")

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# Allow: .env.example への書き込み（プレースホルダー値）
if echo "$COMMAND" | grep -qE '\.env\.example'; then
  exit 0
fi

# Allow: config/master.key を読む操作（.env への RAILS_MASTER_KEY 設定）
if echo "$COMMAND" | grep -q 'config/master\.key'; then
  exit 0
fi

# Block: シークレット変数名に実値を直書きしているコマンド
if echo "$COMMAND" | grep -qiE \
  '(MASTER_KEY|API_KEY|SECRET_KEY|ACCESS_KEY|PRIVATE_KEY|AUTH_TOKEN|PASSWORD|DATABASE_PASSWORD)\s*=\s*\S'; then
  deny "API キーや秘密情報をコマンドに直書きしないでください。環境変数ファイルを使用してください。"
fi

exit 0
