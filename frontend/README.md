# frontend — Next.js 16 (App Router)

ImagePalace の画面。API は backend が提供します。リポジトリ全体の README を先に読んでください
→ [../README.md](../README.md)

## 動かす

```bash
docker compose up      # リポジトリのルートで実行（frontend: 3000 / API: 3001）
```

このディレクトリで直接動かす場合:

```bash
npm run dev
npm run test         # Vitest（純ロジック中心）
npm run type-check   # tsc --noEmit
npm run lint
```

## この中の構成

| ディレクトリ | 役割 |
|---|---|
| `src/app/` | App Router。`(public)` / `(auth)` / `(app)` でグループ分け |
| `src/components/ui/` | shadcn/ui ベースの汎用コンポーネント |
| `src/components/features/` | ドメイン固有のコンポーネント |
| `src/lib/` | API クライアント・ドメインロジック・CSP 定義 |
| `src/stores/` | Zustand ストア |

Server Components を既定とし、操作が要るところだけ `"use client"` を付けます。
外部スクリプトを足すときは `src/lib/security/csp.ts` の allowlist を先に更新してください
（本番の CSP は許可制です）。

デプロイは Cloudflare Workers（OpenNext 経由）: `npm run deploy`
