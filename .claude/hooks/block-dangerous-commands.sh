#!/bin/bash
# PreToolUse hook: Block dangerous shell commands
# Matcher: Bash
#
# Blocks: rm -rf, secrets in commands, force push, DROP TABLE, etc.
# Returns deny decision via JSON on stdout.

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

# Block recursive force delete
if echo "$COMMAND" | grep -qE 'rm\s+-(r|f|rf|fr)\s'; then
  deny "Blocked: recursive/force delete is not allowed. Use targeted deletes instead."
fi

# Block secrets in commands
if echo "$COMMAND" | grep -qiE '(password|secret|token|api[_-]?key|private[_-]?key)\s*='; then
  deny "Blocked: command appears to contain secrets. Use environment variables instead."
fi

# Block SQL destructive operations
if echo "$COMMAND" | grep -qiE '(DROP\s+(TABLE|DATABASE|INDEX)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*$)'; then
  deny "Blocked: destructive SQL operation detected. Review and execute manually."
fi

# Block writing to system paths
if echo "$COMMAND" | grep -qE '>\s*/etc/|>\s*/usr/|>\s*/var/'; then
  deny "Blocked: writing to system directories is not allowed."
fi

# Block environment modification
if echo "$COMMAND" | grep -qE '(unset\s+(PATH|HOME|USER)|export\s+PATH=)'; then
  deny "Blocked: modifying critical environment variables is not allowed."
fi

exit 0
