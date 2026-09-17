#!/usr/bin/env bash
# Analysis feedback runner.
#
# Reads ANALYSIS_DEFECT events (words the song analysis pipeline shipped without a meaning) from
# Sentry, groups them by cause + headword, asks Claude to sort the new ones into root causes, and
# opens one PR per root cause that is fixable in code. Everything that decides whether a PR is
# opened — what counts as new, which paths may change, whether the reproduction test fails on
# main and passes on the branch — is done here, not by the model.
#
# See README.md next to this file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${ANALYSIS_FEEDBACK_REPO_DIR:-$(git -C "$SCRIPT_DIR/../../.." rev-parse --show-toplevel)}"
PROMPTS_DIR="$SCRIPT_DIR/prompts"
SCHEMAS_DIR="$SCRIPT_DIR/schemas"

STATE_DIR="${ANALYSIS_FEEDBACK_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/kotonoha-analysis-feedback}"
LEDGER_FILE="${ANALYSIS_FEEDBACK_LEDGER:-$STATE_DIR/ledger.json}"
LOG_DIR="$STATE_DIR/logs"
WORKTREE_ROOT="${ANALYSIS_FEEDBACK_WORKTREE_ROOT:-$STATE_DIR/worktrees}"

# How far back to read. Runs hourly by default; six hours of overlap covers a pod restart or a
# missed timer without re-processing anything, since the ledger dedupes by key.
WINDOW="${ANALYSIS_FEEDBACK_WINDOW:-6h}"
# New keys handed to the classifier per run. Keeps one bad afternoon from becoming forty PRs.
MAX_CANDIDATES="${ANALYSIS_FEEDBACK_MAX_CANDIDATES:-20}"
# PROVIDER_ERROR defects in one run at or above this count are logged as an outage.
PROVIDER_ERROR_ALERT="${ANALYSIS_FEEDBACK_PROVIDER_ERROR_ALERT:-10}"
# A fix pass that fails is retried on a later run this many times, then the key is held.
MAX_FIX_ATTEMPTS="${ANALYSIS_FEEDBACK_MAX_FIX_ATTEMPTS:-2}"
# One gradle test run may take this long before it is killed and counted as a failed fix attempt.
TEST_TIMEOUT="${ANALYSIS_FEEDBACK_TEST_TIMEOUT:-15m}"
CLASSIFY_MODEL="${ANALYSIS_FEEDBACK_CLASSIFY_MODEL:-sonnet}"
FIX_MODEL="${ANALYSIS_FEEDBACK_FIX_MODEL:-opus}"
CLAUDE_MAX_BUDGET_USD="${ANALYSIS_FEEDBACK_MAX_BUDGET_USD:-5}"

MARKER="ANALYSIS_DEFECT"
BRANCH_PREFIX="fix/analysis-"
# The only tree the fix pass may touch. Everything the pipeline decides with lives here.
ALLOWED_PATH_REGEX='^backend/domains/translation/'
# Files whose change means the signal was silenced rather than the defect fixed.
FORBIDDEN_PATH_REGEX='(SentryConfig|application\.ya?ml|logback)'

DRY_RUN=0
NO_PUSH=0
FIXTURE_FILE=""
CHECK_PREFLIGHT=0

usage() {
  cat <<'USAGE'
Usage: run.sh [--dry-run|--no-push] [--fixture FILE] [--check-preflight] [--state-file FILE]

  --dry-run          Fetch, merge into the ledger, classify, but never create a worktree, run
                     the fix pass, push, or open a PR. Ledger writes still happen unless the
                     ledger is pointed at a scratch file with --state-file.
  --no-push          Run everything including the fix pass and both test runs, then stop before
                     push/PR and leave the branch and worktree in place for inspection.
  --fixture FILE     Read defects from a JSON file of {eventId,timestamp,defect} instead of Sentry.
  --check-preflight  Verify tools and Sentry access, then exit.
  --state-file FILE  Ledger path (default: $XDG_STATE_HOME/kotonoha-analysis-feedback/ledger.json).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-push) NO_PUSH=1 ;;
    --fixture) FIXTURE_FILE="$2"; shift ;;
    --check-preflight) CHECK_PREFLIGHT=1 ;;
    --state-file) LEDGER_FILE="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

