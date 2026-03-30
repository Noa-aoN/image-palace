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
<type>/$ARGUMENTS-{short-description}
```

例: `feature/17-devise-token-auth`
**注意**: `#` はブランチ名に含めないでください。

## Project Specific Rules

- **Terminology**: The entity for word cards is called 'items'. Never use 'objects', 'cards', or 'card_sets'.
- **PR Titles**: Format is `[#$ARGUMENTS] Description`. Example: `[#14] Setup Fly.io deployment`.
- **Tech Stack**: Backend is Rails 8 API. Frontend is Next.js (App Router) + Tailwind CSS + shadcn/ui.
- **Deployment**: Backend is Fly.io.
- **Security**: OpenAI API keys are for backend only. Never call from frontend directly.
