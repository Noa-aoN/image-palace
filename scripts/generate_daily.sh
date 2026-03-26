#!/bin/bash
set -euo pipefail

TODAY=$(date +%Y-%m-%d)
OUTPUT="docs/daily/${TODAY}.md"

GIT_LOG=$(git log --oneline -5 2>/dev/null || echo "ログなし")

PROMPT=$(cat << EOF
以下の開発ログから、シンプルな開発日誌を書いてください。

## 出力形式（Markdown）
### 今日やったこと
- 箇条書き

### 詰まったこと
- 簡潔に

### 学び
- 技術的な気づき

### 次やること
- 次のISSUE

## ログ
${GIT_LOG}
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

echo "# 開発日誌 ${TODAY}" > "$OUTPUT"
echo "" >> "$OUTPUT"
echo "$RESPONSE" | jq -r '.output[0].content[0].text' >> "$OUTPUT"

echo "✅ 日誌生成: ${OUTPUT}"
