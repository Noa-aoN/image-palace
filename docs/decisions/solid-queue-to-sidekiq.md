# ADR: Solid Queue → Sidekiq 移行手順

- **日付**: 2026-03-25
- **ステータス**: 参考（移行時に参照）
- **決定者**: チーム

---

## コンテキスト

MVP フェーズでは PostgreSQL をキューストアとして使う Solid Queue を採用している。
スケールアウト時に Redis ベースの Sidekiq へ移行する際の完全な手順を記録しておく。

---

## 移行タイミングの目安

以下のいずれかを満たしたら移行を検討する:

- 同時接続ユーザーが 1 万人を超えた
- ジョブの遅延が頻繁に発生するようになった
- ジョブ数が 1,000 件/時間を超えた

---

## 移行手順

### Step 1: Gemfile 変更

```ruby
# 削除
gem "solid_queue"

# 追加
gem "sidekiq"
```

### Step 2: bundle install

```bash
bundle install
```

### Step 3: Upstash Redis の設定

1. https://upstash.com でアカウント作成
2. Redis データベースを作成（**Fixed Plan を選ぶ・PAYG は高額になる**）
3. 接続 URL をメモ

### Step 4: config/application.rb 変更

```ruby
# 変更前
config.active_job.queue_adapter = :solid_queue
# 変更後
config.active_job.queue_adapter = :sidekiq
```

### Step 5: config/initializers/sidekiq.rb 作成

```ruby
Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch('REDIS_URL') }
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch('REDIS_URL') }
end
```

### Step 6: docker-compose.yml に redis 追加

```yaml
redis:
  image: redis:7-alpine
  volumes:
    - redis_data:/data
  ports:
    - "6379:6379"

volumes:
  redis_data:
```

### Step 7: 環境変数追加

```bash
# backend/.env.example に追加
REDIS_URL=redis://redis:6379/0

# Fly.io 本番環境
fly secrets set REDIS_URL="rediss://xxx.upstash.io:6379"
```

### Step 8: fly.toml 変更

```toml
# 変更前
[processes]
  web    = "bundle exec rails server -b 0.0.0.0 -p 3000"
  worker = "bundle exec rails solid_queue:start"

# 変更後
[processes]
  web    = "bundle exec rails server -b 0.0.0.0 -p 3000"
  worker = "bundle exec sidekiq"
```

### Step 9: Solid Queue のマイグレーションを削除

```bash
# 既存の solid_queue テーブルを削除するマイグレーションを作成
rails g migration DropSolidQueueTables
```

### Step 10: デプロイ・確認

```bash
fly deploy
curl https://image-palace-api.fly.dev/api/v1/health
```

---

## コスト変化

| 構成 | コスト |
|-----|-------|
| Solid Queue（現在） | $0/月（DB 内で処理） |
| Sidekiq + Upstash Redis（移行後） | +$10/月（Fixed Plan） |

---

## 注意点

- Upstash Redis は **Fixed Plan を必ず選ぶ**（PAYG は Sidekiq のポーリングで高額になる）
- 移行時にキュー内の未処理ジョブがあれば、すべて処理が完了してから切り替える
- ジョブクラス自体（`GenerateCardImageJob` 等）は変更不要（ActiveJob 経由なので透過的）
