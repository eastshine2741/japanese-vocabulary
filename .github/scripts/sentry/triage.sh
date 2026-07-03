#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SENTRY_TRIAGE_REPO_DIR:-$(git -C "$SCRIPT_DIR/../../.." rev-parse --show-toplevel)}"
SCHEMA_FILE="$REPO_DIR/.github/scripts/sentry/schemas/sentry-triage-result.schema.json"
PR_IMPL_SCHEMA_FILE="$REPO_DIR/.github/scripts/sentry/schemas/sentry-pr-implementation-result.schema.json"
TRIAGE_PROMPT="$REPO_DIR/.github/scripts/sentry/prompts/triage.md"

STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
STATE_DIR="${SENTRY_TRIAGE_STATE_DIR:-$STATE_HOME/kotonoha-sentry-triage}"
LOG_DIR="${SENTRY_TRIAGE_LOG_DIR:-$STATE_DIR/logs}"
STATE_FILE="${SENTRY_TRIAGE_STATE_FILE:-$STATE_DIR/processed.json}"
LOG_FILE="${SENTRY_TRIAGE_LOG_FILE:-$LOG_DIR/sentry-triage-$(date +%Y%m%d).log}"
LOCK_FILE="${SENTRY_TRIAGE_LOCK_FILE:-${TMPDIR:-/tmp}/kotonoha-sentry-triage.lock}"
REPLAY_DAYS="${SENTRY_TRIAGE_REPLAY_DAYS:-7}"
SENTRY_LIMIT="${SENTRY_TRIAGE_LIMIT:-20}"
SENTRY_MAX_PAGES="${SENTRY_TRIAGE_MAX_PAGES:-5}"
PR_MAX_CHANGED_FILES="${SENTRY_TRIAGE_PR_MAX_CHANGED_FILES:-8}"
PR_MAX_DIFF_LINES="${SENTRY_TRIAGE_PR_MAX_DIFF_LINES:-400}"
DISCORD_HISTORY_LIMIT="${SENTRY_TRIAGE_DISCORD_HISTORY_LIMIT:-50}"
DISCORD_COMPLETION_LOOKUP_PAGES="${SENTRY_TRIAGE_DISCORD_COMPLETION_LOOKUP_PAGES:-5}"
HANDLED_EMOJI="${SENTRY_TRIAGE_HANDLED_EMOJI:-✅}"
DISCORD_FALLBACK="${SENTRY_TRIAGE_DISCORD_FALLBACK:-0}"

DRY_RUN=0
RECORD_DRY_RUN=0
FIXTURE_FILE=""
CHECK_PREFLIGHT_ONLY=0
COMMAND_LOG="${SENTRY_TRIAGE_COMMAND_LOG:-}"

usage() {
  cat <<'EOF'
Usage: .github/scripts/sentry/triage.sh [options]

Options:
  --dry-run                 Do not mutate GitHub, Discord, or local completed state.
  --record-dry-run          Allow dry-run to write retryable local state for tests.
  --fixture FILE            Use a fixture instead of live Sentry/Discord/Codex calls.
  --state-file FILE         Override local ledger path.
  --log-file FILE           Override log path.
  --check-preflight         Run preflight only.
  -h, --help                Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --record-dry-run)
      RECORD_DRY_RUN=1
      shift
      ;;
    --fixture)
      FIXTURE_FILE="${2:?--fixture requires a file}"
      shift 2
      ;;
    --state-file)
      STATE_FILE="${2:?--state-file requires a file}"
      shift 2
      ;;
    --log-file)
      LOG_FILE="${2:?--log-file requires a file}"
      shift 2
      ;;
    --check-preflight)
      CHECK_PREFLIGHT_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$LOG_FILE")" "$LOG_DIR"

log() {
  local level="$1"
  shift
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$*" | tee -a "$LOG_FILE" >&2
}

record_command() {
  if [[ -n "$COMMAND_LOG" ]]; then
    printf '%s\n' "$*" >> "$COMMAND_LOG"
  fi
  log "DRYRUN" "$*"
}

die() {
  log "ERROR" "$*"
  exit 1
}

bootstrap_preflight_attempt_without_jq() {
  local error="$1"
  local state_dir
  local tmp
  local escaped_error
  state_dir="$(dirname "$STATE_FILE")"
  mkdir -p "$state_dir"
  escaped_error="${error//\\/\\\\}"
  escaped_error="${escaped_error//\"/\\\"}"
  if [[ -f "$STATE_FILE" ]]; then
    printf '{"attemptId":"__preflight__-%s-bootstrap","sentryIssueId":"__preflight__","startedAt":"%s","stage":"preflight","result":"retryable","externalUrl":"","error":"%s"}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      "$escaped_error" >> "${STATE_FILE}.preflight-failures.jsonl"
    return
  fi
  tmp="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  cat > "$tmp" <<EOF
{"version":1,"issues":{},"attempts":[{"attemptId":"__preflight__-$(date -u +%Y-%m-%dT%H:%M:%SZ)-bootstrap","sentryIssueId":"__preflight__","startedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","stage":"preflight","result":"retryable","externalUrl":"","error":"$escaped_error"}]}
EOF
  mv "$tmp" "$STATE_FILE"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

append_query_params() {
  local name="$1"
  local csv="$2"
  local item
  local out=""
  IFS=',' read -ra items <<< "$csv"
  for item in "${items[@]}"; do
    item="${item#"${item%%[![:space:]]*}"}"
    item="${item%"${item##*[![:space:]]}"}"
    [[ -n "$item" ]] || continue
    out+="&${name}=$(urlencode "$item")"
  done
  printf '%s' "$out"
}

init_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    local tmp
    tmp="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
    printf '{"version":1,"issues":{},"attempts":[]}\n' > "$tmp"
    mv "$tmp" "$STATE_FILE"
  fi
  jq empty "$STATE_FILE" >/dev/null
}

append_attempt() {
  local issue_id="$1"
  local stage="$2"
  local result="$3"
  local error="${4:-}"
  local external_url="${5:-}"
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local attempt_id
  attempt_id="${issue_id}-${now}-${RANDOM}"
  local tmp
  tmp="$(mktemp)"
  jq -n \
    --arg attemptId "$attempt_id" \
    --arg sentryIssueId "$issue_id" \
    --arg startedAt "$now" \
    --arg stage "$stage" \
    --arg result "$result" \
    --arg externalUrl "$external_url" \
    --arg error "$error" \
    '{attemptId:$attemptId,sentryIssueId:$sentryIssueId,startedAt:$startedAt,stage:$stage,result:$result,externalUrl:$externalUrl,error:$error}' > "$tmp"
  local out
  out="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  jq --slurpfile attempt "$tmp" '.attempts += [$attempt[0]]' "$STATE_FILE" > "$out"
  mv "$out" "$STATE_FILE"
  rm -f "$tmp"
}

append_attempt_if_recording() {
  if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
    append_attempt "$@"
  fi
}

append_preflight_attempt() {
  local error="$1"
  append_attempt_if_recording "__preflight__" "preflight" "retryable" "$error"
}

write_issue_record() {
  local issue_id="$1"
  local record_file="$2"
  local out
  out="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"
  jq --arg id "$issue_id" --slurpfile record "$record_file" '.issues[$id] = $record[0]' "$STATE_FILE" > "$out"
  mv "$out" "$STATE_FILE"
}

issue_record() {
  local issue_id="$1"
  jq -c --arg id "$issue_id" '.issues[$id] // {}' "$STATE_FILE"
}

issue_status() {
  local issue_id="$1"
  issue_record "$issue_id" | jq -r '.actionStatus // ""'
}

codex_safe() {
  local codex_home
  codex_home="${CODEX_HOME:-${HOME:-}/.codex}"
  env -i \
    HOME="${HOME:-}" \
    USER="${USER:-}" \
    LOGNAME="${LOGNAME:-}" \
    PATH="${PATH:-/usr/local/bin:/usr/bin:/bin}" \
    SHELL="${SHELL:-/bin/sh}" \
    TERM="${TERM:-dumb}" \
    TMPDIR="${TMPDIR:-/tmp}" \
    CODEX_HOME="$codex_home" \
    XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-}" \
    XDG_CACHE_HOME="${XDG_CACHE_HOME:-}" \
    XDG_DATA_HOME="${XDG_DATA_HOME:-}" \
    XDG_STATE_HOME="${XDG_STATE_HOME:-}" \
    LANG="${LANG:-C.UTF-8}" \
    codex "$@"
}

