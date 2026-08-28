# ImagePalace アーキテクチャ設計書

> 最終更新: 2026-08-17（技術構成・デプロイ構成を実装の実態に合わせて全面点検）
>
> 本番の「いまの姿」（マシン構成・鍵の有無・稼働中/休眠の機能）は `docs/production-snapshot.md` が正本。
> このファイルは構成の意図と設計の全体像を扱う。数字や台数を二重に書かない。

---

## 全体構成図（モノレポ）

```
image-palace/
├── frontend/      # Next.js 16 + TypeScript
├── backend/       # Rails 8 API mode
├── docs/          # アーキテクチャ設計書・意思決定ログ
└── scripts/       # スクリプト等
```

---

## frontend/

### 技術構成

| 項目 | 採用技術 |
|-----|---------|
| フレームワーク | Next.js 16 (App Router) |
| ランタイム | React 19 |
| 言語 | TypeScript 5 |
| スタイリング | Tailwind CSS v4 |
| UI コンポーネント | shadcn/ui + Base UI (@base-ui/react) + lucide-react |
| 状態管理 | Zustand v5 |
| フォーム | 素の制御コンポーネント + 個別バリデーション（react-hook-form / zod は使っていない） |
| HTTP クライアント | axios（自動トークン挿入・更新） |
| 3D・グラフ表現 | Three.js + React Three Fiber + drei / React Flow (@xyflow/react) |
| 配置・書き出し | dnd-kit（ドラッグ&ドロップ） / html-to-image（ボード画像化） |
| 認証（ブラウザ側） | @simplewebauthn/browser（Passkey） / uqr（TOTP の QR 生成） |
| エラーモニタリング | @sentry/nextjs |
| テスト | Vitest（jsdom）。純ロジック中心。Testing Library / MSW は未導入 |
| デプロイ | Cloudflare Workers（@opennextjs/cloudflare + wrangler） |

> フォームは共通ライブラリを入れていない。バリデーションはサーバー側を正とし、
> 画面側は入力補助に留める方針（`.claude/rules/security.md`）。
> ライブラリを足すときは、この表と `frontend/package.json` の両方を更新すること。

### ディレクトリ規約

```
frontend/
├── src/
│   ├── app/                  # App Router: pages, layouts
│   │   ├── (public)/         # 認証不要ページ（LP・規約・ブログ等）
│   │   ├── (auth)/           # 認証フロー（login, signup, auth/callback）
│   │   ├── (app)/            # 認証必要ページ（dashboard, items, library,
│   │   │                     #   spaces, boxes, atelier, billing, admin ほか）
│   │   └── api/              # Route Handlers（BFF 用の薄い口）
│   ├── components/
│   │   ├── ui/               # shadcn/ui ベースの汎用コンポーネント
│   │   └── features/         # ドメイン固有コンポーネント（auth, items, library,
│   │                         #   spaces, views, billing, admin, landing ほか）
│   ├── hooks/                # カスタム React Hooks
│   ├── lib/                  # API クライアント（api/）・ドメインロジック・
│   │                         #   security/csp.ts・analytics.ts 等
│   ├── stores/               # Zustand ストア
│   └── types/                # 型定義
└── test/                     # Vitest（純ロジックのテスト）
```

> ページ・機能ディレクトリは増え続けるため、ここでは代表例のみ挙げる。
> 網羅した一覧が要るときは `ls frontend/src/app/\(app\)` を見る（コードが正本）。

### ルール

- `export default` は pages と layouts のみ。それ以外は named export
- API 呼び出しは `lib/api/` に集約。コンポーネントから直接 fetch/axios しない
- Server Components をデフォルトとし、インタラクションが必要な場合のみ `"use client"` を付ける
- 入力の可否を決めるのはサーバー側。画面側のバリデーションは体験を良くするための先出しに留める
- 外部スクリプトを足すときは `lib/security/csp.ts` の allowlist を先に更新する（本番 CSP は許可制）

---

## backend/

### 技術構成

