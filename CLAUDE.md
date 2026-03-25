# ImagePalace

## プロジェクト概要

イメージ特化型学習支援サービス。単語・概念をAI生成画像に変換し、
視覚的に記憶しやすいカード形式で管理・想起するWebアプリ。

将来的には「Image-first, Object-based, Graph Memory OS」へ拡張する設計。
MVPでは「イメージで記憶設計する学習アプリ」として振る舞う。

## 参照ファイル

- プロジェクト全体の概要: @README.md
- ディレクトリ構成・各層の責務・データフロー: @docs/architecture.md
- 機能仕様・用語集・MVP機能一覧: @docs/spec.md
- コミットルール・コーディング規約: @.claude/rules/code-style.md
- テスト方針: @.claude/rules/testing.md
- セキュリティルール: @.claude/rules/security.md
- インフラ選定の意思決定: @docs/decisions/infra-backend.md

## Why This Architecture

- **モノレポ**: frontend / backend / 将来のmobileを横断して型・コンポーネントを共有するため
- **Next.js App Router**: SSR + RSC でSEO対応しつつ画像表示を高速化
- **Rails API mode**: チームが Ruby に慣れているため。Solid Queue で画像生成を非同期化
- **PostgreSQL on Neon**: サーバーレスDBでコスト最小化。Fly.io との相性が良い
- **OpenAI Images API（DALL-E 3）**: 画像生成の品質と手軽さのバランスが最良
- **devise-token-auth**: Rails Token 認証。Next.js SPA との相性が良く、ヘッダーベースで CSRF リスクを回避
- **Fly.io（MVP〜スケール）**: Render/Railway より柔軟。リージョン選択・スケールアウトが容易。Dockerfile さえあれば移行コストも低い
- **Cloudflare R2 + CDN**: egress 無料で S3 より低コスト。ActiveStorage 経由でアップロード。直接 URL 配信は行わない
- **Solid Queue**: Rails 8 標準の DB-backed ジョブキュー。PostgreSQL を使うため Redis 不要でインフラがシンプル

## コマンド集

### Backend（apps/backend/）
```bash
docker compose up           # 開発サーバー全体起動
docker compose up backend   # バックエンドのみ起動
rails db:migrate            # マイグレーション実行
rails db:rollback           # 直前のマイグレーションを戻す
bundle exec rspec           # テスト実行
bundle exec rubocop         # Lint チェック
bundle exec rubocop -A      # Lint 自動修正
```

### Frontend（apps/frontend/）
```bash
npm run dev                 # 開発サーバー起動（localhost:3001）
npm run build               # ビルド確認
npm run lint                # ESLint チェック
npm run lint:fix            # ESLint 自動修正
npm run type-check          # tsc --noEmit
```

---

## ER図の重要テーブル（MVP）

```
users              ユーザー（devise-token-auth）
objects            単語カードの実体（"card" ではなく "object" が正名称）
object_types       objectの種別（word / concept / etc.）
meanings           objectに紐づく意味・説明（任意）
media              objectの画像（ActiveStorage + R2）
shared_media       正規化済みプロンプトをキーにした画像キャッシュ
plans              料金プラン
subscriptions      ユーザーのプラン契約
credit_transactions 生成クレジットの増減ログ
payments           決済レコード
```

> ⚠️ `cards` / `card_sets` テーブルは使わない。実体は `objects`。

---

## キャッシュ設計（最重要）

`shared_media.normalized_prompt` に UNIQUE 制約。
同じ単語は世界中で1回しか OpenAI API を呼ばない。
`GenerateCardImageJob` でキャッシュ HIT/MISS を判定する。

---

## MVPで作らないもの（スコープ外）

- ボード配置（spaces/positions）← MVPリリース後
- クイズ・ゲーム機能
- タグ・カテゴリ管理
- SNS共有
- CI/CD パイプライン（MVPリリース後）
- デッキ（collections）機能

---

## Do NOT Touch

- `docs/OS.md` — コアアーキテクチャ設計書。構造変更は必ず議論してから
- `docs/design/` — Figma が正本。PDF は参照用のみ、直接編集禁止
- `docs/decisions/` — 意思決定ログ。削除・上書き禁止。追記のみ

## Deploy & Environments

- local: `docker compose up`
- staging: Fly.io（backend）+ Cloudflare Pages（frontend）への**自動デプロイ**（GitHub Actions が develop → staging を自動で行う）
- production: staging 確認後に**手動プロモート**（自動デプロイしない）
- ストレージ: Cloudflare R2。staging / production で別バケット
- DB migrations: staging で先に実行 → 動作確認 → production 適用の順を守る

## Team Workflow

- コードコメント・コミットメッセージは日本語 OK
- PR は必ず `/review-pr` skill を通す
- テストなしのコードはマージしない
- feat/ ブランチは squash merge で main へ
- コミットメッセージは Conventional Commits 形式（詳細は .claude/rules/code-style.md）
- PR タイトルも同じ形式

## Business Context

- 同一単語の画像は生成結果をキャッシュしてAPIコスト削減（同じ単語を2回生成しない）
- 画像生成は非同期（Sidekiq + Upstash Redis）。UIはポーリングまたはWebSocketで更新
- MVP は無料枠あり（生成枚数に上限）。将来はサブスク課金
- OpenAI API キーはバックエンドのみに置く。フロントエンドから直接呼び出し禁止
