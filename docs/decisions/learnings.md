# 学び集積ログ

開発中に遭遇した問題・解決策・得られた知見を蓄積するログ。
**追記のみ。削除・上書き禁止。**

---

## 2026-03-17: block-secrets.sh の heredoc 誤検知問題

### 背景

vol.2 の作業中、`.claude/hooks/block-secrets.sh` を導入した。
`git commit` や `gh pr create` のコマンド本文にシークレット（API キーなど）が含まれていないか
確認するための pre-commit / pre-tool-use フックスクリプト。

### 何が起きたか

`git commit` コマンドの heredoc 本文（コミットメッセージ）を検査していたところ、
正規表現が heredoc 本文の途中の行にもマッチしてしまい、
シークレットを含まない通常のコミットが「シークレット検出」として誤ってブロックされた。

### 原因

`grep` がコマンド全体の文字列を対象に走査していたため、
heredoc の `EOF` 区切り子や本文の任意の行も検査対象になっていた。

### 解決策

`head -1` でコマンドの先頭行のみを抽出してから検査する方式に変更した。

```bash
# 変更前: コマンド全体を検査
echo "$TOOL_INPUT" | grep -qE "$SECRET_PATTERNS"

# 変更後: 先頭行のみ検査
echo "$TOOL_INPUT" | head -1 | grep -qE "$SECRET_PATTERNS"
```

これにより、`git commit -m "..."` や `gh pr create --body "..."` の
本文部分（2行目以降）は検査対象から外れ、誤検知が解消された。

### 対象ファイル

- `.claude/hooks/block-secrets.sh`

### 得られた教訓

- スクリプトで「コマンド本文」と「コマンド引数」を区別するときは、
  先頭行だけ見るか、コマンド名・フラグのみをパースするかを意識する
- heredoc を使う複数行コマンドは、全体マッチの罠にはまりやすい

---
