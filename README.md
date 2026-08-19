<p align="center">
  <img src="frontend/src/app/opengraph-image.jpg" alt="ImagePalace" width="760">
</p>

# ImagePalace

**言葉をイメージに変えて、記憶の宮殿をつくる。**

単語や概念を AI 生成画像に変換し、視覚的に記憶して想起するための学習アプリ。
テキスト中心の学習が合わない人（ビジュアルシンカー）に向けて作りました。

| | |
|---|---|
| デモ | **https://imagepalace.app** |
| お試しコード | **`98C6QBS6`**（30 クレジット＝画像30枚ぶん・先着15名・2026年9月末まで） |
| 稼働状況 | 本番稼働中（Fly.io + Cloudflare Workers） |

> **決済は本番モードです。購入フローは試さないでください。**
> 動作確認に必要なクレジットは、上のお試しコードで足ります（1クレジットで画像1枚）。
>
> コードは先着15名・2026年9月末までです。上限に達した場合や、
> 都合により早く終了する場合があります。

---

## これは何か

覚えたい単語を入力すると、その意味に沿った画像が生成され、カードとして手元に残ります。
カードは棚に並べたり、盤面に配置したり、線でつないだりできます。

多くのノートアプリが記録・整理を中心とするのに対し、ImagePalace では
「思い出すためのイメージ」を体験の中心に置いています。

同一の正規化プロンプトでは画像を重複生成せず、生成済みの画像を共有して再利用します。
画像生成 API の重複コストを抑えるための設計です。

## 試し方

1. https://imagepalace.app で登録（Google ログインも可）
2. 市街 → デルフォイ → **「キャンペーンコードの受け取り」** から `98C6QBS6` を入力する（30 クレジット）
3. カード作成画面で覚えたい単語を入力する（改行・カンマ区切りでまとめて入力できます）
4. 生成は非同期です。数十秒で画像が届きます

## 技術構成

- 言語：
  - Ruby 3.3.10 / TypeScript 5 / JavaScript / SQL / HTML / CSS

- フレームワーク・UI：
  - Next.js 16（App Router） / React 19
  - Ruby on Rails 8.1（APIモード）
  - Tailwind CSS v4 / shadcn/ui

- DB・ストレージ：
  - PostgreSQL / Neon（マネージドPostgreSQL）
  - Cloudflare R2 / Active Storage

- インフラ・CI/CD：
  - Fly.io（バックエンド。app と worker の2プロセス構成）
  - Cloudflare Workers（フロントエンド。OpenNext経由） / Cloudflare CDN
  - Docker / GitHub Actions

- 外部API・サービス：
  - OpenAI API（画像生成 gpt-image-1 / 文章生成 GPT-4o / Moderation）
  - Stripe（課金） / Wikipedia API / Sentry / Google Analytics 4

- 認証・セキュリティ：
  - Devise + devise_token_auth（トークン認証）
  - Google OAuth 2.0 / Sign in with Apple
  - TOTP二要素認証 / WebAuthn・Passkey / Rack::Attack

- 主要ライブラリ・機能技術：
  - Zustand（状態管理）
  - Three.js・React Three Fiber（3D表現） / React Flow（ノードグラフ） / dnd-kit（空間配置）
  - Solid Queue（非同期ジョブ） / libvips（画像最適化）

- テスト・品質管理：
  - RSpec / Vitest / RuboCop / ESLint / Brakeman・bundler-audit

> 実装はあるが既定では動かないもの：Sign in with Apple、Google Analytics 4、
> fal.ai（FLUX。画像生成の代替プロバイダー。既定は OpenAI）。
> いずれも環境変数の設定で有効になる。

## 構成

