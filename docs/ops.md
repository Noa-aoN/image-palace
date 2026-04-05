# ImagePalace 運用コマンド集

> 更新日: 2026-04-03

---

## URL一覧

| 環境 | フロントエンド | バックエンド |
|-----|--------------|------------|
| ローカル | http://localhost:3000 | http://localhost:3001 |
| 本番 | https://image-palace-frontend.image-palace.workers.dev | https://image-palace-api.fly.dev |

---

## ローカル開発

### 起動

```bash
# Docker Desktop を起動してから
docker compose up -d

# ログ確認
docker compose logs -f web      # Rails
docker compose logs -f frontend # Next.js
```

### 動作確認（e2e）

```bash
# バックエンド疎通
curl -s http://127.0.0.1:3001/up

# ログイン（トークン取得）
curl -s -D /tmp/login_headers.txt -X POST http://127.0.0.1:3001/api/v1/auth/sign_in \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'

AT=$(grep -i "^access-token:" /tmp/login_headers.txt | tr -d '\r' | awk '{print $2}')
CL=$(grep -i "^client:" /tmp/login_headers.txt | tr -d '\r' | awk '{print $2}')
UD=$(grep -i "^uid:" /tmp/login_headers.txt | tr -d '\r' | awk '{print $2}')

# カード作成
curl -s -X POST http://127.0.0.1:3001/api/v1/items \
  -H "Content-Type: application/json" \
  -H "access-token: $AT" -H "client: $CL" -H "uid: $UD" \
  -d '{"item":{"title":"photosynthesis"}}'

# カード一覧
curl -s http://127.0.0.1:3001/api/v1/items \
  -H "access-token: $AT" -H "client: $CL" -H "uid: $UD"

# カード削除
curl -s -X DELETE http://127.0.0.1:3001/api/v1/items/ITEM_ID \
  -H "access-token: $AT" -H "client: $CL" -H "uid: $UD"

# 失敗カードの再生成
curl -s -X POST http://127.0.0.1:3001/api/v1/items/ITEM_ID/retry \
  -H "access-token: $AT" -H "client: $CL" -H "uid: $UD"
```

### フロントエンドページ確認

```bash
# 全ページ 200 確認
for path in "/" "/login" "/signup" "/dashboard" "/items" "/items/new"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000${path}")
  echo "$code $path"
done
```

### DB 操作

```bash
docker compose exec web bundle exec rails db:migrate
docker compose exec web bundle exec rails db:rollback
docker compose exec web bundle exec rails db:seed
docker compose exec web bundle exec rails console
```

### Lint / 型チェック

```bash
# フロントエンド
cd frontend
npm run lint
npm run type-check

# バックエンド
docker compose exec web bundle exec rubocop
docker compose exec web bundle exec rubocop -A  # 自動修正
```

---

## 本番デプロイ

### バックエンド（Fly.io）

```bash
cd backend
fly deploy
```

- マイグレーションは `fly.toml` の `release_command` で自動実行される
- デプロイ後の確認: `curl -s https://image-palace-api.fly.dev/up`
- `ActiveRecord::ConcurrentMigrationError` が出た場合は、まず `fly releases --app image-palace-api` と `fly logs --app image-palace-api` で別の release_command が走っていないか確認する
- DB スキーマ変更や seed 変更がないデプロイに限り、必要に応じて `fly deploy --skip-release-command` を使ってよい
- DB 変更を含む場合は `--skip-release-command` を使わず、進行中の migration が解消してから再度 `fly deploy` する

### フロントエンド（Cloudflare Workers）

```bash
cd frontend
npm run deploy
# = opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

- デプロイ後の確認: `curl -s -o /dev/null -w "%{http_code}" https://image-palace-frontend.image-palace.workers.dev/`

### 環境変数の更新（Fly.io secrets）

```bash
cd backend

# 確認
fly secrets list

# 追加 / 更新
fly secrets set KEY=value

# 重要な変数
# CORS_ORIGINS   フロントエンドのURL（変更時は必ず更新）
# FRONTEND_URL   同上
# OPENAI_API_KEY
# R2_*           Cloudflare R2 認証情報
# DATABASE_URL   Neon PostgreSQL
```

### CORS設定の更新手順

フロントエンドURLが変わった場合：

```bash
cd backend
fly secrets set \
  CORS_ORIGINS="https://NEW-FRONTEND-URL" \
  FRONTEND_URL="https://NEW-FRONTEND-URL"
```

---

## 本番動作確認

```bash
# バックエンドヘルスチェック
curl -s https://image-palace-api.fly.dev/up

# フロントエンド全ページ確認
for path in "/" "/login" "/signup" "/dashboard" "/items" "/items/new"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://image-palace-frontend.image-palace.workers.dev${path}")
  echo "$code $path"
done

# CORS確認
curl -s -o /dev/null -w "%{http_code}" \
  -H "Origin: https://image-palace-frontend.image-palace.workers.dev" \
  https://image-palace-api.fly.dev/api/v1/health
```

---

## トラブルシューティング

### ローカルで curl が繋がらない

`localhost` が IPv6 に解決される場合がある。`127.0.0.1` を使う:

```bash
curl http://127.0.0.1:3001/up  # ← これを使う
curl http://localhost:3001/up   # ← IPv6解決でタイムアウトする場合がある
```

### 画像生成が失敗する

- OpenAI DALL-E 3 のレート制限（~5 images/min）で複数枚同時生成時に発生しやすい
- `GenerateImageJob` は最大3回リトライ（指数バックオフ: 15s → 60s → 240s）
- 全リトライ後も失敗した場合: 詳細画面の「再生成する」ボタンで手動リトライ可能

### Fly.io のログ確認

```bash
fly logs --app image-palace-api
fly logs --app image-palace-api | grep GenerateImageJob
```
