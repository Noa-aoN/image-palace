# 意思決定ログ: Git ワークフロー

> 作成: 2026-03-17
> 更新: 2026-04-05 (solo 開発向け運用へ整理)

---

## 決定内容

**`main` を正本とし、`develop` はローカル中心の作業ベースとして使う。**

### 原則
- `origin/main` を常に最新の正本とする
- ローカル `main` は作業前後で `origin/main` に追従させる
- ローカル `develop` は最新 `main` を取り込んだ作業ベースとして使う
- 小さな変更は `develop` に直接コミットしてよい
- 大きな変更は最新の `develop` から作業ブランチを切る
- PR の向き先は常に `main` とする
- `origin/develop` は通常更新しない。必要なときだけ push する

---

## ブランチ戦略

| ブランチ | 用途 |
|---------|------|
| `main` | 常にデプロイ可能な状態を保つ。直接 push 禁止 |
| `develop` | ローカル中心の作業ベース。小変更・ドキュメント更新はここに直接コミット |
| `feature/<issue>-<name>` | 機能開発。`develop` から派生し、完成後に `main` へ PR |
| `fix/<issue>-<name>` | バグ修正。`develop` から派生し、完成後に `main` へ PR |

### ブランチを分けるかどうかの判断基準

| ケース | 方針 |
|-------|------|
| ドキュメント・設定ファイルの変更 | `develop` に直接コミット |
| 小さなバグ修正（1〜3ファイル） | `develop` に直接コミット |
| 新機能・大きなリファクタリング | `feature/` または `fix/` ブランチを切る |
| 複数人が同時に作業する可能性がある変更 | 必ずブランチを切る |

### 日常の基本手順

1. `git fetch origin`
2. `git checkout main`
3. `git merge --ff-only origin/main`
4. `git checkout develop`
5. `git merge main`
6. 小変更ならそのまま `develop` で作業する
7. まとまった変更なら `git checkout -b feature/...` または `fix/...`
8. PR は `main` に向けて作成する

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
- **却下理由**: 小さな変更もすべて作業ブランチ化され、solo 開発ではオーバーヘッドが大きい

### 案B: Git Flow（main + develop + release）

- **内容**: `release` ブランチを挟んだ重厚なフロー
- **却下理由**: チーム規模に対して複雑すぎる。MVP 段階では不要

---

## 採用理由

- `develop` への直接コミットで小変更のオーバーヘッドを最小化
- `feature/` / `fix/` ブランチを必要なときだけ切ることで、変更単位を分けやすい
- `main` を唯一の正本にすることで、PR とデプロイの判断が単純になる
- `origin/develop` を毎回同期しないため、solo 開発での運用負荷が低い

---

## 今後の見直しトリガー

- チームメンバーが増えて同時並行の機能開発が増えた場合
- `develop` への直接コミットで変更の混線が増えた場合
- `origin/develop` を共有ブランチとして使う必要が出てきた場合