preflight() {
  need_cmd jq
  need_cmd git

  if [[ "$DRY_RUN" -eq 1 && -n "$FIXTURE_FILE" ]]; then
    if ! jq -e '.mockCodexResult?' "$FIXTURE_FILE" >/dev/null; then
      need_cmd codex
      codex_safe --ask-for-approval never exec --help >/dev/null
    fi
    return
  fi

  need_cmd curl
  need_cmd codex
  need_cmd gh

  codex_safe --ask-for-approval never exec --help >/dev/null
  gh auth status >/dev/null

  [[ -n "${SENTRY_AUTH_TOKEN:-}" ]] || die "Missing SENTRY_AUTH_TOKEN"
  [[ -n "${SENTRY_ORG:-}" ]] || die "Missing SENTRY_ORG"
  [[ -n "${SENTRY_PROJECTS:-${SENTRY_PROJECT:-}}" ]] || die "Missing SENTRY_PROJECT or SENTRY_PROJECTS"
  [[ -n "${DISCORD_BOT_TOKEN:-}" ]] || die "Missing DISCORD_BOT_TOKEN"
  [[ -n "${DISCORD_CHANNEL_ID:-}" ]] || die "Missing DISCORD_CHANNEL_ID"
}

urlencode() {
  jq -rn --arg v "$1" '$v|@uri'
}

discord_auth_header() {
  printf 'Authorization: Bot %s' "$DISCORD_BOT_TOKEN"
}

discord_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" \
      -H "$(discord_auth_header)" \
      -H 'Content-Type: application/json' \
      -d "$body" \
      "https://discord.com/api/v10${path}"
  else
    curl -fsS -X "$method" \
      -H "$(discord_auth_header)" \
      "https://discord.com/api/v10${path}"
  fi
}

sentry_api() {
  local path="$1"
  curl -fsS \
    -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
    -H 'Content-Type: application/json' \
    "https://sentry.io/api/0${path}"
}

sentry_api_page() {
  local path="$1"
  local body_file="$2"
  local header_file="$3"
  curl -fsS -D "$header_file" -o "$body_file" \
    -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
    -H 'Content-Type: application/json' \
    "https://sentry.io/api/0${path}"
}

next_cursor_from_headers() {
  local header_file="$1"
  tr -d '\r' < "$header_file" \
    | awk '/^[Ll]ink:/ {print}' \
    | grep 'rel="next"' \
    | grep 'results="true"' \
    | sed -n 's/.*cursor="\([^"]*\)".*/\1/p' \
    | tail -n 1
}

poll_sentry_issues() {
  if [[ "${SENTRY_TRIAGE_FAIL_SENTRY_POLL:-0}" == "1" ]]; then
    echo "Simulated Sentry poll failure" >&2
    return 1
  fi
  local query
  local sentry_query
  sentry_query="is:unresolved firstSeen:-${REPLAY_DAYS}d"
  query="$(urlencode "$sentry_query")"
  local org
  org="$(urlencode "$SENTRY_ORG")"
  local project_query
  project_query="$(append_query_params "project" "${SENTRY_PROJECTS:-${SENTRY_PROJECT:-}}")"
  local env_query=""
  if [[ -n "${SENTRY_ENVIRONMENT:-}" ]]; then
    env_query="$(append_query_params "environment" "$SENTRY_ENVIRONMENT")"
  fi
  if [[ -n "${SENTRY_ENVIRONMENTS:-}" ]]; then
    env_query+="$(append_query_params "environment" "$SENTRY_ENVIRONMENTS")"
  fi
  local base_path="/organizations/${org}/issues/?query=${query}&sort=new&limit=${SENTRY_LIMIT}${project_query}${env_query}"
  local path="$base_path"
  local page=1
  local next_cursor=""
  local body_file header_file aggregate_file merged_file
  body_file="$(mktemp)"
  header_file="$(mktemp)"
  aggregate_file="$(mktemp)"
  printf '[]\n' > "$aggregate_file"
  log "INFO" "Polling Sentry issues replayDays=$REPLAY_DAYS limit=$SENTRY_LIMIT maxPages=$SENTRY_MAX_PAGES path=$base_path"

  while :; do
    sentry_api_page "$path" "$body_file" "$header_file"
    merged_file="$(mktemp)"
    jq -s '.[0] + .[1]' "$aggregate_file" "$body_file" > "$merged_file"
    mv "$merged_file" "$aggregate_file"
    next_cursor="$(next_cursor_from_headers "$header_file" || true)"
    log "INFO" "Fetched Sentry page=$page nextCursor=${next_cursor:-none}"
    if [[ -z "$next_cursor" ]]; then
      break
    fi
    if [[ "$page" -ge "$SENTRY_MAX_PAGES" ]]; then
      log "WARN" "Sentry pagination truncated at maxPages=$SENTRY_MAX_PAGES; unseen issues remain retryable on later runs"
      break
    fi
    path="${base_path}&cursor=$(urlencode "$next_cursor")"
    page=$((page + 1))
  done

  cat "$aggregate_file"
  rm -f "$body_file" "$header_file" "$aggregate_file"
}

