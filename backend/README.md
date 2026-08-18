# backend — Rails 8.1 API

ImagePalace の API。単体では動かない前提で、リポジトリ全体の README を先に読んでください
→ [../README.md](../README.md)

## 動かす

```bash
docker compose up               # リポジトリのルートで実行（backend: 3001）
docker compose exec web bundle exec rails db:migrate
docker compose exec web bundle exec rspec
docker compose exec web bundle exec rubocop
```

## この中の構成

| ディレクトリ | 役割 |
|---|---|
| `app/controllers/api/v1/` | エンドポイント。認可は `base_controller.rb` に集約 |
| `app/services/` | ビジネスロジック。コントローラーは薄く保つ |
| `app/jobs/` | Solid Queue のジョブ（画像生成など） |
| `spec/` | RSpec。models / requests / services / jobs / security |

- 構成の意図: [../docs/architecture.md](../docs/architecture.md)
- 判断の記録: [../docs/decisions/](../docs/decisions/)
- API の一覧は `bundle exec rails routes` が正本（100本を超えるため、ここには写さない）