| 項目 | 採用技術 |
|-----|---------|
| 言語 | Ruby 3.3.10 |
| フレームワーク | Ruby on Rails 8.1 (API mode) |
| アプリサーバー | Puma 8 |
| DB | PostgreSQL (Neon) |
| ジョブキュー | Solid Queue（PostgreSQL ベース。Redis 不要） |
| 非同期処理 | Solid Queue（ActiveJob 経由）。本番は worker プロセスを分離 |
| ストレージ | Active Storage + Cloudflare R2（aws-sdk-s3） |
| 画像処理 | libvips（ruby-vips / image_processing）。WebP 変換・リサイズ |
| 認証 | Devise + devise_token_auth（トークン認証） |
| 追加の認証要素 | WebAuthn / Passkey（`webauthn` gem） + TOTP（自前実装 `Auth::Totp`） |
| ソーシャルログイン | omniauth-google-oauth2 / omniauth-apple |
| 課金 | Stripe（Checkout + Webhook） |
| AI 呼び出し | ruby-openai（画像 gpt-image-1 / 文章 GPT-4o 系 / Moderation）、fal.ai（FLUX・HTTP直） |
| エラーモニタリング | sentry-ruby + sentry-rails |
| テスト | RSpec + FactoryBot + shoulda-matchers + Faker |
| デプロイ | Fly.io（Docker。`app` と `worker` の2プロセス） |
| セキュリティ監査 | Brakeman + bundler-audit |
| レート制限 | Rack::Attack（認証・カード作成・アップロードのスロットル） |

> `kamal` gem は Rails 8 の新規生成時から Gemfile に残っているだけで、**使っていない**。
> デプロイは `backend/bin/deploy`（内部で `fly deploy`）。手順は `docs/production-snapshot.md`。

### ディレクトリ規約

```
backend/
├── app/
│   ├── controllers/api/v1/
│   │   ├── base_controller.rb           # 認証・共通エラーハンドリング
│   │   ├── items_controller.rb          # CRUD + retry
│   │   ├── auth/                        # 登録・OAuth コールバック
│   │   ├── billing/                     # プラン・決済・クレジット履歴
│   │   ├── admin/                       # 運営画面向け（Admin::BaseController で権限判定）
│   │   ├── reauth_controller.rb         # 危険操作前の再認証（Passkey / コード）
│   │   ├── webauthn_credentials_controller.rb  # Passkey 登録・管理
│   │   └── totp_controller.rb           # 二要素認証
│   ├── models/
│   │   ├── user.rb                      # Devise + devise_token_auth + OAuth
│   │   ├── item.rb                      # generation_status + metadata（エラー情報）
│   │   ├── media.rb                     # Active Storage + position
│   │   ├── shared_media.rb              # normalized_prompt キャッシュ（UNIQUE）
│   │   ├── shared_brief.rb              # 単語ごとの説明文キャッシュ（2段階生成）
│   │   ├── ai_model.rb                  # AI モデル登録簿（運営が画面から差し替え可能）
│   │   └── cost_parameter.rb            # 原価の単価（行が無ければコード側の既定）
│   ├── services/
│   │   ├── generate_image_service.rb    # 画像生成プロバイダー抽象化（PROVIDERS）
│   │   ├── normalize_prompt_service.rb  # キャッシュキー正規化
│   │   ├── image_generators/            # base / openai(gpt-image-1) / flux(fal.ai)
│   │   ├── ai/chat.rb                   # 文章生成の唯一の入口（記録・上限・課金を一括）
│   │   ├── moderation/                  # プロンプト検閲（ローカル + OpenAI Moderation）
│   │   ├── billing/                     # プラン・クレジット・Stripe
│   │   ├── auth/                        # TOTP・強い本人確認
│   │   └── items/create_service.rb      # 作成時のクレジット確認
│   ├── jobs/
│   │   └── generate_image_job.rb        # Solid Queue + リトライ戦略
│   └── controllers/concerns/            # JSON 整形（item_serialization.rb 等）・ページング
├── bin/
│   └── deploy                           # 本番デプロイ（worker の停止残りを防ぐ）
├── config/
│   └── routes.rb
├── db/
│   ├── migrate/                         # マイグレーション（既存ファイルは編集禁止）
│   └── schema.rb
└── spec/                                # RSpec（models / requests / services / jobs / security）
```

### API エンドポイント

エンドポイントは 100 本を超えており、**全量は `bundle exec rails routes` が正本**。
ここには「どの群があるか」だけ置く（一覧をここに写すと必ず腐る）。