```mermaid
flowchart LR
    U["利用者<br/>ブラウザ / PWA"]

    subgraph CF["Cloudflare"]
        FE["Workers<br/>Next.js 16 (OpenNext)"]
        CDN["CDN<br/>cdn.imagepalace.app"]
        R2[("R2<br/>画像の実体")]
    end

    subgraph FLY["Fly.io (sin)"]
        API["app<br/>Rails 8.1 API / Puma"]
        WK["worker<br/>Solid Queue"]
    end

    DB[("Neon<br/>PostgreSQL")]
    OAI["OpenAI<br/>画像 / 文章 / Moderation"]
    STR["Stripe<br/>決済"]

    U --> FE
    U --> CDN
    FE -->|"REST"| API
    API --> DB
    WK --> DB
    API -.->|"ジョブを積む"| DB
    DB -.->|"ジョブを取る"| WK
    WK --> OAI
    WK -->|"WebP に変換して保存"| R2
    CDN --> R2
    API <--> STR
```

キューを PostgreSQL に置いているため、Redis を持たずに非同期処理ができます（Solid Queue）。
生成は worker が担い、Web を止めません。アプリを DB と同じリージョンに置いているのは、
往復の本数がそのまま待ち時間になっていたためです（[performance-history](docs/performance-history.md)）。

## データモデル（中核）

76 テーブルのうち、学習体験の中心にあるものだけを抜き出しています。

```mermaid
erDiagram
    users ||--o{ items : "持つ"
    users ||--o{ tags : "作る"
    users ||--o{ views : "作る"
    users ||--o{ credit_transactions : "増減する"

    items ||--o{ medias : "絵を持つ"
    items ||--o{ meanings : "意味・説明"
    items ||--o{ item_tags : ""
    tags ||--o{ item_tags : ""
    item_types ||--o{ items : "種別"


    spaces ||--o{ views : "置き場"
    views ||--o{ view_items : "配置"
    items ||--o{ view_items : ""

    users {
        uuid id PK
        string email
        string role "user / support / operator / admin"
    }
    items {
        uuid id PK
        string title "見出し語"
        string generation_status "pending → processing → completed / failed"
        jsonb metadata "失敗の理由など"
    }
    shared_medias {
        uuid id PK
        string normalized_prompt UK "★ここが UNIQUE"
        jsonb metadata "revised_prompt"
    }
    shared_briefs {
        uuid id PK
        string normalized_source "見出し語を正規化した鍵"
        text description "単語の説明"
        text scene_prompt "情景の指示"
    }
    medias {
        uuid id PK
        integer position
        string media_type
    }
    views {
        uuid id PK
        string view_type "deck / freeboard / space_map"
        jsonb settings
    }
    view_items {
        uuid id PK
        integer position
        integer z_index
    }
    credit_transactions {
        uuid id PK
        integer delta "＋付与 / −消費"
        string kind
        boolean livemode "テスト決済と混ぜない"
    }
```

このアプリの要は `shared_medias.normalized_prompt` の UNIQUE 制約です。
同一の正規化プロンプトでは画像を重複生成せず、生成済みの画像を共有して再利用します。
画像生成 API の重複コストを抑えるための設計で、その代わりに
「同じ見出し語で複数の案を並べて選ぶ」ことはできません。

`shared_medias` と `shared_briefs` に外部キーはありません。
利用者のカードから伸びる線ではなく、正規化した文字列を鍵に引く共有の置き場だからです
（`shared_briefs` は「単語 → 説明文 → 情景」の2段階生成の中間物で、これも語ごとに再利用します）。
図で線を引かずに独立させているのは、そのためです。

## 設計で考えたこと

### 当初の想定から変えたこと

着手前の計画（[docs/concept.md](docs/concept.md)）から、実際に動かして変えた判断です。

| 項目 | 当初の想定 | 実際の採用 | 変更理由 |
|-----|----------|----------|--------|
| ジョブキュー | Redis | Solid Queue | Rails 8 標準で PostgreSQL をキューに使える。**運用対象を1つ減らせた** |
| バックエンドのホスト | Render | Fly.io | リージョンを選べるため。DB（Neon）の隣へ寄せて **DB往復 70.2ms → 2.4ms**（実測） |
| ストレージ | AWS S3 | Cloudflare R2 | S3互換のまま転送（egress）無料。画像配信が主用途なので差が大きい |

