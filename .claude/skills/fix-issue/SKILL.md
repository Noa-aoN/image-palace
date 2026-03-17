---
name: fix-issue
description: Fix a GitHub issue by reading the issue, finding relevant code, implementing a fix, and creating a commit
disable-model-invocation: true
argument-hint: "[issue number]"
---

Fix GitHub issue #$ARGUMENTS.

## Steps

1. **Read the issue**: Run `gh issue view $ARGUMENTS` to understand the problem
2. **Identify scope**: Determine which files need to change
3. **Implement the fix**: Make the minimal changes needed
4. **Add tests**: Write or update tests to cover the fix
5. **Verify**: Run the test suite to confirm nothing breaks
6. **Commit**: Create a commit with message `fix: resolve #$ARGUMENTS - <short description>`

## Rules

- Keep changes minimal and focused on the issue
- Do not refactor unrelated code
- If the issue is unclear, explain what you understood and ask for clarification
- If the fix requires breaking changes, explain the impact before proceeding