```
GET  /up                                # Fly のヘルスチェック
GET  /api/v1/health                     # ヘルスチェック（認証不要）
GET  /api/v1/health/authenticated       # 認証確認用

/api/v1/auth/*                          # devise_token_auth（登録・ログイン・OAuth）
/api/v1/passkeys/*  /api/v1/totp/*      # Passkey・二要素認証の登録と管理
/api/v1/reauth/*                        # 危険操作前の再認証

/api/v1/items/*                         # カード CRUD・再生成・意味・関連・生成履歴
/api/v1/tags /api/v1/tag_groups         # タグとそのグループ
/api/v1/boxes /api/v1/wordlists         # まとめる単位
/api/v1/spaces/*  /api/v1/views/*       # 空間・ビュー（deck / freeboard / space_map）
/api/v1/search  /api/v1/words/*         # 検索・単語生成・重複チェック

/api/v1/billing/*                       # プラン・決済・クレジット履歴
POST /api/v1/stripe/webhook             # Stripe Webhook（認証不要・署名検証）

/api/v1/account/*                       # プロフィール・アバター・エクスポート・退会
/api/v1/notifications/*                 # お知らせ
/api/v1/admin/*                         # 運営（統計・利用者・監査ログ・配信・レバー）
```

### ルール

- ビジネスロジックは `services/` に切り出す（コントローラーは薄く保つ）
- JSON の整形は `controllers/concerns/` に寄せる（コントローラー内で組み立てを散らさない）
- N+1 クエリ禁止。`includes` / `preload` / `eager_load` で解決。
  往復の本数そのものが遅さの主因なので、必要なら本数を見張る spec を書く（`docs/performance-tips.md`）
- 全エンドポイントで認可を確認する（`current_user.items.find(id)` の形で他人の資源に触れない）
- RuboCop を CI で実行。警告は PR マージ前に解消すること

---

## docs/

```
docs/
├── architecture.md         # このファイル（構成の意図・設計の全体像）
├── production-snapshot.md  # 本番の「いまの姿」の正本（マシン・鍵・稼働/休眠）
├── spec.md                 # 機能仕様書
├── OS.md                   # コアアーキテクチャ設計書（Do NOT Touch）
├── auth-policy.md          # 認証方針 / webauthn-design.md  # Passkey 設計
├── billing-credits.md      # クレジット設計 / billing-credit-flow.md
├── billing/                # 課金の運用・テスト表・障害記録
├── performance-history.md  # 速度改善の経緯と計測（sin 移設など）
├── performance-tips.md     # 往復本数を増やさないための型
├── operations-cost-monitoring.md  # 原価と監視
├── decisions/              # 意思決定ログ（ADR）
├── incidents/              # 障害記録
├── daily/ drafts/ commits/ # 日誌・調査メモ・コミットメモ
└── design/                 # Figma が正本
```

> `docs/` は原則 git 管理外。`.gitignore` が `docs/*` + `!例外` 方式で
> **一部だけ追跡している**（auth-policy.md / billing-* / performance-* / webauthn-design.md）。
> 追跡対象を触ったときは `git add -A backend frontend` では漏れるので `git status` で確認する。

### ルール

- `docs/OS.md`: 構造変更は必ずチームで議論してから
- `docs/design/`: Figma が正本。PDF は直接編集禁止
- `docs/decisions/`: 削除・上書き禁止。追記のみ
- 本番の台数・鍵の有無・稼働状況は `production-snapshot.md` に書き、このファイルに写さない

---

## 画像生成フロー（非同期）

```
[Frontend]                    [Backend]                      [外部サービス]
  |                              |                                |
  | POST /api/v1/items           |                                |
  |  { word: "photosynthesis" }  |                                |
  |----------------------------->|                                |
  |                              | モデレーション                   |
  |                              | クレジットを引く                 |
  |                              | Item を pending で作る           |
  |                              | GenerateImageJob をエンキュー    |
  | 202 Accepted                 |----> PostgreSQL (Solid Queue)  |
  |<-----------------------------|                                |
  |  { status: "pending",        |      [GenerateImageJob]        |
  |    item_id: "uuid" }         |       | pending→processing     |
  |                              |       | プロンプトを正規化して鍵を作る |
  |                              |       | アドバイザリロック          |
  |  ポーリング（定期 GET）        |       | shared_media を引く        |
  |  GET /api/v1/items/:id       |       |  HIT → 既存の絵を付ける     |
  |----------------------------->|       |  MISS→ OpenAI Images API  |
  |                              |       |----------------------->|
  |                              |       |<-----------------------|
  |                              |       | R2 に保存              |
  |                              |       | processing→completed   |
  | 200 OK                       |<------|                        |
  | { status: "completed",       |                                |
  |   image_url: "cdn://..." }   |                                |
  |<-----------------------------|                                |
```

