# 意思決定ログ: ストレージ・CDN 戦略

> 作成日: 2026-04-20（git 履歴から再構成）

---

## 背景・課題

AI生成画像（DALL-E 3）をどこに保存し、どのように配信するかを決定する必要があった。
要件：

- 転送コストを抑えたい
- CDN キャッシュで配信を高速化したい
- S3 互換 API で ActiveStorage との統合を簡潔に保ちたい
- フロントエンドを Cloudflare Workers にホストする計画があったため、同エコシステムで統一できると望ましい

---

## 検討した選択肢

### A: AWS S3 + CloudFront

- S3 は業界標準で実績あり
- CloudFront の転送コストが高い（アジア向けは特に）
- AWS IAM 管理が別途必要

### B: Cloudflare R2 + Cloudflare CDN（採用）

- S3 互換 API のため ActiveStorage の設定変更が最小
- **egress（転送）コスト完全無料**（R2 の最大の特長）
- Cloudflare CDN は Workers・Pages と同エコシステム
- Cloudflare R2 の無料枠は 10GB ストレージ / 月100万リクエスト（MVP 規模では十分）

---

## 決定: Cloudflare R2 + Cloudflare CDN

採用理由：転送コスト 0 円と Cloudflare エコシステムの統一が決定的。

---

## 実装上の制約

- **R2 直配信禁止**。必ず `CDN_BASE_URL` 環境変数（Cloudflare CDN URL）経由で配信
- `CDN_BASE_URL` を抽象化することで、将来的に CloudFront 等へ切り替えてもコード変更不要
- ActiveStorage の `service :cloudflare_r2` を `storage.yml` に定義
- `upload_options` キー名（`uploadに修正`）は Rails 8 と R2 SDK の互換性問題があったため要注意

---

## 関連コミット

- `feat: ActiveStorageのストレージをCloudflare R2に切り替える` (#62)
- `feat: CDN_BASE_URLによるメディアURL抽象化を実装する` (#63)
- `feat: shared_mediaキャッシュを実装する` (#63)
