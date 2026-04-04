# ImagePalace Agent Guide

このファイルは、Codex を含む AI エージェント向けの最小ブートガイドです。
詳細ルールは既存のドキュメントに集約し、このファイルでは「最初に何を見るか」だけを案内します。

## まず読む

1. `CLAUDE.md`
2. `docs/architecture.md`
3. `docs/spec.md`
4. `.claude/rules/code-style.md`
5. `.claude/rules/security.md`
6. `.claude/rules/testing.md`
7. `.claude/rules/git-workflow.md`

## プロジェクト概要

- ImagePalace は、単語・概念を AI 画像に変換し、記憶カードとして管理する学習支援アプリ
- モノレポ構成
  - `frontend/`: Next.js App Router
  - `backend/`: Rails API + Solid Queue
- ローカル開発は Docker Compose を前提にする

## ローカル開発の基本

- 全体起動: `docker compose up -d`
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- ローカル環境変数
  - `backend/.env`: シークレットあり、コミット禁止
  - `frontend/.env.development`: 非シークレット設定、コミット対象

詳細は `docs/playbook/development.md` を参照。

## 重要ルール

- コミットメッセージは日本語 OK、Conventional Commits 形式
- シークレットをコミットしない
- `docs/decisions/` は追記のみ。削除・上書きしない
- 仕様や構造を変える前に `docs/spec.md` と `docs/architecture.md` を確認する
- 既存の設計意図は `CLAUDE.md` を優先して読む

## 変更前提の実務ルール

- 小さな修正でも、影響するレイヤーの規約を読む
  - フロント: `frontend/AGENTS.md` も読む
  - バックエンド: `CLAUDE.md` と `docs/architecture.md` を読む
- API 変更時は `frontend/src/lib/api/` と Rails controller/service の両方を見る
- 画像生成まわりを触るときは `backend/app/jobs/generate_image_job.rb` と `backend/app/services/` を確認する
- 認証まわりを触るときは `frontend/src/stores/auth.ts` と `backend/config/initializers/devise*.rb` を確認する

## 動作確認の最低ライン

- Frontend 変更: `docker compose exec frontend npm run type-check`
- Backend 変更: Rails runner / 該当 endpoint / ジョブ実行を確認
- ローカル起動に影響する変更: `docker compose ps` とログ確認を行う

## 補足

- このファイルは索引です。詳細をここに重複記載しないこと
- ルール更新時は、まず原本 (`CLAUDE.md`, `.claude/rules/`, `docs/`) を更新し、このファイルのリンクだけ調整する
