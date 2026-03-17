---
name: review-pr
description: Review a GitHub pull request and provide structured feedback with severity ratings
context: fork
agent: Explore
allowed-tools: Bash(gh *), Read, Grep, Glob
argument-hint: "[PR number]"
disable-model-invocation: true
---

## PR Context

- PR metadata: !`gh pr view $ARGUMENTS --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles`
- PR diff: !`gh pr diff $ARGUMENTS`
- Changed files: !`gh pr diff $ARGUMENTS --name-only`

## Review Instructions

Perform a thorough code review:

1. **Understand intent**: Read the PR description and understand what problem it solves
2. **Check correctness**: Verify logic, edge cases, and error handling
3. **Check security**: Look for injection vulnerabilities, secret leaks, auth issues
4. **Check performance**: Identify N+1 queries, unnecessary allocations, missing indexes
5. **Check tests**: Verify adequate test coverage for new/changed code
6. **Check style**: Ensure consistency with project conventions

## Output Format

Organize findings by severity:

### 🔴 Critical (must fix before merge)
- Security vulnerabilities, data loss risks, broken functionality

### 🟡 Major (should fix)
- Logic errors, missing edge cases, performance issues

### 🟢 Minor (nice to have)
- Style improvements, naming suggestions, documentation

### ✅ What looks good
- Highlight well-written code and good decisions

End with a clear **recommendation**: Approve / Request Changes / Needs Discussion
