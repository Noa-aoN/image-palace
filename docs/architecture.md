# ImagePalace アーキテクチャ設計書

> 最終更新: 2026-04-04

---

## 全体像

ImagePalace は、Next.js フロントエンドと Rails API バックエンドを分離したモノレポ構成で開発している。
カード作成時の画像生成は非同期ジョブで実行し、生成完了はフロントエンドのポーリングで反映する。

---

## 現在のリポジトリ構成

```text
image-palace/
├── frontend/              # Next.js 16 App Router
├── backend/               # Rails 8 API
├── docs/                  # 設計・運用・意思決定ログ
├── docker-compose.yml     # ローカル開発環境
├── Makefile               # ローカル操作のショートカット
├── README.md
├── AGENTS.md
└── CLAUDE.md
```

### frontend

```text
frontend/
├── src/app/               # App Router
├── src/components/        # UI / feature コンポーネント
├── src/lib/api/           # API クライアント
├── src/stores/            # Zustand ストア
├── src/types/             # 型定義
├── next.config.ts
├── wrangler.jsonc
└── package.json
```

### backend

```text
backend/
├── app/controllers/api/v1/
├── app/jobs/
├── app/models/
├── app/services/
├── config/routes.rb
├── db/
├── test/                  # Minitest
├── Dockerfile
├── fly.toml
└── Gemfile
```

---

## 技術構成

### フロントエンド

| 項目 | 採用技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| UI | Tailwind CSS + Base UI / 一部 shadcn |
| 状態管理 | Zustand |
| API クライアント | Axios |
| 配信先 | Cloudflare Workers (OpenNext) |
| 検証 | ESLint / `tsc --noEmit` |

補足:

- 開発サーバは `next dev --webpack` を使用する
- 一覧・詳細・再生成の状態同期は Zustand を source of truth とする
- フロントエンド自動テストは未整備。MVP 時点では型チェックと手動検証を中心に運用する

### バックエンド

| 項目 | 採用技術 |
|---|---|
| フレームワーク | Ruby on Rails 8.1 API mode |
| 言語 | Ruby 3.3 |
| DB | PostgreSQL |
| 非同期処理 | ActiveJob + Solid Queue |
| 認証 | Devise + devise_token_auth + Google OAuth |
| ストレージ | Active Storage + Cloudflare R2 |
| 画像生成 | OpenAI Images API |
| テスト | Minitest |

補足:

- ローカルでは Active Storage の `local` service を使う
- 本番では R2 + CDN 配信を前提とする
- 生成系の回帰は `test/integration` `test/services` `test/jobs` でカバーする

---

## ローカル開発構成

`docker-compose.yml` で以下を起動する。

| サービス | 役割 | ポート |
|---|---|---|
| `frontend` | Next.js 開発サーバ | `3000` |
| `web` | Rails API | `3001` |
| `db` | PostgreSQL | `5432` |

主要な環境変数:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`
- `INTERNAL_API_BASE_URL=http://web:3001`
- `FRONTEND_URL`
- `OPENAI_API_KEY`
- `R2_*`
- `CDN_BASE_URL`

---

## 認証構成

認証は `devise_token_auth` をベースにしている。

- メールアドレス + パスワードのサインアップ / ログイン
- Google OAuth ログイン
- フロントエンドでは取得した認証ヘッダを保持して API リクエストへ付与

Google OAuth 成功時は backend でトークンを発行し、`/auth/callback` へリダイレクトする。

補足:

- `devise_token_auth` の route helper は Rails 8.1 で deprecation warning が出る
- 方針は `docs/decisions/auth-routing-deprecation.md` に記録済み
- 現時点では monkey patch を入れず、Rails 8.1 系を維持する

---

## 画像生成フロー

1. フロントエンドが `POST /api/v1/items` を呼ぶ
2. backend が `items` を `pending` で作成する
3. `GenerateImageJob` を enqueue する
4. job が `NormalizePromptService` で prompt を正規化する
5. `SharedMedia` にキャッシュがあれば再利用、なければ OpenAI へ生成を依頼する
6. 生成画像を Active Storage に添付し、`completed` に更新する
7. フロントエンドが `index/show` をポーリングし、生成結果を反映する

### 生成ステータス

- `pending`
- `processing`
- `completed`
- `failed`

### 失敗時の扱い

- OpenAI 400 など入力起因の失敗は、ユーザー向けの失敗理由を保存する
- 通信系失敗は再試行メッセージを保存する
- 失敗カードは詳細画面から再生成できる

---

## キャッシュと表示戦略

### バックエンド

- `SharedMedia` で正規化済み prompt ごとに画像を再利用する
- `item.primary_media` を使ってカードの代表画像を返す
- 一覧 API では `thumb_url` を返す
- 壊れた `completed` カードは `failed` へ修復し、再生成を促す

### フロントエンド

- `useItemsStore` を一覧と詳細の単一の状態源とする
- 一覧は store を即時描画し、裏で再取得する
- 詳細は cache があれば即描画し、必要時だけ再検証する
- `pending/processing` が残っている間だけ逐次ポーリングを継続する

---

## API の考え方

主要エンドポイント:

- `POST /api/v1/auth`
- `POST /api/v1/auth/sign_in`
- `GET /api/v1/items`
- `GET /api/v1/items/summary`
- `POST /api/v1/items`
- `GET /api/v1/items/:id`
- `DELETE /api/v1/items/:id`
- `POST /api/v1/items/:id/retry`

設計方針:

- コントローラは薄く保ち、ビジネスロジックは `services/` へ寄せる
- 一覧表示に必要な最小フィールドを返す
- 失敗理由や生成ステータスは UI が扱いやすい形で返す

---

## デプロイ構成

| レイヤー | サービス | 備考 |
|---|---|---|
| フロントエンド | Cloudflare Workers | OpenNext 経由 |
| バックエンド | Fly.io | Rails + Solid Queue |
| DB | Neon PostgreSQL | staging / production を分離 |
| 画像ストレージ | Cloudflare R2 | CDN 配信前提 |
| AI 画像生成 | OpenAI | キャッシュでコスト抑制 |

---

## テスト方針

MVP 時点では、backend の主要フローから先に固める。

### backend

- request test: `items create/show/index/summary/retry`
- service test: `Items::CreateService`
- job test: `GenerateImageJob`

### frontend

- まずは型チェックと手動動作確認を優先する
- 自動テストは MVP 後に UI の変化が落ち着いてから導入する

---

## 更新ルール

このドキュメントは「今どうなっているか」を記述する。
将来構想や未着手案は、必要に応じて `docs/decisions/` や `README.md` に分離する。

更新が必要なタイミング:

- ディレクトリ構成が変わったとき
- デプロイ先やストレージが変わったとき
- 認証方式や画像生成フローが変わったとき
- テスト方針の基準を変えたとき
