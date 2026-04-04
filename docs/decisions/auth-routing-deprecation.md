# ADR: devise_token_auth ルーティング deprecation への対応方針

- **日付**: 2026-04-04
- **ステータス**: 承認済み
- **決定者**: 開発チーム

---

## コンテキスト

Rails test 実行時に、`mount_devise_token_auth_for` まわりで以下の deprecation warning が出る。

- `resource received a hash argument ... Please use a keyword instead.`

確認時点の組み合わせ:

- `Rails 8.1.2.1`
- `devise 4.9.4`
- `devise_token_auth 1.2.6`

warning は [backend/config/routes.rb](/Users/n/workspace/runteq_graduation/image-palace/backend/config/routes.rb) の
`mount_devise_token_auth_for 'User', at: 'auth', ...` 実行時に出る。

調査したところ、`devise_token_auth 1.2.6` の route helper は
`mount_devise_token_auth_for(resource, opts)` という古い引数形式で実装されており、
内部でも `devise_for` に hash をまとめて渡している。
Rails 8.1 では warning、Rails 8.2 ではさらに厳しくなる可能性がある。

また、確認時点で `devise_token_auth 1.2.6` の依存上限は `rails < 8.2` である。

---

## 決定

**現時点ではアプリ側で monkey patch や route DSL の独自置き換えは行わず、Rails 8.1 系を維持する。**

あわせて、**Rails 8.2 へ上げる前に `devise` / `devise_token_auth` の upstream 対応状況を再確認する。**

---

## 理由

- 現状は warning のみで、認証機能自体は正常動作している
- 原因はアプリ側の routes 記述より、gem 側の keyword 引数追従不足に近い
- ここで monkey patch を入れると、将来の gem 更新時に競合や二重修正になりやすい
- MVP 段階では auth route を自前再構築するコストに見合わない

---

## 却下した案

### A. 今すぐ monkey patch で warning を消す

- **却下理由**: gem 内部実装と将来の upstream 修正に強く依存し、保守コストが高い

### B. devise_token_auth をやめて認証 route を自前で引き直す

- **却下理由**: 対応範囲が広く、MVP の優先順位に対して重い

### C. すぐに Rails 8.2 へ上げてから対処する

- **却下理由**: 依存関係の未対応範囲へ先に入るため、リスクが高い

---

## 結果・影響

- 当面は warning を許容して開発を継続する
- CI / test ログではこの warning が出る前提で扱う
- Rails 本体または auth gem の更新時には、認証 route の互換性確認を必須チェック項目に入れる

---

## 見直しトリガー

- `devise_token_auth` が Rails 8.2 対応版をリリースしたとき
- `devise` 側で同系統 warning の修正が入ったとき
- Rails を 8.2 以上へ上げる計画が具体化したとき
