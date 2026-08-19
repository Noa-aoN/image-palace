# 開発の始め方

```bash
docker compose up          # backend: 3001 / frontend: 3000 / PostgreSQL
```

backend（コンテナの中で実行する）:

```bash
docker compose exec web bundle exec rails db:migrate
docker compose exec web bundle exec rspec
docker compose exec web bundle exec rubocop
```

frontend（`frontend/` で実行する）:

```bash
npm run dev
npm run test
npm run type-check
npm run lint
```

## 変わりやすい情報の正本

変わりやすい情報は、コードや自動生成できるものを正本にする。
文書へ写すと必ず食い違う（実際に一度そうなった）。

| 知りたいこと | 見る場所 |
|---|---|
| API エンドポイントの一覧 | `bundle exec rails routes` |
| 依存パッケージとその版 | `backend/Gemfile.lock` / `frontend/package.json` |
| テーブル・カラム | `backend/db/schema.rb` |
| 原価の単価・付与量などの設定値 | 実装の定数（`CostParameter::DEFAULTS` 等）と運営画面 |

README には、サービス概要・現在の主要技術・基本構成と、公開して差し支えない
設計の考え方までを置く。運用事情（本番の台数・鍵の状態・障害の記録）は含めない。

設計の全体像は [architecture.md](architecture.md)、機能仕様は [spec.md](spec.md)、
判断の記録は [decisions/](decisions/) にある。
