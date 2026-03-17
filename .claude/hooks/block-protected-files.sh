#!/bin/bash
# PreToolUse hook: Block edits to protected files
# Matcher: Edit|Write
#
# Prevents modification of lock files, generated code, and CI config.
# Customize PROTECTED_PATTERNS for your project.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '
  .tool_input.file_path //
  .tool_input.filePath //
  empty
')

if [ -z "$FILE_PATH" ]; then
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

# Lock files — should be managed by package managers only
case "$FILE_PATH" in
  */pnpm-lock.yaml|*/package-lock.json|*/yarn.lock|*/Gemfile.lock|*/poetry.lock|*/Cargo.lock)
    deny "Blocked: lock files should not be edited manually. Run the package manager instead."
    ;;
esac

# Generated files
case "$FILE_PATH" in
  */generated/*|*/.generated.*|*/dist/*|*/build/*)
    deny "Blocked: this is a generated file. Edit the source instead."
    ;;
esac

# Migrations already applied (customize path as needed)
if echo "$FILE_PATH" | grep -qE 'migrations/[0-9]{4}.*\.(sql|ts|js)$'; then
  deny "Blocked: do not edit existing migrations. Create a new migration instead."
fi

exit 0
