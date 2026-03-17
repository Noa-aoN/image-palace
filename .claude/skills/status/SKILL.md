---
name: status
description: Show a summary of the current project state including git, tests, and build status
context: fork
agent: Explore
allowed-tools: Bash(git *), Bash(pnpm *), Bash(npm *), Bash(cat *), Bash(wc *)
---

## Current State

- Branch: !`git branch --show-current`
- Uncommitted changes: !`git status --short | head -20`
- Recent commits: !`git log --oneline -5`
- Remote status: !`git status -sb | head -1`

## Report

Summarize:
1. Current branch and how it relates to main
2. Number of uncommitted changes
3. Summary of recent commits
4. Any obvious issues or next steps
