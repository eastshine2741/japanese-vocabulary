#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/eastshine/IdeaProjects/japanese-vocabulary"
PROMPT_FILE="$REPO_DIR/.github/scripts/issue-resolver-prompt.md"
LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/issue-resolver-$(date +%Y%m%d).log"
LOCK_FILE="/tmp/issue-resolver.lock"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"

# Prevent duplicate runs
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE")
    if kill -0 "$LOCK_PID" 2>/dev/null; then
        echo "Already running (PID $LOCK_PID). Skipping." >> "$LOG_FILE"
        exit 0
    fi
    rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# Check if any issues need processing before spawning Claude
cd "$REPO_DIR"
NEW=$(gh issue list --label "status:new" --json number -L 1 2>/dev/null)
FEEDBACK=$(gh issue list --label "status:feedback" --json number -L 1 2>/dev/null)
APPROVED=$(gh issue list --label "status:approved" --json number -L 1 2>/dev/null)

if [ "$NEW" = "[]" ] && [ "$FEEDBACK" = "[]" ] && [ "$APPROVED" = "[]" ]; then
    echo "No issues to process." >> "$LOG_FILE"
    exit 0
fi

echo "Found issues - new:$NEW feedback:$FEEDBACK approved:$APPROVED" >> "$LOG_FILE"

claude -p "$(cat "$PROMPT_FILE")" \
    --model claude-opus-4-6 \
    --dangerously-skip-permissions \
    >> "$LOG_FILE" 2>&1

echo "=== Done ===" >> "$LOG_FILE"