fetch_sentry_issue() {
  local issue_id="$1"
  sentry_api "/issues/$(urlencode "$issue_id")/"
}

fetch_sentry_event() {
  local issue_id="$1"
  sentry_api "/issues/$(urlencode "$issue_id")/events/?full=true&limit=1"
}

fixture_issue_context() {
  jq -c '{issue:.issue,event:.event,issueDetail:(.issueDetail // .issue),repo:{root:$repo}}' --arg repo "$REPO_DIR" "$FIXTURE_FILE"
}

real_issue_context() {
  local issue_json="$1"
  local issue_id
  issue_id="$(jq -r '.id' <<<"$issue_json")"
  local detail events event
  detail="$(fetch_sentry_issue "$issue_id")"
  events="$(fetch_sentry_event "$issue_id")"
  event="$(jq -c '.[0] // {}' <<<"$events")"
  jq -n --argjson issue "$issue_json" --argjson detail "$detail" --argjson event "$event" --arg repo "$REPO_DIR" \
    '{issue:$issue,issueDetail:$detail,event:$event,repo:{root:$repo}}'
}

context_issue_id() {
  jq -r '.issue.id // .issueDetail.id // empty' <<<"$1"
}

context_short_id() {
  local context="$1"
  local issue_id="$2"
  jq -r --arg fallback "$issue_id" '.issue.shortId // .issue.short_id // .issueDetail.shortId // .issueDetail.short_id // $fallback' <<<"$context"
}

context_permalink() {
  jq -r '.issue.permalink // .issueDetail.permalink // empty' <<<"$1"
}

discord_message_match_jq() {
  cat <<'JQ'
    def searchable_text:
      [
        .content?,
        .embeds[]?.url?,
        .embeds[]?.title?,
        .embeds[]?.description?,
        .embeds[]?.fields[]?.name?,
        .embeds[]?.fields[]?.value?
      ]
      | map(select(type == "string"))
      | join("\n");
    map(select(((searchable_text | contains($short)) or (($link != "") and (searchable_text | contains($link))))))
    | .[0].id // empty
JQ
}

find_discord_message_fixture() {
  local short_id="$1"
  local permalink="$2"
  if [[ "${SENTRY_TRIAGE_FAIL_DISCORD_LOOKUP:-0}" == "1" ]]; then
    echo "Simulated Discord lookup failure" >&2
    return 1
  fi
  jq -r --arg short "$short_id" --arg link "$permalink" "(.discord.messages // []) | $(discord_message_match_jq)" "$FIXTURE_FILE"
}

find_discord_message_live() {
  local short_id="$1"
  local permalink="$2"
  local messages
  if [[ "${SENTRY_TRIAGE_FAIL_DISCORD_LOOKUP:-0}" == "1" ]]; then
    echo "Simulated Discord lookup failure" >&2
    return 1
  fi
  messages="$(discord_api GET "/channels/${DISCORD_CHANNEL_ID}/messages?limit=${DISCORD_HISTORY_LIMIT}")"
  jq -r --arg short "$short_id" --arg link "$permalink" "$(discord_message_match_jq)" <<<"$messages"
}

find_discord_message() {
  local short_id="$1"
  local permalink="$2"
  if [[ -n "$FIXTURE_FILE" ]]; then
    find_discord_message_fixture "$short_id" "$permalink"
  else
    find_discord_message_live "$short_id" "$permalink"
  fi
}

discord_completion_marker() {
  local short_id="$1"
  printf 'Sentry triage completed: %s' "$short_id"
}

