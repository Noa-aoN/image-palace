#!/bin/bash
# PostToolUse hook: Auto-format files after Edit/Write
# Matcher: Edit|Write
#
# Runs Prettier on supported files.
# Silent on success, reports errors via transcript.

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

# Only format supported files
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.md|*.yaml|*.yml|*.html)
    ;;
  *)
    exit 0
    ;;
esac

# Check if prettier exists
if ! command -v npx &> /dev/null; then
  exit 0
fi

# Check if prettier config exists in project
if [ ! -f "$CLAUDE_PROJECT_DIR/.prettierrc" ] && \
   [ ! -f "$CLAUDE_PROJECT_DIR/.prettierrc.json" ] && \
   [ ! -f "$CLAUDE_PROJECT_DIR/.prettierrc.js" ] && \
   [ ! -f "$CLAUDE_PROJECT_DIR/prettier.config.js" ]; then
  exit 0
fi

RESULT=$(npx prettier --write "$FILE_PATH" 2>&1) || true
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  jq -n --arg msg "$RESULT" --arg file "$FILE_PATH" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse"
    },
    transcript: ("⚠️ Prettier error in " + $file + ":\n" + $msg)
  }'
fi

exit 0
