#!/bin/bash
# PostToolUse hook: Auto-lint files after Edit/Write
# Matcher: Edit|Write
#
# Runs ESLint --fix on TypeScript/JavaScript files.
# Reports errors back to Claude via transcript.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '
  .tool_input.file_path //
  .tool_input.filePath //
  .tool_result.filePath //
  .tool_result.file_path //
  empty
')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only lint JS/TS files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    ;;
  *)
    exit 0
    ;;
esac

# Check if eslint exists
if ! command -v npx &> /dev/null; then
  exit 0
fi

RESULT=$(npx eslint --fix "$FILE_PATH" 2>&1) || true
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  jq -n --arg msg "$RESULT" --arg file "$FILE_PATH" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse"
    },
    transcript: ("⚠️ ESLint errors in " + $file + ":\n" + $msg)
  }'
fi

exit 0
