# ADR: フロントエンドデプロイ先選定

- **日付**: 2026-04-02
- **ステータス**: 承認済み
- **決定者**: チーム

---

## コンテキスト

Next.js 16（App Router）フロントエンドのホスティング先を決定する必要があった。
要件：

- Next.js App Router（Server Components / Server Actions）に対応
- CDN による画像配信の高速化
- バックエンドを Cloudflare R2 / Cloudflare CDN に統一しているため、同エコシステムが望ましい
- 初期コストを抑えたい

---

## 検討した選択肢

### A. Vercel

- **メリット**: Next.js の開発元。App Router との相性が最良。デプロイが最も簡単
- **デメリット**: 商用利用では有料プランが必須。帯域コストが高い。Cloudflare エコシステムと分離

### B. Cloudflare Pages

- **メリット**: 無料枠が大きい。Cloudflare エコシステムに統一できる
- **デメリット**: 2024年12月以降、Next.js のフルサポートは Workers 推奨に移行。Pages は静的サイト向け

### C. Cloudflare Workers（OpenNext 経由）（採用）

- **メリット**: Cloudflare のエッジで Next.js が動作。R2・CDN と同エコシステム。帯域コスト最安
- **デメリット**: OpenNext アダプターが必要。Vercel に比べると設定が複雑

---

## 決定

**Cloudflare Workers（OpenNext 経由）を採用**

---

## 理由

1. **コスト**: Cloudflare Workers は egress 無料。R2 と合わせてストレージ・配信コストを最小化
2. **エコシステム統一**: バックエンド（Fly.io）・ストレージ（R2）・CDN・フロントエンドをCloudflareに集約
3. **エッジ実行**: Server Components がエッジで動作し、日本ユーザーへのレイテンシが低い
4. **公式推奨**: 2024年12月以降、Cloudflare は Next.js を Pages ではなく Workers で動かすことを推奨

---

## 結果・影響

- `frontend/` に `wrangler.jsonc` と `open-next.config.ts` を追加
- `npm run deploy` で Cloudflare Workers へデプロイ
- ビルド成果物（`.open-next/`、`.wrangler/`）は `.gitignore` に追加
- 環境変数は Cloudflare Workers のダッシュボードで管理
- 関連コミット: `feat: Cloudflare Workersデプロイ設定を追加する` (#64)