mkdir -p "$STATE_DIR" "$LOG_DIR" "$(dirname "$LEDGER_FILE")"
LOG_FILE="$LOG_DIR/analysis-feedback-$(date +%Y%m%d).log"

log() {
  local level="$1"; shift
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$*" | tee -a "$LOG_FILE" >&2
}

die() { log "ERROR" "$*"; exit 1; }

TMP_FILES=()
tmp() { local f; f="$(mktemp)"; TMP_FILES+=("$f"); printf '%s\n' "$f"; }
cleanup() { rm -f "${TMP_FILES[@]:-}"; }
trap cleanup EXIT

urlencode() { jq -rn --arg s "$1" '$s|@uri'; }

# ---------------------------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------------------------

preflight() {
  local tool
  for tool in jq curl git gh claude; do
    command -v "$tool" >/dev/null 2>&1 || die "Missing tool: $tool"
  done
  [[ -d "$REPO_DIR/.git" || -f "$REPO_DIR/.git" ]] || die "Not a git repo: $REPO_DIR"
  if [[ -z "$FIXTURE_FILE" ]]; then
    : "${SENTRY_AUTH_TOKEN:?SENTRY_AUTH_TOKEN is required}"
    : "${SENTRY_ORG:?SENTRY_ORG is required}"
    : "${SENTRY_PROJECT:?SENTRY_PROJECT (numeric project id) is required}"
    local probe
    probe="$(sentry_get "/organizations/$(urlencode "$SENTRY_ORG")/events/?dataset=errors&field=id&per_page=1&statsPeriod=1h&project=${SENTRY_PROJECT}")" \
      || die "Sentry events API not reachable with the configured token/org/project"
    jq -e '.data|type=="array"' <<<"$probe" >/dev/null || die "Unexpected Sentry response: ${probe:0:200}"
  fi
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated"
  if [[ ! -f "$LEDGER_FILE" ]]; then
    printf '{"version":1,"defects":{}}\n' > "$LEDGER_FILE"
  fi
  jq -e '.version==1 and (.defects|type=="object")' "$LEDGER_FILE" >/dev/null || die "Ledger is not readable: $LEDGER_FILE"
}

# ---------------------------------------------------------------------------------------------
# Sentry
# ---------------------------------------------------------------------------------------------

SENTRY_BASE="${SENTRY_API_BASE:-https://sentry.io/api/0}"
SENTRY_NEXT_CURSOR=""

