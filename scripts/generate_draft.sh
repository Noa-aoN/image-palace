#!/bin/bash
set -euo pipefail

# .env ファイルを自動読み込み
if [ -f .env ]; then
  source .env
fi

# 環境変数チェック
: "${OPENAI_API_KEY:?OPENAI_API_KEY is not set. Please set it in .env file}"

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

RESPONSE=$(curl -s https://api.openai.com/v1/responses \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg content "$PROMPT" \
    '{
      model: "gpt-4.1-mini",
      input: $content
    }'
  )")

# エラーハンドリング
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ API Error:"
  echo "$RESPONSE" | jq '.error'
  exit 1
fi

echo "$RESPONSE" | jq -r '.output_text' > "$OUTPUT"

echo "✅ 記事生成: ${OUTPUT}"
