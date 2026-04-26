#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/eastshine/IdeaProjects/japanese-vocabulary"
PROMPTS_DIR="$REPO_DIR/.github/scripts/prompts"
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

cd "$REPO_DIR"

# Check if any issues need processing
NEW_ISSUES=$(gh issue list --label "status:new" --json number -q '.[].number' 2>/dev/null || true)
FEEDBACK_ISSUES=$(gh issue list --label "status:feedback" --json number -q '.[].number' 2>/dev/null || true)
APPROVED_ISSUES=$(gh issue list --label "status:approved" --json number -q '.[].number' 2>/dev/null || true)

if [ -z "$NEW_ISSUES" ] && [ -z "$FEEDBACK_ISSUES" ] && [ -z "$APPROVED_ISSUES" ]; then
    echo "No issues to process." >> "$LOG_FILE"
    exit 0
fi

echo "Found issues - new:[$NEW_ISSUES] feedback:[$FEEDBACK_ISSUES] approved:[$APPROVED_ISSUES]" >> "$LOG_FILE"

# Run a single phase for a single issue
run_phase() {
    local phase_prompt="$1"
    local issue_number="$2"
    local phase_name="$3"

    echo "--- Processing issue #$issue_number ($phase_name) ---" >> "$LOG_FILE"

    local combined_prompt
    combined_prompt="$(cat "$PROMPTS_DIR/preamble.md")

$(cat "$PROMPTS_DIR/$phase_prompt")

Process issue #$issue_number"

    claude -p "$combined_prompt" \
        --model claude-opus-4-6 \
        --dangerously-skip-permissions \
        >> "$LOG_FILE" 2>&1 || {
        echo "ERROR: issue #$issue_number ($phase_name) failed with exit code $?" >> "$LOG_FILE"
    }

    echo "--- Done issue #$issue_number ($phase_name) ---" >> "$LOG_FILE"
}

# Phase A: Analyze new issues
for issue in $NEW_ISSUES; do
    run_phase "phase-a-analyze.md" "$issue" "Phase A: Analyze"
done

# Phase B: Revise plans based on feedback
for issue in $FEEDBACK_ISSUES; do
    run_phase "phase-b-revise.md" "$issue" "Phase B: Revise"
done

# Phase C: Implement approved issues
for issue in $APPROVED_ISSUES; do
    run_phase "phase-c-implement.md" "$issue" "Phase C: Implement"
done

echo "=== Done ===" >> "$LOG_FILE"
