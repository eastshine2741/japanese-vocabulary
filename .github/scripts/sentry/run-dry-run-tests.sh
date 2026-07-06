#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(git rev-parse --show-toplevel)"
RUNNER="$REPO_DIR/.github/scripts/sentry/triage.sh"
FIXTURE_DIR="$REPO_DIR/.github/scripts/sentry/fixtures"

run_fixture() {
  local fixture="$1"
  local state_file log_file lock_file
  state_file="$(mktemp)"
  log_file="$(mktemp)"
  lock_file="$(mktemp)"
  rm -f "$lock_file"
  printf '{"version":1,"issues":{},"attempts":[]}\n' > "$state_file"

  SENTRY_TRIAGE_LOCK_FILE="$lock_file" \
    "$RUNNER" --dry-run --state-file "$state_file" --log-file "$log_file" --fixture "$FIXTURE_DIR/${fixture}.json" \
    >"$log_file.out" 2>&1
  grep -q "Completed triage" "$log_file.out"
  printf 'ok %s\n' "$fixture"
}

bash -n "$RUNNER"
jq empty "$REPO_DIR"/.github/scripts/sentry/schemas/*.json "$FIXTURE_DIR"/*.json

run_fixture pr-small-null-check
run_fixture github-issue-large-refactor
run_fixture cause-only-transient
run_fixture codex-low-confidence
run_fixture sentry-note-cause-only

missing_init_state="$(mktemp)"
missing_init_log="$(mktemp)"
missing_init_lock="$(mktemp)"
rm -f "$missing_init_state" "$missing_init_lock"
SENTRY_TRIAGE_LOCK_FILE="$missing_init_lock" \
  "$RUNNER" --dry-run --state-file "$missing_init_state" --log-file "$missing_init_log" --fixture "$FIXTURE_DIR/cause-only-transient.json" \
  >"$missing_init_log.out" 2>&1
jq empty "$missing_init_state"
printf 'ok atomic-missing-state-init\n'

duplicate_state="$(mktemp)"
duplicate_log="$(mktemp)"
duplicate_lock="$(mktemp)"
rm -f "$duplicate_lock"
cat > "$duplicate_state" <<'JSON'
{"version":1,"issues":{"1007":{"sentryIssueId":"1007","actionStatus":"completed","completedAt":"2026-06-25T00:00:00Z"}},"attempts":[]}
JSON
SENTRY_TRIAGE_LOCK_FILE="$duplicate_lock" \
  "$RUNNER" --dry-run --record-dry-run --state-file "$duplicate_state" --log-file "$duplicate_log" --fixture "$FIXTURE_DIR/duplicate-completed-state.json" \
  >"$duplicate_log.out" 2>&1
test "$(jq -r '.issues["1007"].actionStatus' "$duplicate_state")" = "completed"
test "$(jq '.attempts | length' "$duplicate_state")" = "0"
printf 'ok duplicate-completed-state\n'

direct_note_state="$(mktemp)"
direct_note_log="$(mktemp)"
direct_note_lock="$(mktemp)"
rm -f "$direct_note_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$direct_note_state"
SENTRY_TRIAGE_LOCK_FILE="$direct_note_lock" \
  "$RUNNER" --dry-run --record-dry-run --state-file "$direct_note_state" --log-file "$direct_note_log" --fixture "$FIXTURE_DIR/sentry-note-direct.json" \
  >"$direct_note_log.out" 2>&1
test "$(jq -r '.issues["1004"].actionStatus' "$direct_note_state")" = "completed"
test "$(jq -r '.attempts[-1].stage' "$direct_note_state")" = "sentry_note"
printf 'ok sentry-note-direct\n'

partial_state="$(mktemp)"
partial_log="$(mktemp)"
partial_lock="$(mktemp)"
partial_commands="$(mktemp)"
rm -f "$partial_lock"
cat > "$partial_state" <<'JSON'
{"version":1,"issues":{"1006":{"sentryIssueId":"1006","shortId":"KOTONOHA-API-6","selectedAction":"github_issue","actionStatus":"external_created","externalUrl":"https://github.com/example/repo/issues/777","sentryNote":"이미 생성된 GitHub 이슈 링크로 Sentry note 완료 표시만 재시도합니다.","attemptCount":1,"createdAt":"2026-06-25T00:00:00Z","updatedAt":"2026-06-25T00:00:00Z"}},"attempts":[]}
JSON
SENTRY_TRIAGE_LOCK_FILE="$partial_lock" SENTRY_TRIAGE_COMMAND_LOG="$partial_commands" \
  "$RUNNER" --dry-run --record-dry-run --state-file "$partial_state" --log-file "$partial_log" --fixture "$FIXTURE_DIR/partial-success-sentry-note-retry.json" \
  >"$partial_log.out" 2>&1
test "$(jq -r '.issues["1006"].actionStatus' "$partial_state")" = "completed"
! grep -q "gh issue create" "$partial_commands"
! grep -q "gh pr create" "$partial_commands"
grep -q "sentry add note to issue 1006" "$partial_commands"
printf 'ok partial-success-sentry-note-retry\n'

for invalid_fixture in invalid-low-confidence-pr invalid-one-hot invalid-empty-evidence; do
  invalid_state="$(mktemp)"
  invalid_log="$(mktemp)"
  invalid_lock="$(mktemp)"
  rm -f "$invalid_lock"
  printf '{"version":1,"issues":{},"attempts":[]}\n' > "$invalid_state"
  if SENTRY_TRIAGE_LOCK_FILE="$invalid_lock" \
    "$RUNNER" --dry-run --record-dry-run --state-file "$invalid_state" --log-file "$invalid_log" --fixture "$FIXTURE_DIR/${invalid_fixture}.json" \
    >"$invalid_log.out" 2>&1; then
    cat "$invalid_log.out"
    echo "expected validation failure for $invalid_fixture" >&2
    exit 1
  fi
  test "$(jq -r '.attempts[-1].stage' "$invalid_state")" = "codex_triage"
  test "$(jq -r '.attempts[-1].result' "$invalid_state")" = "retryable"
  printf 'ok %s rejected\n' "$invalid_fixture"
done

dry_run_no_record_state="$(mktemp)"
dry_run_no_record_log="$(mktemp)"
dry_run_no_record_lock="$(mktemp)"
rm -f "$dry_run_no_record_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$dry_run_no_record_state"
if SENTRY_TRIAGE_LOCK_FILE="$dry_run_no_record_lock" \
  "$RUNNER" --dry-run --state-file "$dry_run_no_record_state" --log-file "$dry_run_no_record_log" --fixture "$FIXTURE_DIR/invalid-empty-evidence.json" \
  >"$dry_run_no_record_log.out" 2>&1; then
  cat "$dry_run_no_record_log.out"
  echo "expected validation failure for dry-run no-record check" >&2
  exit 1
fi
test "$(jq '.attempts | length' "$dry_run_no_record_state")" = "0"
test "$(jq '.issues | length' "$dry_run_no_record_state")" = "0"
printf 'ok dry-run-no-record-state-clean\n'

preflight_state="$(mktemp)"
preflight_log="$(mktemp)"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$preflight_state"
if env -u SENTRY_AUTH_TOKEN -u SENTRY_ORG -u SENTRY_PROJECT \
  "$RUNNER" --state-file "$preflight_state" --log-file "$preflight_log" --check-preflight \
  >"$preflight_log.out" 2>&1; then
  cat "$preflight_log.out"
  echo "expected preflight failure without credentials" >&2
  exit 1
fi
test "$(jq '.issues | length' "$preflight_state")" = "0"
test "$(jq '.attempts | length' "$preflight_state")" = "1"
test "$(jq -r '.attempts[0].sentryIssueId' "$preflight_state")" = "__preflight__"
test "$(jq -r '.attempts[0].stage' "$preflight_state")" = "preflight"
test "$(jq -r '.attempts[0].result' "$preflight_state")" = "retryable"
printf 'ok preflight-fail-closed\n'

no_jq_bin="$(mktemp -d)"
for cmd in bash git dirname mkdir date tee flock mktemp cat mv; do
  ln -s "$(command -v "$cmd")" "$no_jq_bin/$cmd"
done
no_jq_state="$(mktemp)"
no_jq_log="$(mktemp)"
no_jq_lock="$(mktemp)"
rm -f "$no_jq_state" "$no_jq_lock"
if PATH="$no_jq_bin" SENTRY_TRIAGE_LOCK_FILE="$no_jq_lock" \
  "$RUNNER" --state-file "$no_jq_state" --log-file "$no_jq_log" --check-preflight \
  >"$no_jq_log.out" 2>&1; then
  cat "$no_jq_log.out"
  echo "expected preflight failure without jq" >&2
  exit 1
fi
jq -e '.attempts[0].sentryIssueId == "__preflight__" and .attempts[0].stage == "preflight" and .attempts[0].result == "retryable"' "$no_jq_state" >/dev/null
printf 'ok missing-jq-bootstrap-attempt\n'

existing_no_jq_state="$(mktemp)"
existing_no_jq_log="$(mktemp)"
existing_no_jq_lock="$(mktemp)"
rm -f "$existing_no_jq_lock"
cat > "$existing_no_jq_state" <<'JSON'
{"version":1,"issues":{"already-done":{"sentryIssueId":"already-done","actionStatus":"completed","completedAt":"2026-06-25T00:00:00Z"}},"attempts":[]}
JSON
if PATH="$no_jq_bin" SENTRY_TRIAGE_LOCK_FILE="$existing_no_jq_lock" \
  "$RUNNER" --state-file "$existing_no_jq_state" --log-file "$existing_no_jq_log" --check-preflight \
  >"$existing_no_jq_log.out" 2>&1; then
  cat "$existing_no_jq_log.out"
  echo "expected preflight failure without jq" >&2
  exit 1
fi
test "$(jq -r '.issues["already-done"].actionStatus' "$existing_no_jq_state")" = "completed"
test -s "${existing_no_jq_state}.preflight-failures.jsonl"
printf 'ok missing-jq-preserves-existing-ledger\n'

codex_fail_state="$(mktemp)"
codex_fail_log="$(mktemp)"
codex_fail_lock="$(mktemp)"
rm -f "$codex_fail_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$codex_fail_state"
if SENTRY_TRIAGE_LOCK_FILE="$codex_fail_lock" SENTRY_TRIAGE_FAIL_CODEX=1 \
  "$RUNNER" --dry-run --record-dry-run --state-file "$codex_fail_state" --log-file "$codex_fail_log" --fixture "$FIXTURE_DIR/pr-small-null-check.json" \
  >"$codex_fail_log.out" 2>&1; then
  cat "$codex_fail_log.out"
  echo "expected Codex triage failure" >&2
  exit 1
fi
test "$(jq -r '.issues["1001"].actionStatus' "$codex_fail_state")" = "planned"
test "$(jq -r '.attempts[-1].stage' "$codex_fail_state")" = "codex_triage"
test "$(jq -r '.attempts[-1].result' "$codex_fail_state")" = "retryable"
printf 'ok codex-failure-retryable\n'

github_fail_state="$(mktemp)"
github_fail_log="$(mktemp)"
github_fail_lock="$(mktemp)"
rm -f "$github_fail_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$github_fail_state"
if SENTRY_TRIAGE_LOCK_FILE="$github_fail_lock" SENTRY_TRIAGE_FAIL_GITHUB_ISSUE=1 \
  "$RUNNER" --dry-run --record-dry-run --state-file "$github_fail_state" --log-file "$github_fail_log" --fixture "$FIXTURE_DIR/github-issue-large-refactor.json" \
  >"$github_fail_log.out" 2>&1; then
  cat "$github_fail_log.out"
  echo "expected GitHub issue creation failure" >&2
  exit 1
fi
test "$(jq -r '.issues["1002"].actionStatus' "$github_fail_state")" = "planned"
test "$(jq -r '.issues["1002"].completedAt' "$github_fail_state")" = ""
test "$(jq -r '.attempts[-1].stage' "$github_fail_state")" = "action"
test "$(jq -r '.attempts[-1].result' "$github_fail_state")" = "retryable"
printf 'ok github-action-failure-retryable\n'

sentry_note_fail_state="$(mktemp)"
sentry_note_fail_log="$(mktemp)"
sentry_note_fail_lock="$(mktemp)"
rm -f "$sentry_note_fail_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$sentry_note_fail_state"
if SENTRY_TRIAGE_LOCK_FILE="$sentry_note_fail_lock" SENTRY_TRIAGE_FAIL_SENTRY_NOTE=1 \
  "$RUNNER" --dry-run --record-dry-run --state-file "$sentry_note_fail_state" --log-file "$sentry_note_fail_log" --fixture "$FIXTURE_DIR/github-issue-large-refactor.json" \
  >"$sentry_note_fail_log.out" 2>&1; then
  cat "$sentry_note_fail_log.out"
  echo "expected Sentry note completion failure" >&2
  exit 1
fi
test "$(jq -r '.issues["1002"].actionStatus' "$sentry_note_fail_state")" = "external_created"
test "$(jq -r '.issues["1002"].completedAt' "$sentry_note_fail_state")" = ""
test "$(jq -r '.attempts[-1].stage' "$sentry_note_fail_state")" = "sentry_note"
test "$(jq -r '.attempts[-1].result' "$sentry_note_fail_state")" = "retryable"
printf 'ok sentry-note-failure-retryable\n'

pr_state="$(mktemp)"
pr_log="$(mktemp)"
pr_lock="$(mktemp)"
pr_commands="$(mktemp)"
rm -f "$pr_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$pr_state"
SENTRY_TRIAGE_LOCK_FILE="$pr_lock" SENTRY_TRIAGE_COMMAND_LOG="$pr_commands" \
  "$RUNNER" --dry-run --state-file "$pr_state" --log-file "$pr_log" --fixture "$FIXTURE_DIR/pr-small-null-check.json" \
  >"$pr_log.out" 2>&1
grep -q "git -C .* worktree add" "$pr_commands"
grep -q "codex --ask-for-approval never exec --model gpt-5.5 --config 'model_reasoning_effort=\"high\"' --sandbox workspace-write" "$pr_commands"
grep -q "env -i .*CODEX_HOME" "$pr_commands"
grep -q "status --porcelain --untracked-files=all" "$pr_commands"
grep -q "gh pr create" "$pr_commands"
test "$(grep -n "status --porcelain --untracked-files=all" "$pr_commands" | cut -d: -f1 | head -n1)" -lt "$(grep -n "gh pr create" "$pr_commands" | cut -d: -f1 | head -n1)"
printf 'ok pr-command-ordering\n'

pr_create_fail_state="$(mktemp)"
pr_create_fail_log="$(mktemp)"
pr_create_fail_lock="$(mktemp)"
pr_create_fail_commands="$(mktemp)"
rm -f "$pr_create_fail_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$pr_create_fail_state"
if SENTRY_TRIAGE_LOCK_FILE="$pr_create_fail_lock" SENTRY_TRIAGE_COMMAND_LOG="$pr_create_fail_commands" SENTRY_TRIAGE_FAIL_PR_CREATE=1 \
  "$RUNNER" --dry-run --record-dry-run --state-file "$pr_create_fail_state" --log-file "$pr_create_fail_log" --fixture "$FIXTURE_DIR/pr-small-null-check.json" \
  >"$pr_create_fail_log.out" 2>&1; then
  cat "$pr_create_fail_log.out"
  echo "expected PR creation failure" >&2
  exit 1
fi
test "$(jq -r '.issues["1001"].actionStatus' "$pr_create_fail_state")" = "planned"
test "$(jq -r '.attempts[-1].stage' "$pr_create_fail_state")" = "action"
test "$(jq -r '.attempts[-1].result' "$pr_create_fail_state")" = "retryable"
grep -q "git -C .* worktree add" "$pr_create_fail_commands"
printf 'ok pr-create-failure-retryable\n'

pr_replay_state="$(mktemp)"
pr_replay_log="$(mktemp)"
pr_replay_lock="$(mktemp)"
pr_replay_commands="$(mktemp)"
rm -f "$pr_replay_lock"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$pr_replay_state"
SENTRY_TRIAGE_LOCK_FILE="$pr_replay_lock" SENTRY_TRIAGE_COMMAND_LOG="$pr_replay_commands" SENTRY_TRIAGE_FAKE_REMOTE_BRANCH=1 \
  "$RUNNER" --dry-run --state-file "$pr_replay_state" --log-file "$pr_replay_log" --fixture "$FIXTURE_DIR/pr-small-null-check.json" \
  >"$pr_replay_log.out" 2>&1
grep -q "gh pr create --head" "$pr_replay_commands"
! grep -q "create-worktree.sh" "$pr_replay_commands"
! grep -q "codex --ask-for-approval never exec --model gpt-5.5 --config 'model_reasoning_effort=\"high\"' --sandbox workspace-write" "$pr_replay_commands"
printf 'ok pr-remote-branch-replay\n'

grep -q 'firstSeen:>${first_seen_cutoff}' "$RUNNER"
grep -q 'date -u -d "${REPLAY_DAYS} days ago"' "$RUNNER"
grep -q 'SENTRY_MAX_PAGES' "$RUNNER"
grep -q 'pagination truncated' "$RUNNER"
printf 'ok replay-pagination-static\n'

grep -q 'add -N .' "$RUNNER"
grep -q 'create_clean_worktree' "$RUNNER"
grep -q 'without ignored secret/config files' "$RUNNER"
! grep -q './create-worktree.sh' "$RUNNER"
grep -q 'env -i' "$RUNNER"
grep -q 'output-last-message.*impl_result' "$RUNNER"
grep -q 'commit -m.*>&2' "$RUNNER"
grep -q 'push -u origin.*>&2' "$RUNNER"
grep -q 'Git commit failed' "$RUNNER"
grep -q 'Git push failed' "$RUNNER"
grep -q 'GitHub PR creation failed' "$RUNNER"
grep -q 'GitHub PR creation returned empty URL' "$RUNNER"
grep -q 'Action returned empty external URL' "$RUNNER"
grep -q 'return 1' "$RUNNER"
grep -q 'action_error_file' "$RUNNER"
printf 'ok pr-stdout-and-untracked-diff-static\n'

SENTRY_PROJECTS="123,456" SENTRY_ENVIRONMENTS="production,staging" SENTRY_AUTH_TOKEN=x SENTRY_ORG=demo \
  "$RUNNER" --dry-run --check-preflight --state-file "$(mktemp)" --log-file "$(mktemp)" >/tmp/sentry-preflight-list.out 2>&1 || true
grep -q 'append_query_params "project"' "$RUNNER"
grep -q 'append_query_params "environment"' "$RUNNER"
grep -q 'gh issue list --state all --search' "$RUNNER"
grep -q 'gh pr list --state all --head' "$RUNNER"
grep -q 'ls-remote --exit-code --heads origin' "$RUNNER"
grep -q 'gh pr create --head' "$RUNNER"
grep -q 'log -1 --pretty=%s' "$RUNNER"
grep -q 'Existing PR worktree is dirty; refusing' "$RUNNER"
grep -q 'worktree_has_ignored_files' "$RUNNER"
grep -q 'contains ignored files; refusing' "$RUNNER"
grep -q 'if ! process_context "$context"' "$RUNNER"
printf 'ok repeated-project-environment-static\n'

grep -q 'Sentry triage completed:' "$RUNNER"
grep -q 'sentry_note_completion_exists' "$RUNNER"
grep -q 'SENTRY_NOTE_COMPLETION_LOOKUP_LIMIT' "$RUNNER"
grep -q '/notes/' "$RUNNER"
! grep -q '/home/eastshine/IdeaProjects/japanese-vocabulary' "$REPO_DIR/.github/scripts/sentry/README.md" "$REPO_DIR/.github/scripts/sentry/triage.env.example"
printf 'ok sentry-note-safety-static\n'

rg -n 'sentry_api(_page)? .*(PUT|PATCH|DELETE)|/issues/.*/(resolve|resolved|ignored|archive)' "$RUNNER" >/tmp/sentry-triage-forbidden.out || true
if [[ -s /tmp/sentry-triage-forbidden.out ]]; then
  cat /tmp/sentry-triage-forbidden.out
  exit 1
fi

rg -n "deploy\\.sh|kubectl rollout|production deployment" "$RUNNER" "$REPO_DIR/.github/scripts/sentry/prompts" "$REPO_DIR/.github/scripts/sentry/README.md" >/tmp/sentry-triage-deploy.out || true
if [[ -s /tmp/sentry-triage-deploy.out ]]; then
  cat /tmp/sentry-triage-deploy.out
  exit 1
fi

rg -n "codex exec --ask-for-approval|codex exec --sandbox workspace-write" "$RUNNER" "$REPO_DIR/.github/scripts/sentry/prompts" "$REPO_DIR/.github/scripts/sentry/README.md" >/tmp/sentry-triage-codex.out || true
if [[ -s /tmp/sentry-triage-codex.out ]]; then
  cat /tmp/sentry-triage-codex.out
  exit 1
fi

codex --ask-for-approval never exec --help >/dev/null
printf 'all dry-run checks passed\n'
