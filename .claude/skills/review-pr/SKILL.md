---
name: review-pr
description: Review a GitHub pull request and provide structured feedback with severity ratings
argument-hint: "[PR number]"
---

## PR の特定

$ARGUMENTS が指定されている場合はその PR 番号を使う。
指定がない場合は以下の一覧を表示してユーザーに選ばせる:

- 最新 PR 一覧: !`gh pr list --state open --limit 5 --json number,title,author,createdAt`

上記の結果を番号付きリストで表示し、「どの PR をレビューしますか？」と聞いてユーザーの回答を待つ。
オープン PR が存在しない場合は「オープンな PR が見つかりません」と伝えて終了する。

## PR Context

- PR metadata: !`gh pr view $ARGUMENTS --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles`
- PR diff: !`gh pr diff $ARGUMENTS`
- Changed files: !`gh pr diff $ARGUMENTS --name-only`

## Review Instructions

以下の観点で PR を詳しくレビューする:

1. **意図の把握**: PR 説明を読み、何の問題を解決しているか理解する
2. **正確性**: ロジック・エッジケース・エラーハンドリングを検証する
3. **セキュリティ**: インジェクション脆弱性・シークレット漏洩・認証問題を確認する
4. **パフォーマンス**: N+1 クエリ・不要なアロケーション・インデックス不足を確認する
5. **テスト**: 新規・変更コードに対して適切なテストがあるか確認する（MVP リリース後に適用）
6. **スタイル**: プロジェクト規約との一貫性を確認する

### image-palace 固有チェック

- [ ] N+1 クエリがないか（`includes` / `preload` / `eager_load` を使っているか）
- [ ] `shared_media.normalized_prompt` のキャッシュ設計を壊していないか
- [ ] OpenAI API キーがフロントエンドに露出していないか（`NEXT_PUBLIC_` 禁止）
- [ ] Strong Parameters が使われているか
- [ ] `items` の正しい用語を使っているか（`cards` / `objects` / `card_sets` は禁止）
- [ ] S3 直配信になっていないか（CDN 経由のみ）
- [ ] コミットメッセージが Conventional Commits 形式か
- [ ] ブランチ名に `#` が含まれていないか（例: `feature/17-xxx`）
- [ ] `NEXT_PUBLIC_` 変数にシークレット値が使われていないか

## Output Format

**レビュー結果はすべて日本語で出力すること。**

深刻度別に整理して出力する:

### P0 - Critical（マージ前に必ず修正）
セキュリティ脆弱性、データ消失リスク、機能破壊

### P1 - High（修正すべき）
ロジックエラー、エッジケース漏れ、パフォーマンス問題

### P2 - Medium（できれば修正）
コードの臭い、保守性の懸念、軽微な規約違反

### P3 - Low（任意）
スタイル改善、命名の提案、ドキュメント

### ✅ 良い点
よく書けているコードや適切な設計判断を挙げる

---

最後に明確な **判定** を出す: `承認` / `修正依頼` / `要議論`

判定後、修正が必要な場合は「実装しましょうか？」と確認する。
