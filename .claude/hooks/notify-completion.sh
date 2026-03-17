#!/bin/bash
# Stop hook: Send notification when Claude finishes a task
# Matcher: none (fires on every Stop)
#
# Supports: macOS native notification, Slack webhook, or both.
# Set SLACK_WEBHOOK_URL env var for Slack notifications.
# Run with async: true to avoid blocking.

set -euo pipefail

INPUT=$(cat)
STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // "unknown"')

# Only notify on normal completion
if [ "$STOP_REASON" != "end_turn" ]; then
  exit 0
fi

# macOS native notification
if command -v osascript &> /dev/null; then
  osascript -e 'display notification "Task completed" with title "Claude Code"' 2>/dev/null || true
fi

# Slack notification (optional)
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  PROJECT=$(basename "$CLAUDE_PROJECT_DIR" 2>/dev/null || echo "unknown")

  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n \
      --arg project "$PROJECT" \
      --arg branch "$BRANCH" \
      '{text: ("✅ Claude Code task completed\nProject: " + $project + "\nBranch: " + $branch)}'
    )" > /dev/null 2>&1 || true
fi

exit 0