# GET one page. Prints the body; leaves the next cursor (if the page says there is one) in
# SENTRY_NEXT_CURSOR.
sentry_get() {
  local path="$1"
  local headers body
  headers="$(tmp)"; body="$(tmp)"
  local status
  status="$(curl -sS -o "$body" -D "$headers" -w '%{http_code}' \
    -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
    "${SENTRY_BASE}${path}")" || return 1
  [[ "$status" == "200" ]] || { log "WARN" "Sentry HTTP $status for $path: $(head -c 300 "$body")"; return 1; }
  SENTRY_NEXT_CURSOR="$(grep -i '^link:' "$headers" | tr ',' '\n' | grep 'rel="next"' | grep 'results="true"' | sed -n 's/.*cursor="\([^"]*\)".*/\1/p' | head -n1 || true)"
  cat "$body"
}

# Every ANALYSIS_DEFECT event in the window, one JSON object per line:
#   {eventId, timestamp, defect:{songId,lyricId,lineIndex,cause,surface,headword,line,detail}}
fetch_defects() {
  if [[ -n "$FIXTURE_FILE" ]]; then
    jq -c '.[]' "$FIXTURE_FILE"
    return
  fi
  local org query base path page=1 body
  org="$(urlencode "$SENTRY_ORG")"
  query="$(urlencode "message:${MARKER}")"
  base="/organizations/${org}/events/?dataset=errors&field=id&field=timestamp&field=message&per_page=100&sort=-timestamp&statsPeriod=${WINDOW}&project=${SENTRY_PROJECT}&query=${query}"
  path="$base"
  while :; do
    body="$(sentry_get "$path")" || die "Sentry events fetch failed on page $page"
    jq -c --arg marker "$MARKER " '
      .data[]
      | select(.message | startswith($marker))
      | {eventId: .id, timestamp: .timestamp, defect: (.message | ltrimstr($marker) | fromjson? // empty)}
      | select(.defect != null)
    ' <<<"$body"
    [[ -n "$SENTRY_NEXT_CURSOR" ]] || break
    page=$((page + 1))
    [[ $page -le 10 ]] || { log "WARN" "Stopping after 10 pages; the rest waits for the next run"; break; }
    path="${base}&cursor=$(urlencode "$SENTRY_NEXT_CURSOR")"
  done
}

# ---------------------------------------------------------------------------------------------
# Ledger
# ---------------------------------------------------------------------------------------------
#
# {"version":1,"defects":{"<cause>:<headword>":{cause,headword,status,firstSeen,lastSeen,
#   occurrences:[{songId,lineIndex,surface,line,timestamp}], fixAttempts, prUrl, reason}}}
#
# status: new | provider_error | ignored | held | fixing
#   new            never shown to the classifier
#   provider_error jisho outage — recorded, never classified
#   ignored        classifier said the word legitimately has no meaning
#   held           classifier or fix pass could not act; a person looks
#   fixing         a PR exists (prUrl)

ledger_key() {
  jq -r '.defect | "\(.cause):\(.headword // .surface)"' <<<"$1"
}

# Folds one run's events into the ledger. Prints the keys whose status is `new` afterwards.
merge_into_ledger() {
  local events_file="$1"
  local merged
  merged="$(tmp)"
  jq --slurpfile events "$events_file" '
    reduce $events[] as $e (.;
      ($e.defect | "\(.cause):\(.headword // .surface)") as $key
      | ($e.defect.cause == "PROVIDER_ERROR") as $provider
      | .defects[$key] as $existing
      | .defects[$key] = (
          ($existing // {
            cause: $e.defect.cause,
            headword: ($e.defect.headword // $e.defect.surface),
            status: (if $provider then "provider_error" else "new" end),
            firstSeen: $e.timestamp,
            fixAttempts: 0,
            prUrl: null,
            reason: null,
            occurrences: []
          })
          | .lastSeen = ([.lastSeen // $e.timestamp, $e.timestamp] | max)
          | .firstSeen = ([.firstSeen, $e.timestamp] | min)
          | .occurrences = (
              (.occurrences + [{
                songId: $e.defect.songId, lineIndex: $e.defect.lineIndex,
                surface: $e.defect.surface, line: $e.defect.line, detail: $e.defect.detail,
                timestamp: $e.timestamp, eventId: $e.eventId
              }])
              | unique_by(.eventId)
              | sort_by(.timestamp)
              | .[-8:]
            )
        )
    )
  ' "$LEDGER_FILE" > "$merged"
  mv "$merged" "$LEDGER_FILE"
}

ledger_set() {
  local key="$1" field="$2" value_json="$3"
  local out
  out="$(tmp)"
  jq --arg key "$key" --arg field "$field" --argjson value "$value_json" \
    '.defects[$key][$field] = $value' "$LEDGER_FILE" > "$out"
  mv "$out" "$LEDGER_FILE"
}

# ---------------------------------------------------------------------------------------------
# Claude
# ---------------------------------------------------------------------------------------------

# Runs one headless pass. Prints the structured output JSON.
#   claude_pass <cwd> <model> <prompt-file> <schema-file> <tools> <allowed-rules> <permission-mode>
# <tools> is the built-in tool set the pass may see at all; <allowed-rules> pre-approves calls
# (permission-rule syntax, e.g. "Bash(./gradlew *)") so nothing prompts in a timer.
claude_pass() {
  local cwd="$1" model="$2" prompt_file="$3" schema_file="$4" tools="$5" allowed="$6" mode="$7"
  local out
  out="$(tmp)"
  # Scrubbed environment: the model gets no Sentry or GitHub credentials. HOME stays so the CLI
  # finds its own auth; ANTHROPIC_*/CLAUDE_* pass through for people who run it with an API key.
  local passthrough=()
  local var
  for var in $(compgen -e | grep -E '^(ANTHROPIC_|CLAUDE_)' || true); do
    passthrough+=("$var=${!var}")
  done
  if ! (cd "$cwd" && env -i HOME="$HOME" PATH="$PATH" TERM=dumb LANG="${LANG:-C.UTF-8}" "${passthrough[@]}" \
      claude -p \
        --model "$model" \
        --output-format json \
        --json-schema "$(cat "$schema_file")" \
        --tools "$tools" \
        --allowedTools "$allowed" \
        --permission-mode "$mode" \
        --strict-mcp-config \
        --no-session-persistence \
        --max-budget-usd "$CLAUDE_MAX_BUDGET_USD" \
        < "$prompt_file" > "$out" 2>>"$LOG_FILE"); then
    log "ERROR" "claude exited non-zero (model=$model cwd=$cwd)"
    return 1
  fi
  if ! jq -e '.is_error == false and (.structured_output|type=="object")' "$out" >/dev/null; then
    log "ERROR" "claude returned no structured output: $(jq -c 'del(.usage,.modelUsage,.subagent_stats)' "$out" | head -c 600)"
    return 1
  fi
  jq -c '.structured_output' "$out"
}

# ---------------------------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------------------------

classify() {
  local candidates_json="$1"
  local prompt result
  prompt="$(tmp)"
  {
    cat "$PROMPTS_DIR/classify.md"
    printf '\n```json\n%s\n```\n' "$(jq '.' <<<"$candidates_json")"
  } > "$prompt"
  result="$(claude_pass "$REPO_DIR" "$CLASSIFY_MODEL" "$prompt" "$SCHEMAS_DIR/classify.schema.json" \
    "Read,Grep,Glob" "Read,Grep,Glob" "default")" || return 1

  # Every candidate must land in exactly one group; a fix group must carry a plan.
  local expected got
  expected="$(jq -c '[.[].key] | sort' <<<"$candidates_json")"
  got="$(jq -c '[.groups[].keys[]] | sort' <<<"$result")"
  if [[ "$expected" != "$got" ]]; then
    log "ERROR" "Classifier did not cover the candidates exactly. expected=$expected got=$got"
    return 1
  fi
  if ! jq -e 'all(.groups[]; .verdict != "fix" or .fixPlan != null)' <<<"$result" >/dev/null; then
    log "ERROR" "Classifier returned a fix group without a plan"
    return 1
  fi
  if jq -e '.groups[] | select(.fixPlan != null) | .fixPlan.files[] | select(test("'"$ALLOWED_PATH_REGEX"'") | not)' <<<"$result" >/dev/null; then
    log "ERROR" "Classifier planned files outside the allowed tree"
    return 1
  fi
  printf '%s\n' "$result"
}

# ---------------------------------------------------------------------------------------------
# Fix pass
# ---------------------------------------------------------------------------------------------

# Changed paths in the worktree relative to origin/main (tracked + untracked).
changed_paths() {
  git -C "$1" status --porcelain --untracked-files=all | awk '{print $NF}'
}

# Refuses a diff that reaches outside the allowed tree, touches a forbidden file, or removes a
# warn/error log call (the way four of the old triage PRs "fixed" their Sentry issue).
verify_diff() {
  local wt="$1"
  local paths
  paths="$(changed_paths "$wt")"
  [[ -n "$paths" ]] || { log "WARN" "Fix pass changed nothing"; return 1; }
  local bad
  bad="$(grep -Ev "$ALLOWED_PATH_REGEX" <<<"$paths" || true)"
  [[ -z "$bad" ]] || { log "WARN" "Fix pass touched files outside the allowed tree: $(tr '\n' ' ' <<<"$bad")"; return 1; }
  bad="$(grep -E "$FORBIDDEN_PATH_REGEX" <<<"$paths" || true)"
  [[ -z "$bad" ]] || { log "WARN" "Fix pass touched a forbidden file: $(tr '\n' ' ' <<<"$bad")"; return 1; }
  local removed added
  removed="$(git -C "$wt" diff | grep -cE '^-.*logger\.(warn|error)\(' || true)"
  added="$(git -C "$wt" diff | grep -cE '^\+.*logger\.(warn|error)\(' || true)"
  if [[ "$removed" -gt "$added" ]]; then
    log "WARN" "Fix pass removed $removed warn/error log call(s) and added $added — refusing a silenced signal"
    return 1
  fi
  local tests
  tests="$(grep -E '/src/test/' <<<"$paths" || true)"
  [[ -n "$tests" ]] || { log "WARN" "Fix pass added no test"; return 1; }
}

# Runs one test class in a worktree. Prints "PASSED n" / "FAILED n/m" and returns the gradle exit.
#   run_test <worktree> <gradleTask> <testClass>
run_test() {
  local wt="$1" task="$2" test_class="$3"
  local module_dir
  module_dir="$(sed -e 's/^://' -e 's/:test$//' -e 's#:#/#g' <<<"$task")"
  local gradle_log
  gradle_log="$(tmp)"
  local exit_code=0
  # </dev/null: the caller loops over groups via stdin, and gradle forwards whatever stdin it
  # inherits to the daemon. Nothing reads it there, the daemon's pipe fills, and the build never
  # returns (hung the 2026-09-16 run for 18h). timeout is the backstop so the timer keeps going.
  (cd "$wt/backend" && timeout "$TEST_TIMEOUT" ./gradlew "$task" --tests "$test_class" -q </dev/null > "$gradle_log" 2>&1) || exit_code=$?
  local results_dir="$wt/backend/$module_dir/build/test-results/test"
  local summary
  summary="$(python3 - "$results_dir" "$test_class" <<'PY' 2>/dev/null || true
import glob, sys, xml.etree.ElementTree as ET
results_dir, test_class = sys.argv[1], sys.argv[2]
tests = failed = 0
for f in glob.glob(f"{results_dir}/TEST-{test_class}*.xml"):
    r = ET.parse(f).getroot()
    tests += int(r.get("tests", 0)); failed += int(r.get("failures", 0)) + int(r.get("errors", 0))
print(f"{tests} {failed}")
PY
)"
  local tests="${summary%% *}" failed="${summary##* }"
  if [[ -z "$summary" || "$tests" == "0" ]]; then
    printf 'NO RESULT (gradle exit %s): %s\n' "$exit_code" "$(grep -E 'error:|FAILED|e: ' "$gradle_log" | head -n 3 | tr '\n' ' ')"
    return "${exit_code:-1}"
  fi
  if [[ "$exit_code" -eq 0 && "$failed" == "0" ]]; then
    printf 'PASSED — %s tests\n' "$tests"
  else
    printf 'FAILED — %s of %s tests failed\n' "$failed" "$tests"
  fi
  return "$exit_code"
}

# The reproduction gate: the branch's test files, dropped onto origin/main, must fail there.
#   test_on_base <fix-worktree> <gradleTask> <testClass>  → prints the summary line, returns 0 if it FAILED on main
test_on_base() {
  local wt="$1" task="$2" test_class="$3"
  local base_wt="$WORKTREE_ROOT/base-$$"
  git -C "$REPO_DIR" worktree add --detach "$base_wt" origin/main >/dev/null 2>&1 || return 2
  local rc=0 summary
  (
    cd "$wt"
    changed_paths "$wt" | grep -E '/src/test/' | while read -r f; do
      mkdir -p "$base_wt/$(dirname "$f")"
      cp "$f" "$base_wt/$f"
    done
  )
  summary="$(run_test "$base_wt" "$task" "$test_class")" || rc=$?
  git -C "$REPO_DIR" worktree remove --force "$base_wt" >/dev/null 2>&1 || true
  printf '%s\n' "$summary"
  # We want a failure here. A compile error on main also counts: the test names code that main lacks.
  [[ "$rc" -ne 0 ]]
}

# Builds the PR body from data. The model's two paragraphs are the only prose it wrote.
#   pr_body <group-json> <fix-json> <base-sha> <base-summary> <branch-summary>
pr_body() {
  local group="$1" fix="$2" base_sha="$3" base_summary="$4" branch_summary="$5"
  local keys_list
  keys_list="$(jq -r '.keys[]' <<<"$group")"
  echo "## 어느 가사의 어느 단어"
  echo
  local key
  while read -r key; do
    jq -r --arg key "$key" '
      .defects[$key] as $d
      | $d.occurrences[]
      | "- songId=\(.songId) \(.lineIndex + 1)번째 줄 「\(.line)」 → `\(.surface)`" + (if $d.headword != .surface then " (원형 \($d.headword))" else "" end) + " — \($d.cause)"
    ' "$LEDGER_FILE"
  done <<<"$keys_list"
  local first last
  first="$(jq -r --argjson keys "$(jq -c '.keys' <<<"$group")" '[.defects[$keys[]].firstSeen] | min | .[:10]' "$LEDGER_FILE")"
  last="$(jq -r --argjson keys "$(jq -c '.keys' <<<"$group")" '[.defects[$keys[]].lastSeen] | max | .[:10]' "$LEDGER_FILE")"
  echo
  if [[ "$first" == "$last" ]]; then echo "(${first} 발생, Sentry kotonoha-batch-prod)"; else echo "(${first} ~ ${last} 발생, Sentry kotonoha-batch-prod)"; fi
  echo
  echo "## 왜"
  echo
  jq -r '.why' <<<"$fix"
  echo
  echo "## 어떻게 바꿨나"
  echo
  jq -r '.how' <<<"$fix"
  echo
  echo "## 확인"
  echo
  echo '```'
  printf '$ cd backend && ./gradlew %s --tests %s\n' "$(jq -r '.gradleTask' <<<"$fix")" "$(jq -r '.testClass' <<<"$fix")"
  printf 'origin/main (%s): %s\n' "${base_sha:0:7}" "$base_summary"
  printf '이 브랜치:               %s\n' "$branch_summary"
  echo '```'
  echo
  echo "---"
  echo "분석 파이프라인 자동 피드백(\`.github/scripts/analysis-feedback\`)이 만든 PR. 원장 키: $(jq -r '.keys | map("`\(.)`") | join(", ")' <<<"$group")"
}

# One classifier group with verdict=fix → one PR, or a reason why not (printed, non-zero exit).
fix_group() {
  local group="$1"
  local slug branch wt
  slug="$(jq -r '.fixPlan.branchSlug' <<<"$group")"
  branch="${BRANCH_PREFIX}${slug}"
  wt="$WORKTREE_ROOT/$slug"

  if [[ -n "$(git -C "$REPO_DIR" ls-remote --heads origin "$branch")" ]]; then
    log "WARN" "Branch already exists on origin, skipping: $branch"
    return 1
  fi
  [[ ! -e "$wt" ]] || git -C "$REPO_DIR" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"
  mkdir -p "$WORKTREE_ROOT"
  git -C "$REPO_DIR" fetch -q origin main
  # Branch from origin/main, never from whatever the local checkout happens to be on: the old
  # triage runner branched from HEAD and shipped a +18,000-line PR of unrelated local commits.
  git -C "$REPO_DIR" worktree add -q -b "$branch" "$wt" origin/main
  local base_sha
  base_sha="$(git -C "$wt" rev-parse HEAD)"

  local prompt fix
  prompt="$(tmp)"
  {
    cat "$PROMPTS_DIR/fix.md"
    printf '\n분류 결과:\n```json\n%s\n```\n' "$(jq '{title, reason, fixPlan}' <<<"$group")"
    printf '\n결손 상세:\n```json\n%s\n```\n' "$(jq --argjson keys "$(jq -c '.keys' <<<"$group")" \
      '[$keys[] as $k | .defects[$k] | {key: $k, cause, headword, occurrences: [.occurrences[] | {songId, lineIndex, surface, line, detail}]}]' \
      "$LEDGER_FILE")"
  } > "$prompt"

  local ok=1
  # Bash is limited to gradle, in the two spellings the prompt allows (relative and from backend/).
  fix="$(claude_pass "$wt" "$FIX_MODEL" "$prompt" "$SCHEMAS_DIR/fix.schema.json" \
    "Read,Grep,Glob,Edit,Write,Bash" \
    "Read,Grep,Glob,Edit,Write,Bash(./gradlew *),Bash(cd backend && ./gradlew *),Bash(cd $wt/backend && ./gradlew *)" \
    "acceptEdits")" || ok=0
  if [[ $ok -eq 1 && "$(jq -r '.status' <<<"$fix")" != "implemented" ]]; then
    log "INFO" "Fix pass gave up on '$slug': $(jq -r '.reason' <<<"$fix")"
    ok=0
  fi
  if [[ $ok -eq 1 ]] && ! verify_diff "$wt"; then ok=0; fi

  local task test_class branch_summary base_summary
  if [[ $ok -eq 1 ]]; then
    task="$(jq -r '.gradleTask' <<<"$fix")"; test_class="$(jq -r '.testClass' <<<"$fix")"
    log "INFO" "Running $test_class on the branch"
    branch_summary="$(run_test "$wt" "$task" "$test_class")" || { log "WARN" "Test does not pass on the branch: $branch_summary"; ok=0; }
  fi
  if [[ $ok -eq 1 ]]; then
    log "INFO" "Running $test_class on origin/main"
    base_summary="$(test_on_base "$wt" "$task" "$test_class")" || true
    if [[ "$base_summary" != FAILED* && "$base_summary" != "NO RESULT"* ]]; then
      log "WARN" "Reproduction test also passes on origin/main ($base_summary) — it does not reproduce the defect"
      ok=0
    fi
  fi

  if [[ $ok -ne 1 ]]; then
    git -C "$REPO_DIR" worktree remove --force "$wt" >/dev/null 2>&1 || true
    git -C "$REPO_DIR" branch -D "$branch" >/dev/null 2>&1 || true
    return 1
  fi

  local title
  title="$(jq -r '.commitTitle' <<<"$fix")"
  git -C "$wt" add -A
  git -C "$wt" -c user.name="$(git -C "$REPO_DIR" config user.name)" -c user.email="$(git -C "$REPO_DIR" config user.email)" \
    commit -q -m "$title" -m "Analysis feedback runner: $(jq -r '.keys | join(", ")' <<<"$group")"
  local count
  count="$(git -C "$wt" rev-list --count origin/main..HEAD)"
  [[ "$count" == "1" ]] || { log "ERROR" "Expected exactly one commit on $branch, found $count"; return 1; }

  local body_file pr_url
  body_file="$(tmp)"
  pr_body "$group" "$fix" "$base_sha" "$base_summary" "$branch_summary" > "$body_file"
  if [[ $NO_PUSH -eq 1 ]]; then
    log "INFO" "[no-push] branch $branch is ready in $wt; PR body follows"
    cat "$body_file" >&2
    printf 'no-push:%s\n' "$branch"
    return 0
  fi
  git -C "$wt" push -q -u origin "$branch"
  pr_url="$(cd "$wt" && gh pr create --base main --head "$branch" --title "$title" --body-file "$body_file")"
  git -C "$REPO_DIR" worktree remove --force "$wt" >/dev/null 2>&1 || true
  printf '%s\n' "$pr_url"
}

# ---------------------------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------------------------

main() {
  preflight
  if [[ $CHECK_PREFLIGHT -eq 1 ]]; then log "INFO" "Preflight OK"; exit 0; fi
  log "INFO" "Analysis feedback start dryRun=$DRY_RUN fixture=${FIXTURE_FILE:-none} window=$WINDOW ledger=$LEDGER_FILE"

  local events
  events="$(tmp)"
  fetch_defects > "$events"
  local n_events
  n_events="$(wc -l < "$events")"
  log "INFO" "Fetched $n_events defect event(s)"

  if [[ "$n_events" -gt 0 ]]; then
    merge_into_ledger "$events"
  fi

  local provider_errors
  provider_errors="$(jq -s '[.[] | select(.defect.cause == "PROVIDER_ERROR")] | length' "$events")"
  if [[ "$provider_errors" -ge "$PROVIDER_ERROR_ALERT" ]]; then
    log "WARN" "jisho outage: $provider_errors PROVIDER_ERROR defect(s) in the window — nothing to fix in code; the affected songs shipped those words without a meaning and can be re-analysed"
  fi

  local candidates
  candidates="$(jq -c --argjson max "$MAX_CANDIDATES" '
    [.defects | to_entries[] | select(.value.status == "new")
     | {key: .key, cause: .value.cause, headword: .value.headword,
        occurrences: [.value.occurrences[] | {songId, lineIndex, surface, line, detail}]}]
    | sort_by(.key) | .[:$max]
  ' "$LEDGER_FILE")"
  local n_candidates
  n_candidates="$(jq 'length' <<<"$candidates")"
  if [[ "$n_candidates" -eq 0 ]]; then
    log "INFO" "No new defects to classify"
    exit 0
  fi
  log "INFO" "Classifying $n_candidates new key(s): $(jq -r '[.[].key] | join(", ")' <<<"$candidates")"

  local classification
  classification="$(classify "$candidates")" || die "Classification failed; keys stay 'new' for the next run"
  log "INFO" "Classifier: $(jq -r '[.groups[] | "\(.verdict) [\(.keys | join(", "))]"] | join(" | ")' <<<"$classification")"

  local group verdict key
  while read -r group; do
    verdict="$(jq -r '.verdict' <<<"$group")"
    case "$verdict" in
      expected_no_meaning)
        for key in $(jq -r '.keys[]' <<<"$group"); do
          ledger_set "$key" status '"ignored"'
          ledger_set "$key" reason "$(jq -c '.reason' <<<"$group")"
        done
        ;;
      hold)
        for key in $(jq -r '.keys[]' <<<"$group"); do
          ledger_set "$key" status '"held"'
          ledger_set "$key" reason "$(jq -c '.reason' <<<"$group")"
        done
        ;;
      fix)
        if [[ $DRY_RUN -eq 1 ]]; then
          log "INFO" "[dry-run] would open a PR for '$(jq -r '.title' <<<"$group")' plan=$(jq -c '.fixPlan' <<<"$group")"
          continue
        fi
        local pr_url=""
        if pr_url="$(fix_group "$group")"; then
          log "INFO" "PR created: $pr_url"
          for key in $(jq -r '.keys[]' <<<"$group"); do
            ledger_set "$key" status '"fixing"'
            ledger_set "$key" prUrl "$(jq -cn --arg u "$pr_url" '$u')"
          done
        else
          for key in $(jq -r '.keys[]' <<<"$group"); do
            local attempts
            attempts="$(jq -r --arg k "$key" '.defects[$k].fixAttempts + 1' "$LEDGER_FILE")"
            ledger_set "$key" fixAttempts "$attempts"
            if [[ "$attempts" -ge "$MAX_FIX_ATTEMPTS" ]]; then
              ledger_set "$key" status '"held"'
              ledger_set "$key" reason "\"fix pass failed $attempts time(s)\""
            fi
          done
        fi
        ;;
    esac
  done < <(jq -c '.groups[]' <<<"$classification")

  log "INFO" "Analysis feedback done"
}

main "$@"