### 意思決定ログ（ADR）

判断の背景・検討した選択肢・トレードオフを、決めた時点で残しています。

| ドキュメント | 内容 |
|---|---|
| [infra-backend](docs/decisions/infra-backend.md) | バックエンドインフラ選定 |
| [frontend-deploy](docs/decisions/frontend-deploy.md) | フロントエンドのデプロイ先選定 |
| [image-storage](docs/decisions/image-storage.md) | ストレージ・CDN 戦略 |
| [image-upload-security](docs/decisions/image-upload-security.md) | 画像アップロードの多層防御（libvips の任意コード実行対策） |
| [image-retry-limits](docs/decisions/image-retry-limits.md) | 失敗した画像の作り直しに、種類と上限を置く |
| [oauth-design](docs/decisions/oauth-design.md) | OAuth 認証設計（単一テーブル vs 分離） |
| [credit-model](docs/decisions/credit-model.md) | クレジットモデル（期限付きグラント + Free→Paid 引き継ぎ） |
| [credit-period-design](docs/decisions/credit-period-design.md) | クレジットの周期・更新日 |
| [db-advisory-locks](docs/decisions/db-advisory-locks.md) | 本番マイグレーションのアドバイザリロック無効化 |
| [semantic-search](docs/decisions/semantic-search.md) | 意味検索（pgvector + OpenAI） |
| [space-mapping-design](docs/decisions/space-mapping-design.md) | 空間（ロード／ルーム）とビューの設計 |

構成の全体像は [docs/architecture.md](docs/architecture.md)、機能仕様は [docs/spec.md](docs/spec.md) にあります。

### 残っている課題

- 認証トークンを localStorage に保持しており、CSP に `'unsafe-inline'` が残っている
  （判断の経緯は `frontend/src/lib/security/csp.ts` に記載）
- Rack::Attack のカウンタがプロセスローカル。単一インスタンス構成では整合するが、
  スケールアウト時は差し替えが必要

## 開発の始め方

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

### この README に書かないもの

変わりやすい情報は、コードや自動生成できるものを正本にする。
README に写すと、必ず食い違う（実際に一度そうなった）。

| 知りたいこと | 見る場所 |
|---|---|
| API エンドポイントの一覧 | `bundle exec rails routes` |
| 依存パッケージとその版 | `backend/Gemfile.lock` / `frontend/package.json` |
| テーブル・カラム | `backend/db/schema.rb` |
| 原価の単価・付与量などの設定値 | 実装の定数（`CostParameter::DEFAULTS` 等）と運営画面 |

この README には、サービス概要・現在の主要技術・基本構成・開発の始め方と、
公開して差し支えない設計の考え方までを置く。
運用事情（本番の台数・鍵の状態・障害の記録）は含めない。


## AI の活用

開発では、設計検討・実装・調査・レビューの補助に生成 AI を活用しています。
提案や生成コードは内容を確認し、テストと CI を通したうえで採用しています。

活用にあたって整えた土台:

- コミット規約・テスト方針・セキュリティ規則を明文化し、作業のたびに参照する
- 本番と同じ production ターゲットのイメージで RuboCop と RSpec を回す CI（`.github/workflows/`）。
  `REQUIRE_VIPS=1` を置き、依存が欠けたときにテストが黙ってスキップされないようにしている
- 判断の背景は PR 本文と意思決定ログ（`docs/decisions/`）に残す

一部の過去コミットには `Co-Authored-By` が残っています。
設計判断や検討の経緯は、PR・コミット・ADR にも記録しています。

## ライセンス

**閲覧・評価目的で公開しています。利用許諾は行っていません（無断利用・再配布不可）。**

## 企画・背景

着手前に書いた企画書を [docs/concept.md](docs/concept.md) に残しています。
誰のどんな課題を、なぜこの形で解こうとしたのかを書いたものです。

