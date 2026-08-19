<p align="center">
  <img src="frontend/src/app/opengraph-image.jpg" alt="ImagePalace" width="760">
</p>

<p align="center">
  <a href="https://imagepalace.app"><img src="https://img.shields.io/badge/%E3%82%A2%E3%83%97%E3%83%AA%E3%82%92%E9%96%8B%E3%81%8F-imagepalace.app-c8a44a?style=for-the-badge" alt="アプリを開く"></a>
</p>

# ImagePalace

**言葉をイメージに変えて、記憶の宮殿をつくる。**

言葉を AI がイメージ画像に変換し、カードとして集めて活用できる学習サービスです。
テキストでは覚えにくい知識を、必要な瞬間に思い出せる形に変えます。

| | |
|---|---|
| URL（α版） | **https://imagepalace.app** |
| お試しコード | **`98C6QBS6`**（30 クレジット＝画像29枚分・先着15名・2026年9月末まで） |
| 稼働状況 | 本番稼働中（Fly.io + Cloudflare Workers） |

> **決済は本番モードなので、注意してください。**
> 動作確認に必要なクレジットは、無料付与と上のお試しコードで足ります（約1クレジットで画像1枚）。
> 登録後にコードを入力いただけたら、少しクレジットが追加されます。

---

## アプリ概要

テキスト中心の学習が合わない人（ビジュアルシンカー）に向けて作りました。
画像を作って終わりにせず、**作ったイメージを学習資産として蓄積し、組み替えて使えます。**

- 言葉や概念から、イメージ付きのカードを作る
- 意味・説明などの情報も自動生成し、Wikipedia の記述と突き合わせて補える
- カードは、まとまり・関係図・空間マップなど、目的に応じた構造で整理できる
- 同じカードを複数の構造に置ける。一度作った知識を、文脈ごとに組み替えて使える
- 眺めるだけでなく、クイズや反復練習で「思い出す」ところまで扱える

多くのノートアプリが記録・整理を中心とするのに対し、ImagePalace では
「思い出すためのイメージ」を体験の中心に置いています。

## 試し方

1. https://imagepalace.app で登録（Google ログインも可）
2. 市街 → デルフォイ → **「キャンペーンコードの受け取り」** から `98C6QBS6` を入力する（30 クレジット）
3. カード作成画面で覚えたい単語を入力する（改行・カンマ区切りでまとめて入力できます）
4. 生成は非同期です。数十秒で画像が届きます

> 既定の設定では、カードのプロパティも少量のクレジットを使って自動生成します。

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

> 実装済み・実装中のもの：Sign in with Apple、
> fal.ai（FLUX。画像生成の代替プロバイダー。既定は OpenAI）。

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

## 現在地と今後

ImagePalace は、もともと自分が使いたい学習ツールとして作り始めました。
ゆくゆく公開できたらいいな、くらいの気持ちでした。

当初はバトランへの応募も想定しておらず、「これも欲しい」「ここまでできたら面白い」と
自分向けの機能を足していった結果、カード生成から、カードを組み合わせる**キャンバス**、
空間を使う**スペース**、復習する**スタディまで**、典型的に機能を広げすぎました。

さらに、いざ公開しようとすると、画像生成 API は原価がかかる。認証もいる。課金もいる。
セキュリティや運用も考えないといけない——と、作る範囲はさらに広がりました。

そのぶん、UI/UX、初見の導線、説明、発展機能、コスト対策など、
まだ手が回っていないところもたくさんあります🙇
まずはやりたいことがちゃんと伝わって、主要な体験を気持ちよく使えるものに整える段階へ移りたいと思っています。

### いま：α版

主要機能の一部はある程度動き、課金を含めて本番環境で公開しています。

新しい機能を増やすより、いまある体験の磨き込みを優先します。

- キャンバス・スタディなど、主要機能を絞って作り込む
- UI/UX と全体のトンマナを磨く
- オンボーディング、空状態、ヘルプを整える
- サンプル・デモ・短い動画で、使い方と面白さを伝える
- 「作る → 整理する → 思い出す」の流れをつなぐ
- モバイル操作・体感速度・生成コストを改善する
- 実際に使ってもらい、迷った場所や欲しい機能を集める

### 次：β版 / 一般商用公開（10月上旬めど）

α版で得たフィードバックを反映し、<strong>人に安心して勧められ、継続して使えるサービス</strong>にすることが目標です。

- PC・スマートフォンで日常的に使える品質へ
- 生成・整理・復習まで一貫した学習体験へ
- 料金・クレジット・生成原価を持続可能な形へ
- 監視・障害対応・問い合わせなど、運用面を整備
- 実利用データやフィードバックをもとに、残す機能・捨てる機能を整理

### その先

最終的には、AI で画像を作るだけではなく、知識管理を総合的に AI に任せられ、
**自分の知識そのものを視覚的な世界として育て、活用や発信もできる場所にしたいと考えています。**

**主要機能の強化**

- カード同士の意味や関係を AI が理解し、知識をつなげる
- 意味検索から、忘れていたカードや関連知識へ辿れる
- 空間・位置・関係性そのものを記憶に使う
- 学習履歴から、忘れそうな知識を適切なタイミングで再提示する

**発展機能**

- 共有・販売系（作ったカード・キャンバス・空間を、人とのあいだで行き来させる）
- 活用・遊戯系（学習だけでなく、アイデア整理・創作・ゲーム的な使い方へ）

**土台**

- 画像生成モデルや BYOA を選べるようにし、品質とコストを自分で調整できる
- 多言語・モバイルへ広げ、日常の中で知識を集め続けられるようにする

カードが増えるほど、ただの一覧ではなく、
**自分が学んできたものが目に見える「記憶の宮殿」になっていく。**

まだかなり途中ですが、少しずつそこまで育てたいと思っています。

## AI の活用

開発では、設計検討・実装・調査・レビューの補助に生成 AI を活用しています。
提案や生成コードは内容を確認し、テストと CI を通したうえで採用しています。

このアプリでは、当時の状況も鑑み、**AI の活用そのものも積極的な練習の対象としました。**
当時公開されていた実践例やベストプラクティスを調べながら、
自分なりに skills・hooks などを組み立てて運用しています（git 管理化は予定）。

- **skills** — 機能実装・レビュー・テスト・デプロイなどの作業手順を再利用可能にする
- **hooks / rules** — セキュリティ・テスト・git 運用などのルールを開発フローに組み込む
- **CI** — 生成された変更も、テストと静的解析を通してからマージする

任せ方は、範囲を切って渡し、受け入れ基準は自分が持つという方針です。
何を作るか、どこまでを完成とするか、何を採用しないかは自分で判断し、
その経緯は PR や意思決定ログに残しています。

## 開発の始め方

手元で動かす手順と、変わりやすい情報の正本の在り処は
[docs/development.md](docs/development.md) にまとめています。

## ライセンス

**閲覧・評価目的で公開しています。利用許諾は行っていません（無断利用・再配布不可）。**

## 企画・背景

着手前〜MVP リリース時点に書いた README は [docs/concept.md](docs/concept.md) に残しています。

