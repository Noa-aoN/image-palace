# 認証の回帰防止チェックリスト

> 認証まわりを変更するときは、このチェックを満たさない差分を入れない。
> まず backend の自動テストで固定し、外部依存を含むフローは手動確認で補完する。

## 自動テストで固定する項目

### メール新規登録

- [ ] `confirm_success_url` なしでも登録できる
- [ ] 200 系で返る
- [ ] `access-token` / `client` / `uid` が返る
- [ ] response body に `email` / `provider` が入る
- [ ] 登録直後に保護 API へアクセスできる
- [ ] 同じメールアドレスでは重複登録できない
- [ ] `FRONTEND_URL` が不正なら適切に失敗する
- [ ] `password` と `password_confirmation` が不一致なら失敗する
- [ ] 不正なメール形式で失敗する
- [ ] 登録後に login API も通る

### メールログイン

- [ ] 正しい `email` / `password` でログインできる
- [ ] `access-token` / `client` / `uid` が返る
- [ ] 返却トークンで保護 API にアクセスできる
- [ ] 間違った `password` では失敗する
- [ ] 存在しない `email` では失敗する

### 共通観点

- [ ] status code が正しい
- [ ] auth headers が返る
- [ ] response body の `provider` / `email` / `uid` が正しい
- [ ] 既存ユーザーに副作用がない

## 手動確認に残す項目

### Google 新規登録 / Google ログイン

- [ ] OAuth 開始 URL に到達できる
- [ ] callback 後に frontend 側へ戻る
- [ ] local では `http://localhost:3000` に戻る
- [ ] production では `https://image-palace-frontend.image-palace.workers.dev` に戻る
- [ ] 認証後に `access-token` / `client` / `uid` が成立する
- [ ] `provider` が `google_oauth2` になる
- [ ] 既存 Google ユーザーの再ログインで二重作成されない
- [ ] OAuth 失敗時に適切なエラーまたは遷移になる
- [ ] frontend 側でトークン反映後にログイン済み状態になる
- [ ] 保護 API へアクセスできる

## 不正なメール形式の明文化

backend の signup バリデーションでは、少なくとも次の値で `Email is not an email` が返ることを確認済み。

- `plainaddress`
- `test@`
- `@example.com`
- `a@b`

frontend ではこれらをすべて `メールアドレスの形式が正しくありません` に統一表示する。
