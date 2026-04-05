# Git Workflow

## Branching

- `main` is always deployable
- Local `develop` is the working base branch for solo development
- Small changes may be committed directly to `develop`
- Feature branches: `feature/<issue-number>-<short-description>`
- Bug fixes: `fix/<issue-number>-<short-description>`
- Never push directly to `main`
- Open PRs against `main`
- `origin/develop` does not need to be updated on every change

例:
- `feature/17-devise-token-auth`
- `fix/42-cache-miss-on-normalized-word`

## Commits

- Follow Conventional Commits: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`
- Keep commits atomic: one logical change per commit
- Write commit messages in imperative mood: "add feature" not "added feature"

## Pull Requests

### PR Description構成

PR descriptionは以下の構成で記述する：

```markdown
## 概要
1-2行で何をしたか、なぜするのかを端的に記述

## 変更内容
### カテゴリ名（例：データベース / モデル / フロントエンド）
- 変更点を箇条書き（動詞で終わらせる）

## 動作確認
実行したコマンドと確認内容をコードブロックで記載

## 関連ISSUE
closes #xx
```

### 記述ルール

- **箇条書きは動詞で終わらせる**: 「〜を追加」「〜を実装」
- **体言止めは使わない**
- **技術的な決定事項は簡潔に説明する**
- **動作確認は実際に実行したコマンドを記載**
- **closes #xxを必ず記載**（ISSUE紐付け）
- **コードブロックはシェルなら `bash` を指定**

### 良い例

```markdown
## 概要
ユーザー管理の基盤となる users・object_types・settings の3テーブルを作成し、
Devise導入前の認証基盤を整備する。

## 変更内容

### データベース
- users テーブルを作成（UUID primary key, email unique, role: "user"）
- object_types テーブルを作成（UUID primary key, name unique, label）
- settings テーブルを作成（user_id UUID primary key, locale/timezone default値設定）
- PostgreSQL pgcrypto拡張を有効化

### モデル・関連付け
- User モデルを追加（has_one :setting）
- ObjectType モデルを追加
- Setting モデルを追加（belongs_to :user, uniqueness validation）

## 動作確認

```bash
docker compose exec web bundle exec rails db:migrate
docker compose exec web bundle exec rails db:seed
```

## 関連ISSUE
closes #33
```

### 悪い例

- ❌ 「Usersテーブルの追加」（体言止め）
- ❌ 「概要: Userモデルを実装」（ラベル不要）
- ❌ closes #xx がない
- ❌ 動作確認が「動作確認済み」のみ（具体的でない）

### その他

- Keep PRs small (under 400 lines of diff when possible)
- Squash merge to main

## Code Review

- Review for correctness, readability, and security
- Check test coverage for new code
- Verify no secrets or sensitive data in diff
- Look for performance implications
