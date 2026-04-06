# AI Skill Playbook

> Claude Code の Skill を使って開発効率・レビュー品質を上げるための実用ガイド。

---

## 概要

このリポジトリでは Claude Code の Skill 機能を活用している。
Skill は `/コマンド名` で呼び出すだけで、設計・実装・レビュー・品質チェックを自動化できる。

**目的**: 手動でやると抜け漏れが出る作業を Skill で標準化・省力化する。

---

## 利用可能な Skill 一覧

### 開発フロー

| Skill | 用途 | コマンド |
|---|---|---|
| `review-pr` | PR のコードレビュー（セキュリティ・ロジック・規約） | `/review-pr [PR番号]` |
| `code-review-expert` | git diff に対するレビュー（SOLID・セキュリティ・品質） | `/code-review-expert` |
| `fix-issue` | Issue 番号を渡して実装・コミットまで自動化 | `/fix-issue [Issue番号]` |
| `db-migrate` | マイグレーション作成・実行 | `/db-migrate [内容]` |
| `deploy` | staging / production へのデプロイ | `/deploy [staging\|production]` |
| `status` | 現在のブランチ・コミット・変更状況を表示 | `/status` |

### 設計・理解

| Skill | 用途 | コマンド |
|---|---|---|
| `brainstorming` | 実装前の設計・仕様検討（コーディング前に必ず使う） | `/brainstorming` |
| `explain-code` | コードの動きをアナロジー＋図で説明 | `/explain-code [対象]` |

### ドキュメント管理

| Skill | 用途 | コマンド |
|---|---|---|
| `doc-review` | docs の正確性・最新性チェックと修正提案 | `/doc-review [パス]` |
| `error-docs` | 最近の fix から `docs/errors` を調査・下書き生成 | `/error-docs [commit \| --recent N]` |

### フロントエンド品質

| Skill | 用途 | コマンド |
|---|---|---|
| `baseline-ui` | UI の品質検証（アニメーション・タイポ・レイアウト） | `/baseline-ui [ファイル]` |
| `fixing-accessibility` | アクセシビリティ（ARIA・キーボード・コントラスト）修正 | `/fixing-accessibility [ファイル]` |
| `fixing-metadata` | メタタグ・OGP・canonical の修正 | `/fixing-metadata` |
| `fixing-motion-performance` | アニメーションのパフォーマンス問題修正 | `/fixing-motion-performance [ファイル]` |
| `frontend-design` | 高品質な UI 実装（デザイン性重視） | `/frontend-design [要件]` |
| `vercel-react-best-practices` | React/Next.js パフォーマンス最適化（65 ルール） | `/vercel-react-best-practices` |
| `vercel-composition-patterns` | React コンポーネント設計パターン（Compound 等） | `/vercel-composition-patterns` |
| `seo-audit` | SEO 監査（クロール・インデックス・Core Web Vitals） | `/seo-audit` |

### ツール・外部サービス

| Skill | 用途 | コマンド |
|---|---|---|
| `browser-use` | ブラウザ自動操作（スクレイピング・テスト・スクリーンショット） | `/browser-use` |
| `find-skills` | skills.sh から新しい Skill を検索・インストール | `/find-skills [query]` |
| `diary` | 開発日誌・記事下書きを生成 | `/diary` |
| `sleek-design-mobile-apps` | Sleek API でモバイルアプリ画面をデザイン ※要 `SLEEK_API_KEY` | `/sleek-design-mobile-apps` |

---

## クイックスタート

```bash
# PR をレビューする（番号指定）
/review-pr 64

# 引数なし → オープン PR 5件から選択
/review-pr

# git diff をレビューする
/code-review-expert

# docs 全体をチェック
/doc-review

# 特定ファイルだけチェック
/doc-review docs/architecture.md

# Issue を実装する
/fix-issue 17

# マイグレーションを作る
/db-migrate add_items_table
```

---

## ユースケース別の使い方

### 実装を始める前

```
/brainstorming
```

機能・コンポーネント・設計を決める前に使う。
Claude が要件を質問しながら 2〜3 案を提案し、spec ドキュメントを生成してくれる。
**コードを書く前に必ず通す（HARD GATE）。**

---

### PR 作成後 → マージ前

```
/review-pr 64
```

1. PR の diff・説明を読み込む
2. P0〜P3 の深刻度別でフィードバックを日本語で出力
3. 「実装しましょうか？」と確認してくる
4. `承認` / `修正依頼` / `要議論` の判定を出す

---

### コーディング中の差分レビュー

```
/code-review-expert
```

git の変更差分を対象に SOLID・セキュリティ・パフォーマンスを網羅的にチェック。
PR を作る前の自己レビューに使う。

---

### リリース前 / ドキュメントに違和感があるとき

```
/doc-review                          # 全体スキャン
/doc-review docs/architecture.md    # 特定ファイルのみ
```

ポート番号・用語（items）・デプロイ先・env 管理の記述を実際のコードと照合して確認する。

---

### UI を実装・改善するとき

```
/baseline-ui src/components/features/ItemCard.tsx   # UI 品質チェック
/fixing-accessibility src/components/ui/Button.tsx  # アクセシビリティ修正
/frontend-design カード一覧ページ                     # 高品質な UI 実装
/vercel-react-best-practices                         # パフォーマンス最適化ルール適用
```

---

## 注意点

**`review-pr` に渡すのは PR 番号のみ**（Issue 番号は不可）

```bash
# オープン PR の確認
gh pr list --state open
```

**引数なし時の挙動まとめ**

| Skill | 引数なし時 |
|---|---|
| `review-pr` | オープン PR 最新 5 件を表示 → 選択式 |
| `doc-review` | docs 全体をスキャン |
| `code-review-expert` | 現在の git diff を対象 |

**よくあるミス**

- `/review-pr 15` → マージ済み PR は 404。`gh pr list --state open` で確認する
- `sleek-design-mobile-apps` は `SLEEK_API_KEY` 環境変数が必要

---

## 開発フローへの組み込み

```
1. /brainstorming          ← 設計・仕様を固める
2. /fix-issue 17           ← Issue から実装（または手動実装）
3. /code-review-expert     ← 差分の自己レビュー
4. PR 作成
5. /review-pr 64           ← PR レビュー
6. 修正 → マージ

リリース前:
7. /doc-review             ← ドキュメントが実装と一致しているか確認
8. /deploy staging         ← staging デプロイ
9. 確認後 → /deploy production
```

---

## 新しい Skill を追加するには

```bash
# skills.sh から検索・インストール
/find-skills [query]

# または手動で作成
# .claude/skills/<skill-name>/SKILL.md を作成
# → Claude Code を再起動すると /コマンドとして使えるようになる
```

追加したら、このドキュメントの一覧テーブルに追記すること。
