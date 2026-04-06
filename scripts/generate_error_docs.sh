#!/bin/bash
set -euo pipefail

# .env ファイルを自動読み込み
if [ -f .env ]; then
  source .env
fi

# 環境変数チェック
: "${GEMINI_API_KEY:?GEMINI_API_KEY is not set. Please set it in .env file}"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$ROOT_DIR"

OUTPUT_DIR="docs/errors"
RECENT_LIMIT=5

usage() {
  cat <<'EOF'
使い方:
  ./scripts/generate_error_docs.sh
  ./scripts/generate_error_docs.sh --recent 3
  ./scripts/generate_error_docs.sh <commit> [<commit> ...]

動作:
  - 引数なし: 直近 5 件の `fix:` コミットから error doc を生成
  - --recent N: 直近 N 件の `fix:` コミットから error doc を生成
  - commit 指定: 指定コミットの error doc を生成
  - 既存ファイルが未整備（TODO を含む）の場合は上書き生成
EOF
}

slugify() {
  local value
  value="$(printf '%s' "$1" | sed -E 's/^fix:[[:space:]]*//; s/^feat:[[:space:]]*//; s/^docs:[[:space:]]*//; s/^refactor:[[:space:]]*//; s/^chore:[[:space:]]*//')"
  value="$(printf '%s' "$value" | sed -e 's/ /_/g' -e 's/\//_/g' -e 's/[^a-zA-Z0-9_ぁ-んァ-ヶー一-龠]//g')"
  if [ -z "$value" ]; then
    value="エラードキュメント"
  fi
  printf '%s' "$value"
}

collect_commits() {
  if [ "$#" -eq 0 ]; then
    git log --no-merges --grep='^fix:' --format='%H' -n "$RECENT_LIMIT"
    return
  fi

  if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    usage
    exit 0
  fi

  if [ "$1" = "--recent" ]; then
    if [ "$#" -lt 2 ]; then
      echo "--recent には件数が必要です" >&2
      exit 1
    fi
    git log --no-merges --grep='^fix:' --format='%H' -n "$2"
    return
  fi

  printf '%s\n' "$@"
}

mkdir -p "$OUTPUT_DIR"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

COMMITS="$(collect_commits "$@")"

if [ -z "$COMMITS" ]; then
  echo "対象コミットが見つかりませんでした。"
  exit 0
fi

created_count=0

while IFS= read -r commit; do
  [ -n "$commit" ] || continue

  short_hash="$(git rev-parse --short "$commit")"
  subject="$(git log -1 --format='%s' "$commit")"
  commit_date="$(git log -1 --format='%cs' "$commit")"
  slug="$(slugify "$subject")"
  output_path="${OUTPUT_DIR}/${commit_date}_${slug}_${short_hash}.md"

  if [ -e "$output_path" ]; then
    if ! rg -q 'TODO:' "$output_path"; then
      echo "スキップ: ${output_path}"
      continue
    fi
  fi

  context="$(bash scripts/collect_error_doc_context.sh "$commit")"
  existing_context=""
  if [ -e "$output_path" ]; then
    existing_context="$(cat "$output_path")"
  fi

  PROMPT=$(cat <<EOF
あなたはソフトウェア開発チームの障害ドキュメント作成アシスタントです。
以下のコミット調査材料から、docs/errors 用の Markdown を日本語で作成してください。

要件:
- 出力は Markdown 本文のみ。コードフェンスは使わない
- 事実ベースで書く
- コミット差分から断定できない内容は「推定」と明記する
- タイトルはコミット件名をそのまま使ってよい
- 変更ファイル、変更テスト、変更 docs に書かれていないことは安易に広げない
- 一般的なセキュリティ論や運用論で水増ししない
- 各セクションは 1〜3 個の簡潔な箇条書きを基本にする
- 次の見出しを必ずこの順で含める
  - 概要
  - 症状
  - 発生条件
  - 原因
  - 修正内容
  - 影響範囲
  - 学び
  - 再発防止
  - 関連テスト
  - 関連変更
  - 変更ファイル
- 冒頭のメタ情報は以下の形式にする
  - 状態: 下書き または 修正済み
  - 初回記録日: ${commit_date}
  - 対象範囲: フロントエンド / バックエンド / インフラ / 認証 / ドキュメント / 要分類 のいずれかを使う
- 「関連変更」には最低限 Commit: ${short_hash} を入れる
- 「変更ファイル」はコミットに含まれるファイルを箇条書きで漏れなく記載する
- TODO は残さない

判断基準:
- すでにある変更内容の言い換えではなく、この不具合から得られる再発防止や学びが伝わるようにする
- ただし不明点は無理に埋めず、「推定」と書く
- 症状、発生条件、原因は、変更ファイルから裏づけできる範囲を優先する
- 関連テストは、調査材料に test ファイルがある場合のみ具体名を書く
- docs の更新だけで断定できる内容は docs 変更として書き、アプリ挙動の断定は避ける

対象コミット:
- Hash: ${short_hash}
- Date: ${commit_date}
- Subject: ${subject}

調査材料:
${context}
EOF
)

  if [ -n "$existing_context" ]; then
    PROMPT="${PROMPT}

既存ファイル:
${existing_context}

既存ファイルに TODO がある場合は、内容を完成版に置き換えてください。"
  fi

  RESPONSE=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg content "$PROMPT" \
      '{
        contents: [{
          parts: [{
            text: $content
          }]
        }]
      }'
    )")

  if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo "❌ API Error:"
    echo "$RESPONSE" | jq '.error'
    exit 1
  fi

  generated="$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[0].text')"

  if [ -z "$generated" ] || [ "$generated" = "null" ]; then
    echo "❌ Gemini から本文を取得できませんでした: ${short_hash}" >&2
    exit 1
  fi

  printf '%s\n' "$generated" > "$output_path"

  if ! rg -q '^# ' "$output_path"; then
    cat <<EOF > "$output_path"
# ${subject}

$(cat "$output_path")
EOF
  fi

  echo "作成: ${output_path}"
  created_count=$((created_count + 1))
done <<EOF
${COMMITS}
EOF

echo "完了: ${created_count} 件のドラフトを作成しました"
