#!/bin/bash
set -euo pipefail

TOPIC="${1:-}"
if [ -z "$TOPIC" ]; then
  echo "使い方: ./scripts/generate_draft.sh 'テーマ'"
  exit 1
fi

DATE=$(date +%Y-%m-%d)
OUTPUT="docs/drafts/${DATE}.md"

PROMPT=$(cat << EOF
以下のテーマについて、初学者向けの技術記事を書いてください。

テーマ: ${TOPIC}

## 構成
- 概要
- なぜ必要か
- 仕組み
- 実装のポイント
- まとめ
EOF
)

RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: ${ANTHROPIC_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg content "$PROMPT" \
    '{
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{role: "user", content: $content}]
    }'
  )")

echo "$RESPONSE" | jq -r '.content[0].text' > "$OUTPUT"

echo "✅ 記事生成: ${OUTPUT}"
