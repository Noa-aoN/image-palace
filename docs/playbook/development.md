# 開発マニュアル（Development Playbook）

> 自分向けの開発・運用リファレンス。
> 環境別・レイヤー別に「何をどこでどうやるか」をまとめる。

---

## 目次

1. [環境一覧](#環境一覧)
2. [ローカル開発](#ローカル開発)
3. [Staging 環境](#staging-環境)
4. [本番環境](#本番環境)
5. [レイヤー別リファレンス](#レイヤー別リファレンス)
6. [AI Skill の活用](#ai-skill-の活用)
7. [トラブルシューティング](#トラブルシューティング)

---

## 環境一覧

| 環境 | Frontend | Backend | DB | 用途 |
|-----|---------|---------|-----|------|
| **local** | http://localhost:3000 | http://localhost:3001 | Docker PostgreSQL | 日常開発 |
| **staging** | https://image-palace-frontend.image-palace.workers.dev | https://image-palace-api.fly.dev | Neon (staging) | 動作確認・レビュー |
| **production** | （staging と同ドメイン・将来分離予定） | https://image-palace-api.fly.dev | Neon (production) | 本番 |

---

## ローカル開発

### 起動

```bash
# 全サービス起動（backend + DB）
docker compose up

# バックエンドのみ
docker compose up backend

# フロントエンド（別ターミナル）
cd frontend
npm run dev
```

### 環境変数

| ファイル | 役割 | Git管理 |
|---------|------|--------|
| `backend/.env` | DB接続・APIキー・CORS設定 | しない |
| `frontend/.env.development` | `NEXT_PUBLIC_*` ローカル設定 | する |
| `frontend/.env.local` | フロントのシークレット（将来用） | しない |

**初回セットアップ:**
```bash
# backend
cp backend/.env.example backend/.env
# → DB URL・Google OAuth credentials・OpenAI API key を記入

# frontend: .env.development は既にコミット済みのため追加作業なし
```

### よく使うコマンド

**バックエンド（Docker内で実行）:**
```bash
docker compose exec backend rails db:migrate
docker compose exec backend rails db:rollback
docker compose exec backend rails db:seed
docker compose exec backend rails console
docker compose exec backend bundle exec rspec
docker compose exec backend bundle exec rubocop
docker compose exec backend bundle exec rubocop -A
```

**フロントエンド（frontend/ で実行）:**
```bash
npm run dev          # 開発サーバー
npm run build        # ビルド確認（production設定で）
npm run lint         # ESLint
npm run lint:fix     # ESLint 自動修正
npm run type-check   # TypeScript 型チェック
```

---

## Staging 環境

### デプロイ

**フロントエンド（Cloudflare Workers）:**
```bash
cd frontend
npm run deploy
# → .env.production の NEXT_PUBLIC_API_BASE_URL が本番URLで焼き付く
```

**バックエンド（Fly.io）:**
```bash
cd backend
fly deploy
```

**DBマイグレーション（staging）:**
```bash
cd backend
fly ssh console -C "rails db:migrate"
```

### 環境変数の確認・更新

```bash
# 設定済み secrets の一覧（値は非表示）
fly secrets list

# secret を追加・更新
fly secrets set KEY=value

# 主要 secrets
# APP_HOST, FRONTEND_URL, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
# OPENAI_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
# DATABASE_URL, CORS_ORIGINS
```

### ログ確認

```bash
fly logs                    # リアルタイムログ
fly logs --app image-palace-api
```

---

## 本番環境

> staging で動作確認 → 本番に手動プロモート の順を必ず守る。

### デプロイ手順

1. staging で `fly deploy` → 動作確認
2. DBマイグレーションが必要なら staging で先に実行・確認
3. 本番への適用:
```bash
fly deploy --app image-palace-api-production  # アプリ名要確認
fly ssh console -C "rails db:migrate" --app image-palace-api-production
```

### ロールバック

```bash
# 直前のバージョンに戻す
fly releases --app image-palace-api
fly deploy --image <previous-image>
```

---

## レイヤー別リファレンス

### Frontend（Next.js + Cloudflare Workers）

| 目的 | 場所 |
|-----|------|
| ページ追加 | `src/app/(app)/` または `src/app/(auth)/` |
| APIクライアント | `src/lib/api/` |
| 認証状態管理 | `src/stores/auth.ts` |
| 共通UIコンポーネント | `src/components/ui/`（shadcn/ui） |
| ドメイン固有コンポーネント | `src/components/features/` |
| 環境変数（開発） | `frontend/.env.development` |
| 環境変数（本番） | `frontend/.env.production` |
| デプロイ設定 | `frontend/wrangler.toml` |

**`NEXT_PUBLIC_*` 変数の注意点:**
- クライアントコンポーネントでは **ビルド時に静的置換** される（ランタイム変更不可）
- `npm run deploy` は内部で `next build` → Cloudflare デプロイを行う
- `.env.development` / `.env.production` の分離により環境ごとに正しい値が入る

**認証フロー（OAuth）:**
```
LoginForm → googleOAuthUrl() → backend /auth/google_oauth2
→ Google認証 → backend /auth/callback → frontend /auth/callback
→ validate_token → Zustand setAuth → /dashboard
```

### Backend（Rails 8 API + Fly.io）

| 目的 | 場所 |
|-----|------|
| APIエンドポイント追加 | `app/controllers/api/v1/` |
| ビジネスロジック | `app/services/` |
| 非同期ジョブ | `app/jobs/` |
| DBスキーマ変更 | `rails g migration ...` → `rails db:migrate` |
| ルーティング | `config/routes.rb` |
| CORS設定 | `config/initializers/cors.rb` |
| OAuth設定 | `config/initializers/devise.rb` |

**新規 API エンドポイントの追加パターン:**
```ruby
# config/routes.rb
namespace :api do
  namespace :v1 do
    resources :items, only: [:index, :show, :create, :destroy]
  end
end
```

**ジョブのエンキュー:**
```ruby
GenerateImageJob.perform_later(item_id: item.id)
```

### Infra

| 目的 | 場所・コマンド |
|-----|--------------|
| ローカルDB起動 | `docker compose up` |
| Fly.io デプロイ | `fly deploy` |
| Fly.io ログ | `fly logs` |
| Fly.io secrets | `fly secrets set KEY=value` |
| Cloudflare Workers デプロイ | `cd frontend && npm run deploy` |
| Cloudflare Workers ログ | Cloudflare Dashboard > Workers > Logs |
| Neon DB接続 | Neon Dashboard で接続URLを確認 |

---

## AI Skill の活用

Claude Code の `/コマンド` で呼び出せる Skill を開発フローに組み込む。
全 Skill の一覧・詳細は [`docs/playbook/skills.md`](./skills.md) を参照。

### 標準的な開発サイクル

```
1. /brainstorming          設計・仕様を固める（コーディング前に必ず通す）
2. 実装（または /fix-issue [Issue番号]）
3. /code-review-expert     差分の自己レビュー（PR 作成前）
4. PR 作成
5. /review-pr [PR番号]     PR レビュー → 修正 → マージ
```

### リリース前チェック

```
/doc-review                docs が実装と一致しているか確認
/deploy staging            staging デプロイ
/deploy production         本番デプロイ（staging 確認後）
```

### よく使うシーン別

| シーン | Skill |
|---|---|
| Issue を実装したい | `/fix-issue 17` |
| マイグレーションを作りたい | `/db-migrate add_items_table` |
| UI コンポーネントを作りたい | `/frontend-design [要件]` |
| アクセシビリティを直したい | `/fixing-accessibility [ファイル]` |
| ドキュメントが古い気がする | `/doc-review` |
| コードの動きを理解したい | `/explain-code [対象]` |
| 現在のブランチ状況を確認したい | `/status` |

---

## トラブルシューティング

### ローカルでバックエンドに繋がらない

```bash
# コンテナ起動確認
docker compose ps

# ポート確認（3001番が空いているか）
lsof -i :3001

# ログ確認
docker compose logs backend
```

### OAuthがlocalに飛ぶ（本番デプロイ後）

**原因**: `NEXT_PUBLIC_API_BASE_URL` がビルド時に `localhost` で焼き付いている可能性

```bash
# 確認: ビルド済みファイルで localhost が混入していないか
grep -r "localhost" frontend/.next/static/ 2>/dev/null | head -5

# 対処: .env.local に NEXT_PUBLIC_* が残っていないか確認
cat frontend/.env.local

# 正しくデプロイ
cd frontend && npm run deploy
```

### Fly.io デプロイ後に 500 エラー

```bash
# ログ確認
fly logs

# マイグレーション未実行の可能性
fly ssh console -C "rails db:migrate:status"
fly ssh console -C "rails db:migrate"

# secrets の設定漏れ確認
fly secrets list
```

### フロントのビルドが失敗する

```bash
cd frontend

# 型エラー確認
npm run type-check

# lint エラー確認
npm run lint

# node_modules 再インストール
rm -rf node_modules && npm install
```

### DBマイグレーションの競合

```bash
# ステータス確認
docker compose exec backend rails db:migrate:status

# rollback してやり直す
docker compose exec backend rails db:rollback STEP=1
docker compose exec backend rails db:migrate
```

### 画像生成が完了しない（ステータスが pending のまま）

```bash
# Solid Queue のワーカーが動いているか確認
docker compose exec backend rails solid_queue:start

# ジョブのエラーログ確認
docker compose exec backend rails console
> SolidQueue::Job.failed.last&.last_execution&.error
```
