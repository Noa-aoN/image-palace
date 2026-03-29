# 意思決定ログ: Git ワークフロー

> 作成: 2026-03-17
> 更新: 2026-03-29 (ブランチ命名規則の統合)

---

## 決定内容

**develop → main の squash merge 方式を採用する。**

---

## ブランチ戦略

| ブランチ | 用途 |
|---------|------|
| `main` | 常にデプロイ可能な状態を保つ。直接 push 禁止 |
| `develop` | 日常的な小変更・ドキュメント更新はここに直接コミット |
| `feature/<issue>-<name>` | 機能開発。`develop` から派生し、完成後に PR → squash merge |
| `fix/<issue>-<name>` | バグ修正。`develop` から派生し、完成後に PR → squash merge |

### ブランチを分けるかどうかの判断基準

| ケース | 方針 |
|-------|------|
| ドキュメント・設定ファイルの変更 | `develop` に直接コミット |
| 小さなバグ修正（1〜3ファイル） | `develop` に直接コミット |
| 新機能・大きなリファクタリング | `feature/` または `fix/` ブランチを切る |
| 複数人が同時に作業する可能性がある変更 | 必ずブランチを切る |

---

## ブランチ命名規則 (Branch Naming Rules)

### 基本フォーマット
`<type>/<issue番号>-<内容>`

### type 一覧
- `feature`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `chore`: 雑務（設定、ライブラリ更新、ドキュメント修正など）

### 例
- `feature/10-nextjs-setup`
- `feature/19-auth-frontend`
- `fix/23-login-error`
- `refactor/30-api-structure`

### 命名時の注意点
- **`#` (シャープ) を含めない**: シェル環境やCIツール（GitHub Actions等）での誤認やエラーを防ぐため。
  - ❌ `feature/#14-deploy-backend`
  - ✅ `feature/14-deploy-backend`
- **`kebab-case` を使う**: 全て小文字、単語区切りはハイフン `-` を使用してください。
- **英語で簡潔に書く**: 内容を一目で判別できる程度の長さに留めます。

### 補足
- **プルリクエスト (PR) タイトル**: 必ず Issue 番号を含めてください。
  - 例: `[#10] Next.js setup`

---

## 却下した案と理由

### 案A: GitHub Flow（main ブランチのみ）

- **内容**: `main` から直接 `feature/` を切り、PR でマージ
- **却下理由**: 小さな変更のたびに PR を立てるのが手間。solo 開発の初期段階では過剰

### 案B: Git Flow（main + develop + release）

- **内容**: `release` ブランチを挟んだ重厚なフロー
- **却下理由**: チーム規模に対して複雑すぎる。MVP 段階では不要

---

## 採用理由

- `develop` への直接コミットで小変更のオーバーヘッドを最小化
- `feature/` ブランチ + squash merge で、`main` のコミット履歴をきれいに保つ
- staging 環境は `develop` push で自動デプロイ → production は手動プロモートで安全性確保

---

## 今後の見直しトリガー

- チームメンバーが増えて同時並行の機能開発が増えた場合
- `develop` への直接コミットでコンフリクトが頻発した場合
