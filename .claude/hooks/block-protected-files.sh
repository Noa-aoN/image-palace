#!/bin/bash
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

# Lock files
case "$FILE_PATH" in
  */pnpm-lock.yaml|*/package-lock.json|*/yarn.lock|*/Gemfile.lock|*/poetry.lock|*/Cargo.lock)
    deny "Blocked: lock files should not be edited manually."
    ;;
esac

# Generated files
case "$FILE_PATH" in
  */generated/*|*/.generated.*|*/dist/*|*/build/*)
    deny "Blocked: generated file."
    ;;
esac

# Migration guard（改善版）
if echo "$FILE_PATH" | grep -qE 'db/migrate/[0-9]{14}_.*\.rb$'; then
  BASENAME=$(basename "$FILE_PATH")
  VERSION=$(echo "$BASENAME" | cut -d_ -f1)

  SCHEMA_FILE="backend/db/schema.rb"

  if [ -f "$SCHEMA_FILE" ]; then
    if grep -q "$VERSION" "$SCHEMA_FILE"; then
      deny "Blocked: This migration has already been applied. Create a new migration instead."
    fi
  fi
fi

exit 0
