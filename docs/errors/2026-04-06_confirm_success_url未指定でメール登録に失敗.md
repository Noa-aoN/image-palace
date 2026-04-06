# `confirm_success_url` 未指定でメール登録に失敗した

- 状態: 修正済み
- 初回記録日: 2026-04-06
- 対象範囲: 認証

## 概要

- メール新規登録で `confirm_success_url` が未指定だと登録処理が失敗していた。
- フロント側の送信漏れと、バックエンド側のフォールバック不足が重なって発生した。

## 症状

- メールアドレスとパスワードが正しく見えていても、メール新規登録に失敗した。
- UI に `Missing 'confirm_success_url' parameter.` が表示された。

## 発生条件

- フロントエンドの signup フォームからメール登録を実行した。
- signup リクエストに `confirm_success_url` が含まれていなかった。

## 原因

- `devise_token_auth` の登録フローでは `confirm_success_url` が必要だった。
- フロントエンドの signup API がそのパラメータを送っていなかった。
- バックエンド側も常にその値が来る前提だったため、安全なデフォルト値にフォールバックせず失敗していた。

## 修正内容

- フロントエンドの signup リクエストに `confirm_success_url` を追加した。
- バックエンドの registrations controller を差し替え、未指定時は `FRONTEND_URL` からデフォルト値を補完するようにした。
- 登録直後もトークン認証を継続できるよう、メール signup のフローを調整した。

## 影響範囲

- メール新規登録が失敗した。
- Google OAuth の signup / login には直接影響しなかった。
- 既存ユーザーのメールログインが直接の原因ではないが、同じ認証領域の不具合として回帰チェック対象を広げた。

## 学び

- 認証ライブラリ必須パラメータは、フロント送信だけに依存せずバックエンドでも防御するべき。
- signup は「登録できるか」だけでなく、「トークンが返るか」「そのまま保護 API にアクセスできるか」まで固定しないと弱い。

## 再発防止

- `confirm_success_url` なしの signup を backend integration test に追加した。
- signup / login 後の auth headers と protected API アクセス確認を追加した。
- playbook に認証回帰防止チェックリストを追加した。

## 関連テスト

- `backend/test/integration/auth_flow_test.rb`
- `docs/playbook/auth-regression-checklist.md`

## 関連変更

- Commit: `b61002c`
- Docs: `docs/playbook/auth-regression-checklist.md`
