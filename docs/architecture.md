# ImagePalace アーキテクチャ設計書

> 最終更新: 2026-03-17

---

## 全体構成図（モノレポ）

```
image-palace/
├── apps/
│   ├── frontend/      # Next.js 15 + TypeScript
│   ├── backend/       # Rails 8 API mode
│   └── mobile/        # 将来追加（現在空）
├── packages/
│   ├── ui/            # 共通コンポーネントライブラリ（shadcn/ui ベース）
│   └── types/         # 共通 TypeScript 型定義
├── infra/             # Docker Compose / Terraform 等
├── docs/              # アーキテクチャ設計書・意思決定ログ
└── tools/             # スクリプト等
```

---

## apps/frontend/

### 技術構成

| 項目 | 採用技術 |
|-----|---------|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイリング | TailwindCSS |
| UI コンポーネント | shadcn/ui |
| 状態管理 | Zustand |
| テスト | Vitest + Testing Library + MSW |

### ディレクトリ規約

```
apps/frontend/
├── app/                  # App Router: pages, layouts, route handlers
│   ├── (auth)/           # Route groups（認証不要ページ）
│   └── (app)/            # Route groups（認証必要ページ）
├── components/           # 再利用可能なコンポーネント
│   ├── ui/               # shadcn/ui から取り込んだ基本 UI
│   └── features/         # ドメイン固有コンポーネント
├── hooks/                # カスタム React Hooks
├── lib/                  # ユーティリティ・API クライアント
├── stores/               # Zustand ストア
└── types/                # フロントエンド固有の型定義
```

### ルール

- `export default` は pages と layouts のみ。それ以外は named export
- API 呼び出しは `lib/api/` に集約。コンポーネントから直接 `fetch` しない
- Server Components をデフォルトとし、インタラクションが必要な場合のみ `"use client"` を付ける

---

## apps/backend/

### 技術構成

| 項目 | 採用技術 |
|-----|---------|
| フレームワーク | Ruby on Rails 8 (API mode) |
| DB | PostgreSQL (Neon) |
| キャッシュ / ジョブキュー | Redis |
| 非同期処理 | ActiveJob |
| ストレージ | ActiveStorage + AWS S3 |
| テスト | RSpec + FactoryBot |

### ディレクトリ規約

```
apps/backend/
├── app/
│   ├── controllers/api/v1/  # API エンドポイント（バージョニング）
│   ├── models/              # ActiveRecord モデル
│   ├── services/            # ビジネスロジック（Service オブジェクト）
│   ├── jobs/                # ActiveJob
│   └── serializers/         # JSON シリアライザ
├── config/
│   └── routes.rb            # namespace :api, namespace :v1 で管理
├── db/
│   ├── migrate/             # マイグレーション
│   └── schema.rb
└── spec/                    # RSpec テスト
```

### ルール

- ビジネスロジックは `services/` に切り出す（コントローラーは薄く保つ）
- N+1 クエリ禁止。`includes` / `preload` / `eager_load` で解決
- RuboCop を CI で実行。警告は PR マージ前に解消すること

---

## packages/ui/

- shadcn/ui コンポーネントをカスタマイズしたものを置く
- **現状**: まだ実体がない。frontend で直接 shadcn/ui を使っている状態
- **移行判断基準**: frontend と mobile の両方で同じコンポーネントを使う必要が生じたら移行する

---

## packages/types/

- frontend と backend の間で共有する TypeScript 型定義
- **現状**: まだ実体がない
- **移行判断基準**: API レスポンス型を frontend 側でも使い始めたら移行する（今は frontend の `types/` に置く）

---

## infra/

```
infra/
├── docker-compose.yml        # ローカル開発環境（全サービス起動）
├── docker-compose.test.yml   # CI 用（DB のみ）
└── terraform/                # 将来: AWS インフラ as Code
```

- ローカルは `docker compose up` ですべてのサービスが起動すること
- 本番環境との差分は環境変数で吸収する

---

## docs/

```
docs/
├── OS.md                   # コアアーキテクチャ設計書（Do NOT Touch）
├── architecture.md         # このファイル
├── design/                 # Figma エクスポート PDF（参照用スナップショット）
│   └── README.md           # Figma URL と更新手順
└── decisions/              # 意思決定ログ（ADR）
    ├── infra-backend.md    # バックエンドインフラ選定
    └── image-storage.md    # ストレージ・CDN 戦略
```

### ルール

- `docs/OS.md`: 構造変更は必ずチームで議論してから
- `docs/design/`: Figma が正本。PDF は直接編集禁止
- `docs/decisions/`: 削除・上書き禁止。追記のみ

---

## 画像生成フロー（非同期）

```
[Frontend]                    [Backend]                      [外部サービス]
  |                              |                                |
  | POST /api/v1/cards           |                                |
  |  { word: "photosynthesis" }  |                                |
  |----------------------------->|                                |
  |                              | 同一単語チェック（DB）          |
  |                              |---> キャッシュあり: 即レスポンス|
  |                              |                                |
  |                              | キャッシュなし:                 |
  |                              | ActiveJob をエンキュー          |
  | 202 Accepted                 |----> Redis (job queue)         |
  |<-----------------------------|                                |
  |  { status: "pending",        |      [ImageGenerationJob]      |
  |    card_id: 123 }            |       |                        |
  |                              |       | OpenAI Images API      |
  |  ポーリング or WebSocket     |       |----------------------->|
  |  GET /api/v1/cards/123       |       | 画像 URL が返る         |
  |----------------------------->|       |<-----------------------|
  |                              |       | S3 に保存              |
  |                              |       | DB を completed に更新  |
  | 200 OK                       |       |                        |
  | { status: "completed",       |<------|                        |
  |   image_url: "cdn://..." }   |                                |
  |<-----------------------------|                                |
```

### キャッシュ戦略

- 同一単語（正規化済み）の画像は DB に保存し、再生成しない
- S3 に保存した画像は CDN（CloudFront or Cloudflare Images）経由で配信
- S3 直配信は禁止

---

## 環境構成

| 環境 | Frontend | Backend | DB | CDN |
|-----|---------|---------|-----|-----|
| local | localhost:3001 | localhost:3000 | Docker PostgreSQL | なし（S3 直接） |
| staging | Cloudflare Pages | Render or Railway | Neon (staging schema) | CloudFront |
| production | Cloudflare Pages | Render or Railway → Cloud Run | Neon (production) | CloudFront |

### 環境変数管理

- ローカル: `.env.local`（コミットしない）
- staging/production: ホスティングサービスのダッシュボードで管理

---

## 将来の拡張ポイント

1. **Graph Memory OS**: `docs/OS.md` に設計。カード間のリンク・グラフ構造
2. **Mobile アプリ**: `apps/mobile/` に React Native または Flutter を追加
3. **Cloud Run 移行**: バックエンドが月額 $100 超または急増時に Render/Railway から移行
4. **マルチモーダル**: 画像だけでなく音声・動画メモリカードへの拡張
5. **サブスク課金**: Stripe + 生成枚数制限の実装
