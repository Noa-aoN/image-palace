---
name: fix-issue
description: GitHubのISSUE番号を受け取り、該当ISSUEの内容を確認して実装する
disable-model-invocation: true
argument-hint: "[issue number]"
---

Fix GitHub issue #$ARGUMENTS.

## Steps

1. **Read the issue**: Run `gh issue view $ARGUMENTS` to understand the problem
2. **Identify scope**: Determine which files need to change
3. **Implement the fix**: Make the minimal changes needed
4. **Add tests**: Write or update tests to cover the fix（MVP リリース後のみ）
5. **Verify**: Run the relevant test suite to confirm nothing breaks（MVP リリース後のみ）
6. **Commit**: Create a commit following the format below

## Commit Format

```
feat: {ISSUEタイトルの要約} #$ARGUMENTS
```

Types: `feat` / `fix` / `chore` / `refactor` / `docs`

## Branch Naming

```
feature/#$ARGUMENTS-{short-description}
fix/#$ARGUMENTS-{short-description}
```

例: `feature/#17-devise-token-auth`

## Rules

- Keep changes minimal and focused on the issue
- Do not refactor unrelated code
- If the issue is unclear, explain what you understood and ask for clarification
- If the fix requires breaking changes, explain the impact before proceeding
- `objects` が単語カードの実体。`cards` / `card_sets` は使わない
- OpenAI API キーはバックエンドのみ。フロントエンドから直接呼び出し禁止