> **キャッシュを引くのはジョブの中**（コントローラではない）。
> 生成の直前に引かないと、待っているあいだに他の人が同じ絵を作り終えた場合を拾えない。
> クレジットは**ジョブを積む前**に引くので、キャッシュに当たったかどうかは課金に影響しない
> （当たるかどうかは利用者から事前に分からないため、同じ操作の値段を変えない）。

### リトライ戦略

失敗した場合、指数バックオフでリトライ（最大3回）:
- 1回目: 15秒後
- 2回目: 60秒後
- 3回目: 240秒後

全リトライ消費後に `failed` ステータスへ。ユーザーは `POST /api/v1/items/:id/retry` で手動再生成できる。

**無料は3回まで**（`Images::RetryPolicy::FREE_RETRY_LIMIT`）。4回目からは初回と同じだけクレジットを消費する
（作り直しは新しい画像を1枚作るので、原価が初回とまったく同じため）。

作り直しを**断る**場合もある。

- `content_policy` / `invalid_input` … 入力を変えないかぎり同じ結果になるので、そのままでは受け付けない
- `quota` かつプロバイダ障害が継続中 … 押しても失敗するだけなので受け付けない

入力が変われば無料回数はリセットする。

### キャッシュ戦略

- `shared_medias.normalized_prompt` に UNIQUE 制約。同じ単語は世界中で1回しか OpenAI API を呼ばない
- `shared_medias.metadata` に OpenAI の `revised_prompt` を保存
- 画像は「単語 → 説明文 → 情景」の2段階で作る。中間の説明文は `shared_briefs` に単語単位で
  溜め、こちらも使い回す（`IMAGE_BRIEF_ENABLED=false` で1段階に戻せる）
- Cloudflare R2 に保存した画像は Cloudflare CDN 経由で配信
- R2 直配信は禁止

> UNIQUE 制約は「1語1枚」を意味する。したがって**同じ単語で複数案を並べるギャラリーは
> 原理的に作れない**。仕様を考えるときはこの前提を先に確認する。

### 画像最適化（保存時）

- 生成画像は R2 へ保存する前に `OptimizeImageService`（libvips）で最適化する
- 長辺を 800px 以内にリサイズ（拡大はしない）し、WebP へ変換してストレージ・配信コストを削減
- 本体とは別にサムネイルと LQIP（表示前の低画質プレースホルダ）も同時に作る
- 変換に失敗した場合は元画像でフォールバックし、生成フローは止めない
- 画像処理は libvips（`ruby-vips` / `image_processing`）。Docker イメージに `libvips42` を同梱
- **libvips のローダは絞る**。使わないモジュール（heif / jxl / magick / openslide / poppler）は
  イメージから削除し、`VIPS_BLOCK_UNTRUSTED=1` と FFI の allowlist を併用する。
  片方だけでは PDF/HEIF を止められない（実測）。経緯は `docs/decisions/image-upload-security.md`

---

## 環境構成

| 環境 | Frontend | Backend | DB | ストレージ |
|-----|---------|---------|-----|--------|
| local | localhost:3000 | localhost:3001 | Docker PostgreSQL 16 | ローカルディスク or R2 |
| production | Cloudflare Workers | Fly.io | Neon (production) | Cloudflare R2 + CDN |

> **staging は無い。本番直**。DB マイグレーションは release_command で本番適用されるため、
> 戻せない変更（列の削除・型変更）は事前に手順を分けること（`docs/production-snapshot.md`）。
>
> ポート注意: フロントエンドが 3000、バックエンドが 3001（一般的な Rails の慣習と逆）

### 主要な環境変数

