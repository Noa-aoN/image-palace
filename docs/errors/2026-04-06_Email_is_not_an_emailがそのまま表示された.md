# signup で `Email is not an email` がそのまま表示された

- 状態: 修正済み
- 初回記録日: 2026-04-06
- 対象範囲: 認証

## 概要

- 不正メール形式の一部で、backend の英語文言 `Email is not an email` がそのまま UI に出ていた。
- 入力自体の失敗ではなく、エラーメッセージ吸収漏れによる UX と運用性の問題だった。

## 症状

- signup フォームで `Email is not an email` という英語文言がそのまま表示された。
- 他の日本語バリデーションメッセージとトーンが揃っていなかった。

## 発生条件

- signup で不正なメール形式を入力したときに発生した。
- 確認した入力例:
  - `plainaddress`
  - `test@`
  - `@example.com`
  - `a@b`

## 原因

- 一部の不正メール形式に対して、backend が `Email is not an email` を返していた。
- frontend のエラー変換テーブルは `Email is invalid` には対応していたが、`not an email` を吸収していなかった。

## 修正内容

- frontend にマッピングを追加し、`Email is not an email` を `メールアドレスの形式が正しくありません` と表示するようにした。
- 既存の signup / login バリデーションメッセージと文言トーンを揃えた。
- 生の英語文言が再び漏れないよう、frontend の unit test を追加した。

## 影響範囲

- signup 時のバリデーション表示が不統一だった。
- リクエスト自体が壊れる不具合ではないが、UX を下げ、切り分けもしづらくしていた。

## 学び

- backend 文言は 1 つ直して終わりにせず、同義のバリエーションまで一覧化して吸収するべき。
- 認証エラーは英語文言の漏れが起きやすいため、変換テーブルと unit test をセットで持つ方が安全。

## 再発防止

- auth error のマッピング表を拡張した。
- 未翻訳の backend 文言に対する unit test を追加した。
- 不正メール形式の具体例を認証回帰ドキュメントに残した。

## 関連テスト

- `frontend/test/auth-errors.test.mjs`
- `backend/test/integration/auth_flow_test.rb`

## 関連変更

- Commit: `b61002c`
- Commit: `212c8cd`
- Commit: `033f709`
- Docs: `docs/playbook/auth-regression-checklist.md`
