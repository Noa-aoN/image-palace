# ImagePalace アーキテクチャ設計書

> 最終更新: 2026-03-17

---

## 全体構成図（モノレポ）

```
image-palace/
├── apps/
│   ├── frontend/      # Next.js 16 + TypeScript
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
| フレームワーク | Next.js 16 (App Router) |
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
| 非同期処理 | Solid Queue（ActiveJob経由、DB-backed） |
| ストレージ | ActiveStorage + Cloudflare R2 |
| テスト | RSpec + FactoryBot |

### ディレクトリ規約

```
apps/backend/
├── app/
│   ├── controllers/api/v1/  # API エンドポイント（バージョニング）
│   ├── models/              # ActiveRecord モデル
│   ├── services/            # ビジネスロジック（Service オブジェクト）
│   ├── jobs/                # Solid Queue ジョブ（ActiveJob経由）
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
  | POST /api/v1/items           |                                |
  |  { title: "photosynthesis",  |                                |
  |    force_generate: false }   |                                |
  |----------------------------->|                                |
  |                              | item作成(pending)              |
  |                              | Solid Queue ジョブをエンキュー   |
  | 202 Accepted                 |----> Solid Queue (PostgreSQL)  |
  |<-----------------------------|                                |
  |  { status: "pending",        |      [GenerateImageJob]        |
  |    item_id: "uuid" }         |       |                        |
  |                              |       | normalized_promptで     |
  |  ポーリング or WebSocket     |       | SharedMediaを検索        |
  |  GET /api/v1/items/:id       |       |                        |
  |----------------------------->|       | HIT: blob参照のみ       |
  |                              |       | MISS: OpenAI API呼び出し|
  |                              |       |----------------------->|
  |                              |       | 画像 URL が返る         |
  |                              |       |<-----------------------|
  |                              |       | SharedMedia + R2に保存  |
  |                              |       | DB を completed に更新  |
  | 200 OK                       |       |                        |
  | { status: "completed",       |<------|                        |
  |   media: { url: "..." } }    |                                |
  |<-----------------------------|                                |
