#!/bin/bash
# PreToolUse hook: Block secret exposure in Bash commands
# Matcher: Bash
#
# Blocks commands that write secrets to .env files.
# .env.example files are ALLOWED (template values only, not real secrets).

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# Block output redirection to .env files.
# Allow: .env.example, .env.test, .env.sample (template files, no real secrets).
# Block: .env, .env.local, .env.production, .env.staging, etc.
if echo "$COMMAND" | grep -qE '(>|>>)\s*[[:alnum:]_./-]*\.env(\.[a-z]+)?(\s|$)'; then
  if ! echo "$COMMAND" | grep -qE '(>|>>)\s*[[:alnum:]_./-]*\.env\.(example|test|sample)(\s|$)'; then
    deny "Blocked: writing to .env files is not allowed. Use .env.example for templates and set real secrets via environment variables."
  fi
fi

exit 0