| 変数名 | 用途 |
|-------|------|
| `CDN_BASE_URL` | メディア URL の配信先（環境ごとに切り替え） |
| `FRONTEND_URL` | OAuth リダイレクト先 |
| `OPENAI_API_KEY` | OpenAI API キー（バックエンドのみ） |
| `IMAGE_GENERATION_PROVIDER` | 画像生成プロバイダーの上書き。未設定なら `ai_models` の既定行 → `openai` |
| `IMAGE_BRIEF_ENABLED` | 「単語→説明文→情景」の2段階生成。`false` で従来の1段階へ戻せる |
| `OPENAI_MODERATION_ENABLED` | プロンプト検閲。誤検知が出たら `false` でデプロイ無しに止められる |
| `PASSKEY_ENABLED` / `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` | Passkey。**RP ID は後から変えられない**（登録済みの鍵が全て無効になる） |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 課金。Webhook は署名検証必須 |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth クライアント ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth クライアントシークレット |
| `CORS_ORIGINS` | 許可オリジン（本番では `*` 禁止） |
| `SENTRY_DSN` | バックエンドのエラーモニタリング送信先（未設定なら無効） |
| `SENTRY_TRACES_SAMPLE_RATE` | バックエンドのトレースサンプリング率（既定 `0.1`） |
| `NEXT_PUBLIC_SENTRY_DSN` | フロントエンド（ブラウザ）のエラーモニタリング送信先 |
| `VIPS_BLOCK_UNTRUSTED` | libvips の信頼できないローダ（SVG/PDF 等）を無効化。本番・ローカルとも `1` 固定。外さないこと（`docs/decisions/image-upload-security.md`） |

> `SEED_TEST_USER` は開発専用。本番では指定しても `db/seeds.rb` がテストユーザーを作らない
> （既知の認証情報を本番に置かないため）。

---

## デプロイ構成

| レイヤー | サービス | 備考 |
|---|---|---|
| フロントエンド | Cloudflare Workers（OpenNext経由） | Cloudflare Pages ではない（2024年12月以降の公式推奨）。Workers Paid |
| バックエンド | Fly.io（`image-palace-api`、リージョン: **sin**） | `app`（Puma）と `worker`（Solid Queue）を別プロセスで動かす |
| DB | Neon（PostgreSQL・ap-southeast-1） | スキーマ変更なしで RDS 移行可能 |
| 画像ストレージ | Cloudflare R2 + Cloudflare CDN | S3互換・転送完全無料。R2 直配信は禁止し `cdn.imagepalace.app` 経由 |
| AI画像生成 | OpenAI gpt-image-1（既定） / fal.ai FLUX（切替可） | `normalized_prompt` キャッシュ（`shared_medias`）で重複排除 |
| AI文章生成 | OpenAI GPT-4o / GPT-4o-mini | 呼び出しは `Ai::Chat` を通し、`ai_usages` に記録する |
| ドメイン | `imagepalace.app`（apex=フロント / `api.` / `cdn.`） | OAuth のコールバックは `/omniauth` 配下 |

### なぜ `sin` なのか

Neon に東京リージョンが無く、DB は ap-southeast-1（シンガポール）にある。
東京（nrt）から引くと片道 70ms かかり、往復の本数がそのまま待ち時間になっていた。
**DB を動かす代わりに、アプリを DB の隣へ寄せた**（実測: DB往復 70.2ms → 2.4ms）。
経緯と計測は `docs/performance-history.md`。Neon が東京を出したら `primary_region` を戻せる。

---

## 将来の拡張ポイント

実装済みになったもの（当初この節に「将来」として置いていた項目）:

- **意味・説明の自動生成**: `Ai::Chat` 経由で実装済み。利用は `ai_usages` に記録される
- **課金機能**: Stripe で実装済み（クレジット制。1クレジット = 1枚）
- **画像生成プロバイダー切り替え**: `PROVIDERS` + `ai_models` で実装済み（OpenAI / fal.ai）
- **空間配置**: `spaces` / `views`（deck / freeboard / space_map）で実装済み

これから:

1. **Graph Memory OS**: `docs/OS.md` に設計。`relations` テーブルは実装済み（アイテム間リンク）
2. **Mobile アプリ**: React Native または Flutter を追加
3. **マルチモーダル**: 音声・動画メモリカードへの拡張
4. **ライブラリ階層の統合**: デッキを `view_type='deck'` へ寄せる移行（Phase B）

---

## このドキュメントの更新ルール

### 更新が必要なタイミング

- ディレクトリ構成や技術スタックに変更があった場合
- 新しいサービス・パッケージを追加した場合
- 画像生成フローなどのコアフローを変更した場合
- 環境構成（ホスティング先・DB・CDN）が変わった場合

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
