#!/bin/bash
# SessionStart hook: Log session start for audit trail
# Matcher: startup|resume
#
# Appends session info to a local log file.
# Useful for tracking Claude Code usage patterns.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
SESSION_TYPE=$(echo "$INPUT" | jq -r '.type // "unknown"')

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/sessions.log"

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | ${SESSION_TYPE} | ${SESSION_ID} | $(git branch --show-current 2>/dev/null || echo 'no-branch')" >> "$LOG_FILE"

# Keep log file manageable (last 500 entries)
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 500 ]; then
  tail -500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exit 0