discord_messages_contain_completion() {
  local messages="$1"
  local marker="$2"
  local external_url="$3"
  jq -e --arg marker "$marker" --arg url "$external_url" '
    any(.[]; ((.content // "") | contains($marker)) and (($url == "") or ((.content // "") | contains($url))))
  ' <<<"$messages" >/dev/null
}

discord_completion_message_exists() {
  local short_id="$1"
  local external_url="$2"
  local marker messages page before path count
  marker="$(discord_completion_marker "$short_id")"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 1
  fi
  page=1
  before=""
  while [[ "$page" -le "$DISCORD_COMPLETION_LOOKUP_PAGES" ]]; do
    path="/channels/${DISCORD_CHANNEL_ID}/messages?limit=${DISCORD_HISTORY_LIMIT}"
    if [[ -n "$before" ]]; then
      path="${path}&before=${before}"
    fi
    if ! messages="$(discord_api GET "$path")"; then
      echo "Discord completion lookup failed" >&2
      return 2
    fi
    if discord_messages_contain_completion "$messages" "$marker" "$external_url"; then
      return 0
    fi
    count="$(jq 'length' <<<"$messages")"
    if [[ "$count" -lt "$DISCORD_HISTORY_LIMIT" ]]; then
      break
    fi
    before="$(jq -r '.[-1].id // empty' <<<"$messages")"
    [[ -n "$before" ]] || break
    page=$((page + 1))
  done
  return 1
}

build_triage_input() {
  local context_file="$1"
  local out_file="$2"
  {
    cat "$TRIAGE_PROMPT"
    printf '\n\n## Sentry context JSON\n\n```json\n'
    cat "$context_file"
    printf '\n```\n'
  } > "$out_file"
}

run_codex_triage() {
  local context_file="$1"
  local result_file="$2"
  if [[ "${SENTRY_TRIAGE_FAIL_CODEX:-0}" == "1" ]]; then
    echo "Simulated Codex triage failure" >&2
    return 1
  fi
  if [[ -n "$FIXTURE_FILE" ]] && jq -e '.mockCodexResult?' "$FIXTURE_FILE" >/dev/null; then
    jq '.mockCodexResult' "$FIXTURE_FILE" > "$result_file"
    return
  fi

  local prompt_file
  prompt_file="$(mktemp)"
  build_triage_input "$context_file" "$prompt_file"
  if ! codex_safe --ask-for-approval never exec \
    --sandbox read-only \
    --output-schema "$SCHEMA_FILE" \
    --cd "$REPO_DIR" \
    --output-last-message "$result_file" \
    - < "$prompt_file"; then
    rm -f "$prompt_file"
    return 1
  fi
  rm -f "$prompt_file"
}

validate_triage_result() {
  local result_file="$1"
  jq -e '
    (.action == "pr" or .action == "github_issue" or .action == "cause_only")
    and (.confidence == "low" or .confidence == "medium" or .confidence == "high")
    and ((.summary // "") | type == "string" and length > 0)
    and ((.rootCause // "") | type == "string" and length > 0)
    and ((.discordReply // "") | type == "string" and length > 0)
    and ((.evidence // []) | type == "array" and length > 0 and all(.[]; type == "string" and length > 0))
    and (.requiresLargeRefactor | type == "boolean")
    and (
      if .action == "pr" then
        (
          .confidence != "low"
          and .requiresLargeRefactor == false
          and has("prPlan")
          and (has("githubIssue") | not)
          and (.prPlan | type == "object")
          and ((.prPlan.branchSlug // "") | type == "string" and length > 0)
          and ((.prPlan.title // "") | type == "string" and length > 0)
          and ((.prPlan.implementationPrompt // "") | type == "string" and length > 0)
          and ((.prPlan.testPlan // []) | type == "array" and length > 0 and all(.[]; type == "string" and length > 0))
        )
      elif .action == "github_issue" then
        (
          has("githubIssue")
          and (has("prPlan") | not)
          and (.githubIssue | type == "object")
          and ((.githubIssue.title // "") | type == "string" and length > 0)
          and ((.githubIssue.body // "") | type == "string" and length > 0)
          and ((.githubIssue.labels // []) | type == "array" and all(.[]; type == "string" and length > 0))
        )
      else
        ((has("githubIssue") | not) and (has("prPlan") | not))
      end
    )
  ' "$result_file" >/dev/null
}

slugify() {
  local value
  if [[ $# -gt 0 ]]; then
    value="$1"
  else
    value="$(cat)"
  fi
  tr '[:upper:]' '[:lower:]' <<<"$value" \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g' \
    | cut -c1-60
}

create_github_issue() {
  local result_file="$1"
  local issue_id="$2"
  local title body body_file
  local labels=()
  local gh_args=()
  title="$(jq -r '.githubIssue.title' "$result_file")"
  body="$(jq -r --arg id "$issue_id" '.githubIssue.body + "\n\nSentry issue id: " + $id' "$result_file")"
  mapfile -t labels < <(jq -r '.githubIssue.labels[]?' "$result_file")
  for label in "${labels[@]}"; do
    gh_args+=(--label "$label")
  done
  body_file="$(mktemp)"
  printf '%s\n' "$body" > "$body_file"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    if [[ "${SENTRY_TRIAGE_FAIL_GITHUB_ISSUE:-0}" == "1" ]]; then
      echo "Simulated GitHub issue creation failure" >&2
      rm -f "$body_file"
      return 1
    fi
    record_command "(cd $(printf '%q' "$REPO_DIR") && gh issue create --title $(printf '%q' "$title") --body-file $body_file ${gh_args[*]})"
    rm -f "$body_file"
    printf 'https://github.com/dry-run/issues/%s\n' "$issue_id"
    return
  fi

  local existing_url
  existing_url="$(cd "$REPO_DIR" && gh issue list --state all --search "Sentry issue id: ${issue_id} in:body" --json url -q '.[0].url // empty')"
  if [[ -n "$existing_url" ]]; then
    rm -f "$body_file"
    printf '%s\n' "$existing_url"
    return
  fi

  local issue_url
  if ! issue_url="$(cd "$REPO_DIR" && gh issue create --title "$title" --body-file "$body_file" "${gh_args[@]}")"; then
    rm -f "$body_file"
    echo "GitHub issue creation failed" >&2
    return 1
  fi
  rm -f "$body_file"
  if [[ -z "$issue_url" ]]; then
    echo "GitHub issue creation returned empty URL" >&2
    return 1
  fi
  printf '%s\n' "$issue_url"
}

validate_pr_implementation_result() {
  local result_file="$1"
  jq -e '
    (.action == "implemented" or .action == "github_issue")
    and ((.summary // "") | length > 0)
    and ((.changedFiles // []) | type == "array")
    and ((.testPlan // []) | type == "array")
    and (
      if .action == "github_issue" then has("githubIssue")
      else (has("githubIssue") | not)
      end
    )
  ' "$result_file" >/dev/null
}

rewrite_to_github_issue_result() {
  local triage_result_file="$1"
  local impl_result_file="$2"
  local out_file="$3"
  jq -n --slurpfile triage "$triage_result_file" --slurpfile impl "$impl_result_file" '
    {
      action: "github_issue",
      confidence: ($triage[0].confidence // "medium"),
      summary: ($impl[0].summary // $triage[0].summary),
      rootCause: ($triage[0].rootCause // "Implementation requires broader work."),
      evidence: (($triage[0].evidence // []) + ["Implementation pass declined PR path"]),
      requiresLargeRefactor: true,
      discordReply: (($triage[0].discordReply // "자동 PR 대신 GitHub 이슈로 전환합니다.") + "\n\n구현 단계에서 PR 범위를 넘는 작업으로 판단되어 GitHub 이슈로 전환했습니다."),
      githubIssue: $impl[0].githubIssue
    }
  ' > "$out_file"
}

validate_pr_diff_policy() {
  local worktree_dir="$1"
  local status_output="$2"
  local changed_count diff_lines
  changed_count="$(printf '%s\n' "$status_output" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [[ "$changed_count" -eq 0 ]]; then
    echo "Implementation Codex produced no source diff; refusing empty PR" >&2
    return 1
  fi
  if [[ "$changed_count" -gt "$PR_MAX_CHANGED_FILES" ]]; then
    echo "Implementation changed $changed_count files, above PR safety limit $PR_MAX_CHANGED_FILES" >&2
    return 1
  fi
  if printf '%s\n' "$status_output" | awk '{print $2}' | grep -Eq '(^|/)(deploy|k8s|manifests)(/|$)|deploy\.sh$'; then
    echo "Implementation touched deployment-related files; refusing automated PR" >&2
    return 1
  fi
  git -C "$worktree_dir" add -N . >/dev/null
  diff_lines="$(git -C "$worktree_dir" diff --numstat HEAD -- | awk '$1 ~ /^[0-9]+$/ {add += $1} $2 ~ /^[0-9]+$/ {del += $2} END {print add + del + 0}')"
  if [[ "$diff_lines" -gt "$PR_MAX_DIFF_LINES" ]]; then
    echo "Implementation diff has $diff_lines changed lines, above PR safety limit $PR_MAX_DIFF_LINES" >&2
    return 1
  fi
}

create_clean_worktree() {
  local branch="$1"
  local worktree_dir="$2"
  echo "Creating clean worktree without ignored secret/config files: $worktree_dir (branch: $branch)" >&2
  if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$REPO_DIR" worktree add "$worktree_dir" "$branch"
  else
    git -C "$REPO_DIR" worktree add -b "$branch" "$worktree_dir"
  fi
}

worktree_has_ignored_files() {
  local worktree_dir="$1"
  git -C "$worktree_dir" status --porcelain --ignored=matching --untracked-files=all \
    | awk '$1 == "!!" { found = 1 } END { exit(found ? 0 : 1) }'
}

pr_body_file_for() {
  local result_file="$1"
  local issue_id="$2"
  local short_id="$3"
  local pr_body_file
  pr_body_file="$(mktemp)"
  jq -r --arg id "$issue_id" --arg short "$short_id" '
    "Sentry: " + $short + " (" + $id + ")\n\n## Summary\n" + .summary + "\n\n## Root cause\n" + .rootCause + "\n\n## Test plan\n" + ((.prPlan.testPlan // []) | map("- " + .) | join("\n"))
  ' "$result_file" > "$pr_body_file"
  printf '%s\n' "$pr_body_file"
}

remote_branch_exists() {
  local branch="$1"
  git -C "$REPO_DIR" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1
}

create_pr_for_branch() {
  local branch="$1"
  local result_file="$2"
  local issue_id="$3"
  local short_id="$4"
  local pr_body_file pr_url
  pr_body_file="$(pr_body_file_for "$result_file" "$issue_id" "$short_id")"
  if [[ "${SENTRY_TRIAGE_FAIL_PR_CREATE:-0}" == "1" ]]; then
    rm -f "$pr_body_file"
    echo "Simulated GitHub PR creation failure" >&2
    return 1
  fi
  if ! pr_url="$(cd "$REPO_DIR" && gh pr create --head "$branch" --title "$(jq -r '.prPlan.title' "$result_file")" --body-file "$pr_body_file")"; then
    rm -f "$pr_body_file"
    echo "GitHub PR creation failed" >&2
    return 1
  fi
  rm -f "$pr_body_file"
  if [[ -z "$pr_url" ]]; then
    echo "GitHub PR creation returned empty URL" >&2
    return 1
  fi
  printf '%s\n' "$pr_url"
}

run_pr_implementation() {
  local result_file="$1"
  local issue_id="$2"
  local short_id="$3"
  local context_file="$4"
  local slug branch worktree_dir prompt_file impl_result status_output reused_worktree
  slug="$(jq -r '.prPlan.branchSlug' "$result_file" | slugify)"
  [[ -n "$slug" ]] || slug="fix"
  branch="fix/sentry-${short_id}-${slug}"
  branch="$(slugify "$branch" | sed 's#^fix-sentry-#fix/sentry-#')"
  worktree_dir="${REPO_DIR}/../$(basename "$REPO_DIR")-${branch//\//-}"
  reused_worktree=0

  if [[ "$DRY_RUN" -eq 1 ]]; then
    if [[ "${SENTRY_TRIAGE_FAKE_REMOTE_BRANCH:-0}" == "1" ]]; then
      record_command "(cd $(printf '%q' "$REPO_DIR") && gh pr create --head $(printf '%q' "$branch") --title $(printf '%q' "$(jq -r '.prPlan.title' "$result_file")") --body-file <tmp>)"
      if [[ "${SENTRY_TRIAGE_FAIL_PR_CREATE:-0}" == "1" ]]; then
        echo "Simulated GitHub PR creation failure" >&2
        return 1
      fi
      printf 'https://github.com/dry-run/pull/%s\n' "$issue_id"
      return
    fi
    record_command "git -C $(printf '%q' "$REPO_DIR") worktree add -b $(printf '%q' "$branch") $(printf '%q' "$worktree_dir")"
    record_command "env -i HOME=<home> CODEX_HOME=<codex-home> PATH=<path> codex --ask-for-approval never exec --sandbox workspace-write --cd $(printf '%q' "$worktree_dir") --output-last-message <tmp> - < implementation-prompt"
    record_command "git -C $(printf '%q' "$worktree_dir") status --porcelain --untracked-files=all"
    record_command "git -C $(printf '%q' "$worktree_dir") commit && git -C $(printf '%q' "$worktree_dir") push && (cd $(printf '%q' "$worktree_dir") && gh pr create)"
    if [[ "${SENTRY_TRIAGE_FAIL_PR_CREATE:-0}" == "1" ]]; then
      echo "Simulated GitHub PR creation failure" >&2
      return 1
    fi
    printf 'https://github.com/dry-run/pull/%s\n' "$issue_id"
    return
  fi

  local existing_pr_url
  existing_pr_url="$(cd "$REPO_DIR" && gh pr list --state all --head "$branch" --json url -q '.[0].url // empty')"
  if [[ -n "$existing_pr_url" ]]; then
    printf '%s\n' "$existing_pr_url"
    return
  fi

  if remote_branch_exists "$branch"; then
    create_pr_for_branch "$branch" "$result_file" "$issue_id" "$short_id"
    return
  fi

  if [[ -n "$(git -C "$REPO_DIR" status --porcelain --untracked-files=no)" ]]; then
    echo "Main worktree has tracked changes; refusing PR path" >&2
    return 1
  fi

  if [[ -e "$worktree_dir" ]]; then
    if ! git -C "$worktree_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "Existing worktree path is not a git worktree: $worktree_dir" >&2
      return 1
    fi
    if [[ "$(git -C "$worktree_dir" rev-parse --abbrev-ref HEAD)" != "$branch" ]]; then
      echo "Existing worktree path is on a different branch: $worktree_dir" >&2
      return 1
    fi
    if [[ -n "$(git -C "$worktree_dir" status --porcelain --untracked-files=all)" ]]; then
      echo "Existing PR worktree is dirty; refusing to rerun Codex on stale edits: $worktree_dir" >&2
      return 1
    fi
    if worktree_has_ignored_files "$worktree_dir"; then
      echo "Existing PR worktree contains ignored files; refusing to expose stale local config to Codex: $worktree_dir" >&2
      return 1
    fi
    log "INFO" "Reusing existing PR worktree $worktree_dir"
    reused_worktree=1
  else
    create_clean_worktree "$branch" "$worktree_dir"
  fi

  if [[ "$reused_worktree" -eq 1 ]] \
    && [[ "$(git -C "$worktree_dir" log -1 --pretty=%s)" == "$(jq -r '.prPlan.title' "$result_file")" ]]; then
    if ! git -C "$worktree_dir" push -u origin "$branch" >&2; then
      echo "Git push failed" >&2
      return 1
    fi
    create_pr_for_branch "$branch" "$result_file" "$issue_id" "$short_id"
    return
  fi

  prompt_file="$(mktemp)"
  impl_result="$(mktemp)"
  {
    printf 'Implement the following narrow Sentry fix in this isolated worktree.\n\n'
    printf 'Hard constraints: no deploy commands, no broad refactor, no Sentry status mutation, keep the change narrow. Tests are optional only for obvious small fixes; explain if not run.\n\n'
    printf 'Return final JSON matching .github/scripts/sentry/schemas/sentry-pr-implementation-result.schema.json. Use action=github_issue instead of action=implemented if the fix needs broad investigation or a large refactor.\n\n'
    printf '## PR plan JSON\n\n```json\n'
    jq '.prPlan' "$result_file"
    printf '\n```\n\n## Sentry context JSON\n\n```json\n'
    cat "$context_file"
    printf '\n```\n'
  } > "$prompt_file"

  if ! codex_safe --ask-for-approval never exec \
    --sandbox workspace-write \
    --output-schema "$PR_IMPL_SCHEMA_FILE" \
    --cd "$worktree_dir" \
    --output-last-message "$impl_result" \
    - < "$prompt_file" >&2; then
    rm -f "$prompt_file" "$impl_result"
    echo "Implementation Codex failed" >&2
    return 1
  fi

  if ! validate_pr_implementation_result "$impl_result"; then
    rm -f "$prompt_file" "$impl_result"
    echo "Implementation Codex result failed validation" >&2
    return 1
  fi
  if [[ "$(jq -r '.action' "$impl_result")" == "github_issue" ]]; then
    local rewritten_result_file issue_url
    rewritten_result_file="$(mktemp)"
    if ! rewrite_to_github_issue_result "$result_file" "$impl_result" "$rewritten_result_file"; then
      rm -f "$prompt_file" "$impl_result" "$rewritten_result_file"
      echo "Failed to rewrite implementation result to GitHub issue" >&2
      return 1
    fi
    mv "$rewritten_result_file" "$result_file"
    if ! issue_url="$(create_github_issue "$result_file" "$issue_id")"; then
      rm -f "$prompt_file" "$impl_result"
      echo "${issue_url:-GitHub issue creation failed during PR downgrade}" >&2
      return 1
    fi
    if [[ -z "$issue_url" ]]; then
      rm -f "$prompt_file" "$impl_result"
      echo "GitHub issue creation returned empty URL during PR downgrade" >&2
      return 1
    fi
    rm -f "$prompt_file" "$impl_result"
    printf '%s\n' "$issue_url"
    return
  fi

  status_output="$(git -C "$worktree_dir" status --porcelain --untracked-files=all)"
  if ! validate_pr_diff_policy "$worktree_dir" "$status_output"; then
    rm -f "$prompt_file" "$impl_result"
    return 1
  fi

  if ! git -C "$worktree_dir" add -A; then
    rm -f "$prompt_file" "$impl_result"
    echo "Git add failed" >&2
    return 1
  fi
  if ! git -C "$worktree_dir" commit -m "$(jq -r '.prPlan.title' "$result_file")" >&2; then
    rm -f "$prompt_file" "$impl_result"
    echo "Git commit failed" >&2
    return 1
  fi
  if ! git -C "$worktree_dir" push -u origin "$branch" >&2; then
    rm -f "$prompt_file" "$impl_result"
    echo "Git push failed" >&2
    return 1
  fi

  local pr_url
  if ! pr_url="$(create_pr_for_branch "$branch" "$result_file" "$issue_id" "$short_id")"; then
    rm -f "$prompt_file" "$impl_result"
    printf '%s\n' "$pr_url" >&2
    return 1
  fi
  rm -f "$prompt_file" "$impl_result"
  printf '%s\n' "$pr_url"
}

discord_complete() {
  local message_id="$1"
  local reply="$2"
  local external_url="$3"
  local short_id="$4"
  local content
  if [[ "${SENTRY_TRIAGE_FAIL_DISCORD:-0}" == "1" ]]; then
    echo "Simulated Discord completion failure" >&2
    return 1
  fi
  if [[ -n "$external_url" ]]; then
    content="${reply}"$'\n\n'"${external_url}"
  else
    content="$reply"
  fi
  content="${content}"$'\n\n'"$(discord_completion_marker "$short_id")"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    if [[ -n "$message_id" ]]; then
      record_command "discord add reaction $HANDLED_EMOJI to message $message_id"
      record_command "discord reply to message $message_id: $content"
    else
      record_command "discord fallback triage message for $short_id: $content"
    fi
    return
  fi

  if [[ -n "$message_id" ]]; then
    local emoji
    local body
    local reaction_method
    emoji="$(urlencode "$HANDLED_EMOJI")"
    reaction_method="PUT"
    if ! discord_api "$reaction_method" "/channels/${DISCORD_CHANNEL_ID}/messages/${message_id}/reactions/${emoji}/@me" >/dev/null; then
      echo "Discord reaction failed" >&2
      return 1
    fi
    local completion_lookup_status
    completion_lookup_status=0
    discord_completion_message_exists "$short_id" "$external_url" || completion_lookup_status=$?
    if [[ "$completion_lookup_status" -eq 0 ]]; then
      return
    fi
    if [[ "$completion_lookup_status" -ne 1 ]]; then
      return 1
    fi
    body="$(jq -n --arg content "$content" --arg channel "$DISCORD_CHANNEL_ID" --arg message "$message_id" \
      '{content:$content,allowed_mentions:{parse:[]},message_reference:{channel_id:$channel,message_id:$message,fail_if_not_exists:false}}')"
    if ! discord_api POST "/channels/${DISCORD_CHANNEL_ID}/messages" "$body" >/dev/null; then
      echo "Discord reply failed" >&2
      return 1
    fi
  else
    [[ "$DISCORD_FALLBACK" == "1" ]] || die "Discord message missing and fallback disabled"
    local completion_lookup_status
    completion_lookup_status=0
    discord_completion_message_exists "$short_id" "$external_url" || completion_lookup_status=$?
    if [[ "$completion_lookup_status" -eq 0 ]]; then
      return
    fi
    if [[ "$completion_lookup_status" -ne 1 ]]; then
      return 1
    fi
    local body
    body="$(jq -n --arg content "Sentry triage fallback for ${short_id}\n\n${content}" '{content:$content,allowed_mentions:{parse:[]}}')"
    if ! discord_api POST "/channels/${DISCORD_CHANNEL_ID}/messages" "$body" >/dev/null; then
      echo "Discord fallback message failed" >&2
      return 1
    fi
  fi
}

make_record() {
  local context="$1"
  local result_file="$2"
  local action_status="$3"
  local external_url="$4"
  local discord_message_id="$5"
  local last_error="$6"
  local completed="$7"
  local now issue_id short_id selected_action
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  issue_id="$(context_issue_id "$context")"
  short_id="$(context_short_id "$context" "$issue_id")"
  selected_action="$(jq -r '.action // empty' "$result_file")"
  jq -n \
    --arg sentryIssueId "$issue_id" \
    --arg shortId "$short_id" \
    --arg firstSeen "$(jq -r '.issue.firstSeen // .issue.first_seen // empty' <<<"$context")" \
    --arg lastSeenAtProcessing "$now" \
    --arg discordChannelId "${DISCORD_CHANNEL_ID:-}" \
    --arg discordMessageId "$discord_message_id" \
    --arg selectedAction "$selected_action" \
    --arg actionStatus "$action_status" \
    --arg externalUrl "$external_url" \
    --argjson attemptCount "$(issue_record "$issue_id" | jq '.attemptCount // 0 | . + 1')" \
    --arg lastError "$last_error" \
    --arg createdAt "$(issue_record "$issue_id" | jq -r '.createdAt // empty')" \
    --arg updatedAt "$now" \
    --arg completedAt "$completed" \
    --arg discordReply "$(jq -r '.discordReply // empty' "$result_file")" \
    --arg replayDays "$REPLAY_DAYS" \
    '{
      sentryIssueId:$sentryIssueId,
      shortId:$shortId,
      firstSeen:$firstSeen,
      lastSeenAtProcessing:$lastSeenAtProcessing,
      pollWatermark: $replayDays,
      discordChannelId:$discordChannelId,
      discordMessageId:$discordMessageId,
      selectedAction:$selectedAction,
      actionStatus:$actionStatus,
      externalUrl:$externalUrl,
      attemptCount:$attemptCount,
      lastError:$lastError,
      createdAt:(if $createdAt == "" then $updatedAt else $createdAt end),
      updatedAt:$updatedAt,
      completedAt:$completedAt,
      discordReply:$discordReply
    }'
}

process_context() {
  local context="$1"
  local issue_id short_id permalink status existing_record context_file result_file discord_message_id external_url action completed_at record_file
  issue_id="$(context_issue_id "$context")"
  [[ -n "$issue_id" ]] || die "Missing Sentry issue id in context"
  short_id="$(context_short_id "$context" "$issue_id")"
  permalink="$(context_permalink "$context")"
  status="$(issue_status "$issue_id")"

  if [[ "$status" == "completed" ]]; then
    log "INFO" "Skipping completed Sentry issue $issue_id"
    return
  fi

  existing_record="$(issue_record "$issue_id")"
  external_url="$(jq -r '.externalUrl // empty' <<<"$existing_record")"
  discord_message_id="$(jq -r '.discordMessageId // empty' <<<"$existing_record")"

  if [[ -z "$discord_message_id" ]]; then
    local lookup_error_file
    lookup_error_file="$(mktemp)"
    if ! discord_message_id="$(find_discord_message "$short_id" "$permalink" 2> "$lookup_error_file")"; then
      local lookup_error
      lookup_error="$(cat "$lookup_error_file" 2>/dev/null || true)"
      append_attempt_if_recording "$issue_id" "discord_lookup" "retryable" "${lookup_error:-Discord lookup failed}"
      record_file="$(mktemp)"
      result_file="$(mktemp)"
      jq -n --arg reply "Discord lookup failed for ${short_id}; retrying later." \
        '{action:"cause_only",confidence:"low",summary:"Discord lookup failed",rootCause:"Discord message lookup failed before triage completion.",evidence:["discord lookup failure"],requiresLargeRefactor:false,discordReply:$reply}' > "$result_file"
      make_record "$context" "$result_file" "planned" "" "" "${lookup_error:-Discord lookup failed}" "" > "$record_file"
      if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
        write_issue_record "$issue_id" "$record_file"
      fi
      rm -f "$lookup_error_file" "$record_file" "$result_file"
      log "WARN" "Discord lookup failed for $issue_id; left retryable"
      return 1
    fi
    rm -f "$lookup_error_file"
  fi

  if [[ -z "$discord_message_id" && "$DISCORD_FALLBACK" != "1" ]]; then
    append_attempt_if_recording "$issue_id" "discord_lookup" "retryable" "Discord Sentry message not found"
    record_file="$(mktemp)"
    result_file="$(mktemp)"
    jq -n --arg reply "Discord Sentry message not found for ${short_id}; retrying later." \
      '{action:"cause_only",confidence:"low",summary:"Discord message missing",rootCause:"Discord Sentry message was not found.",evidence:["discord lookup"],requiresLargeRefactor:false,discordReply:$reply}' > "$result_file"
    make_record "$context" "$result_file" "planned" "" "" "Discord Sentry message not found" "" > "$record_file"
    if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
      write_issue_record "$issue_id" "$record_file"
    fi
    rm -f "$record_file" "$result_file"
    log "WARN" "Discord message missing for $issue_id; left retryable"
    return
  fi

  context_file="$(mktemp)"
  result_file="$(mktemp)"
  printf '%s\n' "$context" > "$context_file"

  if [[ "$status" == "external_created" && -n "$external_url" ]]; then
    log "INFO" "Resuming partial success for $issue_id with $external_url"
    jq -n \
      --arg action "$(jq -r '.selectedAction // "github_issue"' <<<"$existing_record")" \
      --arg reply "$(jq -r '.discordReply // "Triage action already created; completing Discord update."' <<<"$existing_record")" \
      '{action:$action,confidence:"medium",summary:"Resuming partial success",rootCause:"External artifact already exists.",evidence:["local ledger externalUrl"],requiresLargeRefactor:false,discordReply:$reply}' > "$result_file"
  else
    local codex_error
    if ! codex_error="$(run_codex_triage "$context_file" "$result_file" 2>&1)"; then
      printf '%s\n' "$codex_error" >&2
      append_attempt_if_recording "$issue_id" "codex_triage" "retryable" "${codex_error:-Codex triage failed}"
      jq -n --arg reply "Codex triage failed for ${short_id}; retrying later." \
        '{action:"cause_only",confidence:"low",summary:"Codex triage failed",rootCause:"Codex triage did not return a usable result.",evidence:["codex triage failure"],requiresLargeRefactor:false,discordReply:$reply}' > "$result_file"
      record_file="$(mktemp)"
      make_record "$context" "$result_file" "planned" "" "$discord_message_id" "${codex_error:-Codex triage failed}" "" > "$record_file"
      if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
        write_issue_record "$issue_id" "$record_file"
      fi
      rm -f "$context_file" "$result_file" "$record_file"
      return 1
    fi
    if [[ -n "$codex_error" ]]; then
      printf '%s\n' "$codex_error" >&2
    fi
    if ! validate_triage_result "$result_file"; then
      local validation_error
      validation_error="Codex triage result failed validation for $issue_id"
      append_attempt_if_recording "$issue_id" "codex_triage" "retryable" "$validation_error"
      jq -n --arg reply "Codex triage output was invalid for ${short_id}; retrying later." \
        '{action:"cause_only",confidence:"low",summary:"Codex triage output invalid",rootCause:"Codex did not return schema-valid one-action output.",evidence:["schema validation failure"],requiresLargeRefactor:false,discordReply:$reply}' > "$result_file"
      record_file="$(mktemp)"
      make_record "$context" "$result_file" "planned" "" "$discord_message_id" "$validation_error" "" > "$record_file"
      if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
        write_issue_record "$issue_id" "$record_file"
      fi
      rm -f "$context_file" "$result_file" "$record_file"
      return 1
    fi
    action="$(jq -r '.action' "$result_file")"
    log "INFO" "Selected action=$action for $issue_id"

    record_file="$(mktemp)"
    make_record "$context" "$result_file" "planned" "" "$discord_message_id" "" "" > "$record_file"
    if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
      write_issue_record "$issue_id" "$record_file"
      append_attempt_if_recording "$issue_id" "action" "planned" "" ""
    fi
    rm -f "$record_file"

    local action_output_file action_error_file action_error
    action_output_file="$(mktemp)"
    action_error_file="$(mktemp)"
    if ! {
      case "$action" in
        github_issue)
          create_github_issue "$result_file" "$issue_id" > "$action_output_file" 2> "$action_error_file"
          ;;
        pr)
          run_pr_implementation "$result_file" "$issue_id" "$short_id" "$context_file" > "$action_output_file" 2> "$action_error_file"
          ;;
        cause_only)
          : > "$action_output_file"
          ;;
        *)
          echo "Unsupported action: $action" >&2
          exit 1
          ;;
      esac
    }; then
      action_error="$(cat "$action_error_file" 2>/dev/null || true)"
      printf '%s\n' "$action_error" >&2
      append_attempt_if_recording "$issue_id" "action" "retryable" "${action_error:-Action execution failed}" ""
      record_file="$(mktemp)"
      make_record "$context" "$result_file" "planned" "" "$discord_message_id" "${action_error:-Action execution failed}" "" > "$record_file"
      if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
        write_issue_record "$issue_id" "$record_file"
      fi
      rm -f "$context_file" "$result_file" "$record_file" "$action_output_file" "$action_error_file"
      return 1
    fi
    external_url="$(cat "$action_output_file")"
    rm -f "$action_output_file" "$action_error_file"
    if [[ "$action" != "cause_only" && -z "$external_url" ]]; then
      append_attempt_if_recording "$issue_id" "action" "retryable" "Action returned empty external URL" ""
      record_file="$(mktemp)"
      make_record "$context" "$result_file" "planned" "" "$discord_message_id" "Action returned empty external URL" "" > "$record_file"
      if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
        write_issue_record "$issue_id" "$record_file"
      fi
      rm -f "$context_file" "$result_file" "$record_file"
      return 1
    fi

    record_file="$(mktemp)"
    make_record "$context" "$result_file" "external_created" "$external_url" "$discord_message_id" "" "" > "$record_file"
    if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
      write_issue_record "$issue_id" "$record_file"
      append_attempt_if_recording "$issue_id" "action" "external_created" "" "$external_url"
    fi
    rm -f "$record_file"
  fi

  local discord_error failed_status
  if ! discord_error="$(discord_complete "$discord_message_id" "$(jq -r '.discordReply' "$result_file")" "$external_url" "$short_id" 2>&1)"; then
    printf '%s\n' "$discord_error" >&2
    append_attempt_if_recording "$issue_id" "discord" "retryable" "${discord_error:-Discord completion failed}" "$external_url"
    failed_status="planned"
    if [[ -n "$external_url" ]]; then
      failed_status="external_created"
    fi
    record_file="$(mktemp)"
    make_record "$context" "$result_file" "$failed_status" "$external_url" "$discord_message_id" "${discord_error:-Discord completion failed}" "" > "$record_file"
    if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
      write_issue_record "$issue_id" "$record_file"
    fi
    rm -f "$context_file" "$result_file" "$record_file"
    return 1
  fi
  if [[ -n "$discord_error" ]]; then
    printf '%s\n' "$discord_error" >&2
  fi
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  record_file="$(mktemp)"
  make_record "$context" "$result_file" "completed" "$external_url" "$discord_message_id" "" "$completed_at" > "$record_file"
  if [[ "$DRY_RUN" -eq 0 || "$RECORD_DRY_RUN" -eq 1 ]]; then
    write_issue_record "$issue_id" "$record_file"
    append_attempt_if_recording "$issue_id" "discord" "completed" "" "$external_url"
  fi
  rm -f "$context_file" "$result_file" "$record_file"
  log "INFO" "Completed triage for $issue_id actionStatus=completed externalUrl=${external_url:-none}"
}

main() {
  log "INFO" "Sentry triage start dryRun=$DRY_RUN fixture=${FIXTURE_FILE:-none} replayDays=$REPLAY_DAYS"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "INFO" "Another sentry-triage process is active; skipping"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    bootstrap_preflight_attempt_without_jq "Missing required command: jq"
    log "ERROR" "Missing required command: jq"
    return 1
  fi
  init_state

  local preflight_output
  if ! preflight_output="$(preflight 2>&1)"; then
    printf '%s\n' "$preflight_output" >&2
    append_preflight_attempt "${preflight_output:-preflight failed}"
    return 1
  fi
  if [[ -n "$preflight_output" ]]; then
    printf '%s\n' "$preflight_output" >&2
  fi

  if [[ "$CHECK_PREFLIGHT_ONLY" -eq 1 ]]; then
    log "INFO" "Preflight OK"
    return
  fi

  if [[ -n "$FIXTURE_FILE" ]]; then
    process_context "$(fixture_issue_context)"
    return
  fi

  local issues count index issue run_failed
  local poll_error_file
  poll_error_file="$(mktemp)"
  if ! issues="$(poll_sentry_issues 2> "$poll_error_file")"; then
    local poll_error
    poll_error="$(cat "$poll_error_file" 2>/dev/null || true)"
    printf '%s\n' "$poll_error" >&2
    append_attempt_if_recording "__poll__" "sentry_poll" "retryable" "${poll_error:-Sentry poll failed}"
    rm -f "$poll_error_file"
    return 1
  fi
  rm -f "$poll_error_file"
  count="$(jq 'length' <<<"$issues")"
  log "INFO" "Fetched $count Sentry issue candidate(s)"
  index=0
  run_failed=0
  while [[ "$index" -lt "$count" ]]; do
    issue="$(jq -c ".[$index]" <<<"$issues")"
    local issue_id context_error_file context
    issue_id="$(jq -r '.id // empty' <<<"$issue")"
    context_error_file="$(mktemp)"
    if ! context="$(real_issue_context "$issue" 2> "$context_error_file")"; then
      local context_error
      context_error="$(cat "$context_error_file" 2>/dev/null || true)"
      append_attempt_if_recording "${issue_id:-__fetch__}" "sentry_fetch" "retryable" "${context_error:-Sentry issue fetch failed}"
      log "WARN" "Sentry issue fetch failed for ${issue_id:-unknown}; continuing"
      run_failed=1
      rm -f "$context_error_file"
      index=$((index + 1))
      continue
    fi
    rm -f "$context_error_file"
    if ! process_context "$context"; then
      log "WARN" "Sentry issue processing failed for ${issue_id:-unknown}; continuing"
      run_failed=1
    fi
    index=$((index + 1))
  done
  log "INFO" "Sentry triage done"
  if [[ "$run_failed" -ne 0 ]]; then
    return 1
  fi
}

main "$@"
