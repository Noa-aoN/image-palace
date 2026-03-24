# Code Style — ImagePalace 固有ルール

## 共通

- インデント: スペース 2 つ（TypeScript / Ruby 共通）
- 文字コード: UTF-8
- 改行コード: LF（CRLF 禁止）
- ファイル末尾に必ず改行を 1 行入れる

## TypeScript / Next.js

- `interface` を優先。拡張が不要な純粋なデータ型は `type` を使う
- `any` 禁止。どうしても必要な場合は `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + 理由コメント
- `export default` は pages (`page.tsx`) と layouts (`layout.tsx`) のみ。それ以外は named export
- `const` を優先。`let` は再代入が必須の場合のみ。`var` 禁止
- 早期リターンを使ってネストを減らす
- 関数は 50 行以内。超えたらヘルパーに切り出す

### ディレクトリ規約（frontend）

```
app/              # pages, layouts, route handlers のみ
components/ui/    # shadcn/ui ベースの基本 UI コンポーネント
components/features/  # ドメイン固有コンポーネント
hooks/            # カスタム hooks
lib/api/          # API クライアント（fetch をここに集約）
stores/           # Zustand ストア
types/            # 型定義（packages/types に移行前の一時置き場）
```

### インポート順序

1. 外部ライブラリ（`react`, `next`, etc.）
2. 内部モジュール（`@/components`, `@/lib`, etc.）
3. 相対パス（`./`, `../`）

- `@/` エイリアスを使う。`../../../` のような深い相対パス禁止

## Ruby / Rails

- RuboCop の設定に従う（CI で強制）
- ビジネスロジックは `app/services/` に切り出す。コントローラーは薄く
- N+1 クエリ禁止。`includes` / `preload` / `eager_load` で解決
- マイグレーションで `change` が使えない場合は `up` / `down` を明示
- 命名: `snake_case` 統一

## 命名規則

| 種別 | TypeScript | Ruby/Rails |
|-----|-----------|-----------|
| 変数・関数 | `camelCase` | `snake_case` |
| クラス・型 | `PascalCase` | `PascalCase` |
| 定数 | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| ファイル（TS） | `kebab-case.ts` | — |
| ファイル（Ruby） | — | `snake_case.rb` |
| bool 変数 | `isXxx`, `hasXxx`, `shouldXxx` | `xxx?` メソッド |
| 関数・メソッド | `getUserById`, `validateInput` | `get_user_by_id`, `validate_input` |

## コミットメッセージ規則（Conventional Commits）

形式: `<type>: <概要>（日本語OK）`

type 一覧:
- feat:     新機能
- fix:      バグ修正
- docs:     ドキュメントのみの変更
- style:    コードの意味に影響しない変更（フォーマット等）
- refactor: バグ修正・機能追加を含まないコード変更
- test:     テストの追加・修正
- chore:    ビルド・補助ツールの変更（依存関係更新等）
- ci:       CI/CD 設定の変更

例:
- feat: 画像カード生成機能を追加
- fix: 同一単語のキャッシュが効かない問題を修正
- docs: アーキテクチャ設計書を更新
- chore: Claude Code設定とプロジェクト指示書を追加

PR タイトルも同じ形式で書く。

---

## PR の description 規約

### 構成（必須）

```
## 概要
1〜2行で何をしたかを端的に書く

## 変更内容
### ファイル名 or 機能名
- 変更点を箇条書き（動詞で終わらせる）

## 動作確認
実行したコマンドと確認内容をコードブロックで記載
```

### ルール

- 概要は「〜を構築した」「〜を実装した」で終わらせる
- 箇条書きは体言止めにせず動詞で終わらせる
- コマンドはコードブロックで囲む
- ファイル名はバッククォートで囲む（例：`Dockerfile`）
- 長い説明は箇条書きに分解する