```

### キャッシュ戦略

- `NormalizePromptService` で正規化したプロンプトをキーに `shared_media` を検索
- HIT: 既存 blob を参照（R2アクセスなし、OpenAI APIなし）
- MISS: OpenAI API → R2保存 → `shared_media` に記録
- `force_generate: true` でキャッシュを無視して再生成可能
- 画像URLは `CDN_BASE_URL` が設定されていれば CDN 経由、未設定なら ActiveStorage リダイレクト経由
- R2 直配信は禁止

---

## 環境構成

| 環境 | Frontend | Backend | DB | CDN |
|-----|---------|---------|-----|-----|
| local | localhost:3001 | localhost:3000 | Docker PostgreSQL | なし（R2 直接） |
| staging | Cloudflare Workers | Fly.io | Neon (staging schema) | Cloudflare CDN |
| production | Cloudflare Workers | Fly.io | Neon (production) | Cloudflare CDN |

### 環境変数管理

- ローカル: `.env.local`（コミットしない）
- staging/production: ホスティングサービスのダッシュボードで管理

---

## 将来の拡張ポイント

1. **Graph Memory OS**: `docs/OS.md` に設計。カード間のリンク・グラフ構造
2. **Mobile アプリ**: `apps/mobile/` に React Native または Flutter を追加
3. **Fly.io スケール**: リージョン追加・オートスケール設定でトラフィック増加に対応
4. **マルチモーダル**: 画像だけでなく音声・動画メモリカードへの拡張
5. **サブスク課金**: Stripe + 生成枚数制限の実装

---

## このドキュメントの更新ルール

### 更新が必要なタイミング

- ディレクトリ構成や技術スタックに変更があった場合
- 新しいサービス・パッケージを追加した場合
- 画像生成フローなどのコアフローを変更した場合
- 環境構成（ホスティング先・DB・CDN）が変わった場合

### 更新手順

1. 変更内容を `docs/decisions/` に ADR（意思決定ログ）として記録する
2. この `architecture.md` を更新する
3. `CLAUDE.md` の関連セクションも確認し、必要なら更新する
4. PR の説明に「アーキテクチャ変更あり」と明記してレビュワーに知らせる

### やってはいけないこと

- `docs/OS.md` をチームの議論なしに直接編集する
- `docs/decisions/` の既存ファイルを上書き・削除する
- Figma が正本のデザイン情報をこのファイルに転記する（ずれが生じる）
- このファイルに実装詳細（関数名・変数名レベル）を書く（コードが正本）

### CLAUDE.md との役割分担

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | Claude Code への指示・ワークフロールール・ビジネスコンテキスト |
| `docs/architecture.md` | 人間・AI が参照するシステム設計の全体像 |
| `docs/decisions/` | 個別の意思決定の背景・理由・トレードオフ |
| `docs/OS.md` | 将来の Graph Memory OS のコアアーキテクチャ設計 |

### TODO（画面遷移図完成後に更新する項目）

- [ ] 画面遷移図（Figma 完成後に `docs/design/` へ PDF エクスポート）
- [ ] 認証フロー（devise-token-auth 実装確定後に追記）
- [ ] API エンドポイント一覧（backend 実装開始後に `docs/api.md` へ）
- [ ] データモデル図（DB スキーマ確定後に追記）

---

## ディレクトリ構成（予定）

```
image-palace/
├── CLAUDE.md                        # プロジェクト全体の指示書
├── CLAUDE.local.md                  # 個人設定（gitignore）
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml               # バックエンドのみ（ローカル開発）
│
├── .claude/
│   ├── settings.json                # チーム共有
│   ├── settings.local.json          # 個人設定（gitignore）
│   ├── hooks/
│   │   ├── lint-on-save.sh
│   │   ├── block-protected-files.sh
│   │   └── block-secrets.sh
│   ├── rules/
│   │   ├── code-style.md
│   │   ├── testing.md
│   │   ├── security.md
│   │   ├── git-workflow.md
│   │   └── frontend/
│   │       ├── react.md
│   │       └── styles.md
│   └── skills/
│       ├── deploy/SKILL.md
│       ├── review-pr/SKILL.md
│       ├── fix-issue/SKILL.md
│       └── db-migrate/SKILL.md
│
├── docs/
│   ├── architecture.md              # 技術選定・構成（このファイル）
│   ├── api.md                       # APIエンドポイント一覧（実装後追記）
│   ├── spec.md
│   ├── OS.md
│   ├── decisions/
│   │   ├── infra-backend.md         # バックエンドインフラ選定
│   │   ├── image-storage.md         # ストレージ・CDN戦略
│   │   └── git-workflow.md
│   └── design/
│       └── README.md
│
├── backend/                         # Rails 8 APIモード
│   ├── Gemfile
│   ├── Dockerfile
│   ├── fly.toml
│   ├── .env.example
│   ├── app/
│   │   ├── controllers/api/v1/
│   │   │   ├── auth/
│   │   │   │   ├── registrations_controller.rb
│   │   │   │   └── sessions_controller.rb
│   │   │   ├── base_controller.rb
│   │   │   └── objects_controller.rb
│   │   ├── jobs/
│   │   │   └── generate_card_image_job.rb
│   │   ├── models/
│   │   │   ├── user.rb
│   │   │   ├── object.rb
│   │   │   ├── medium.rb
│   │   │   └── shared_medium.rb
│   │   └── services/
│   │       ├── normalize_prompt_service.rb
│   │       ├── generate_image_service.rb
│   │       └── upload_to_r2_service.rb
│   ├── config/
│   │   ├── initializers/
│   │   │   ├── cors.rb
│   │   │   └── devise.rb
│   │   ├── routes.rb
│   │   └── storage.yml
│   ├── db/
│   │   ├── migrate/
│   │   └── seeds.rb
│   └── spec/                        # MVPリリース後に追加
│
├── frontend/                        # Next.js 16 App Router
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── open-next.config.ts
│   ├── wrangler.toml                # Cloudflare Workers用
│   ├── middleware.ts                 # 認証ガード
│   ├── .env.example
│   └── src/
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (app)/
│       │   │   ├── dashboard/
│       │   │   └── objects/
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── ui/                  # shadcn/ui
│       │   └── features/
│       ├── hooks/
│       ├── lib/
│       │   └── api/
│       ├── stores/
│       └── types/
│
└── .github/
    └── workflows/                   # MVPリリース後
```

---

## デプロイ構成

| レイヤー | サービス | 備考 |
|---|---|---|
| フロントエンド | Cloudflare Workers（OpenNext経由） | Cloudflare Pagesではない（2024年12月以降の公式推奨） |
| バックエンド | Fly.io | Rails 8 + Solid Queue 同居 |
| DB | Neon（PostgreSQL） | スキーマ変更なしでRDS移行可能 |
| 画像ストレージ | Cloudflare R2 | S3互換・転送完全無料 |
| AI画像生成 | OpenAI DALL-E 3 | normalized_promptキャッシュで重複排除 |
