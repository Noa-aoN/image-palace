# ImagePalace

## プロジェクト概要

イメージ特化型学習支援サービス。単語・概念をAI生成画像に変換し、
視覚的に記憶しやすいカード形式で管理・想起するWebアプリ。

将来的には「Image-first, Object-based, Graph Memory OS」へ拡張する設計。
MVPでは「イメージで記憶設計する学習アプリ」として振る舞う。

## 参照ファイル

- プロジェクト全体の概要: @README.md
- ディレクトリ構成・各層の責務・データフロー: @docs/architecture.md
- 機能仕様・用語集・MVP機能一覧: @docs/spec.md
- コミットルール・コーディング規約: @.claude/rules/code-style.md
- テスト方針: @.claude/rules/testing.md
- セキュリティルール: @.claude/rules/security.md

## Why This Architecture

- **モノレポ**: frontend / backend / 将来のmobileを横断して型・コンポーネントを共有するため
- **Next.js App Router**: SSR + RSC でSEO対応しつつ画像表示を高速化
- **Rails API mode**: チームが Ruby に慣れているため。ActiveJob で画像生成を非同期化
- **PostgreSQL on Neon**: サーバーレスDBでコスト最小化。Renderとの相性が良い
- **OpenAI Images API**: 画像生成の品質と手軽さのバランスが最良
- **Render or Railway（MVP）→ Cloud Run（スケール後）**: Dockerfile さえあれば移行コスト数時間。月額 $100 超 or 月間リクエスト急増をトリガーに Cloud Run へ移行する
- **CloudFront / Cloudflare Images**: 画像が核心サービスのため CDN・リサイズ・最適化は必須。S3 直配信はしない

## Do NOT Touch

- `docs/OS.md` — コアアーキテクチャ設計書。構造変更は必ず議論してから
- `docs/design/` — Figma が正本。PDF は参照用のみ、直接編集禁止
- `docs/decisions/` — 意思決定ログ。削除・上書き禁止。追記のみ

## Deploy & Environments

- local: `docker compose up`
- staging: Render（backend）+ Cloudflare Pages（frontend）への**自動デプロイ**（GitHub Actions が develop → staging を自動で行う）
- production: staging 確認後に**手動プロモート**（自動デプロイしない）
- DB migrations: staging で先に実行 → 動作確認 → production 適用の順を守る

## Team Workflow

- コードコメント・コミットメッセージは日本語 OK
- PR は必ず `/review-pr` skill を通す
- テストなしのコードはマージしない
- feat/ ブランチは squash merge で main へ
- コミットメッセージは Conventional Commits 形式（詳細は .claude/rules/code-style.md）
- PR タイトルも同じ形式

## Business Context

- 同一単語の画像は生成結果をキャッシュしてAPIコスト削減（同じ単語を2回生成しない）
- 画像生成は非同期（ActiveJob + Redis）。UIはポーリングまたはWebSocketで更新
- MVP は無料枠あり（生成枚数に上限）。将来はサブスク課金
- OpenAI API キーはバックエンドのみに置く。フロントエンドから直接呼び出し禁止
