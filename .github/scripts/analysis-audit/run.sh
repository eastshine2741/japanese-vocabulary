#!/usr/bin/env bash
# Analysis audit runner.
#
# Reads every song analysis that finished since the last run from admin-api, checks it with fixed
# rules (checks.py) and with one model pass over the whole song, and opens one GitHub issue per song
# that has a problem. The model only reads; what is new, what gets reported and the issue text are
# decided here.
#
# See README.md next to this file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

STATE_DIR="${ANALYSIS_AUDIT_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/kotonoha-analysis-audit}"
LEDGER_FILE="$STATE_DIR/ledger.json"
LOG_DIR="$STATE_DIR/logs"

ADMIN_API_BASE="${ADMIN_API_BASE:-https://kotonoha.eastshine.dev/admin/api}"
ADMIN_WEB_BASE="${ADMIN_WEB_BASE:-https://kotonoha.eastshine.dev/admin}"
# Works that finished within this window and are not in the ledger get audited. The first run
# starts here instead of auditing the whole history.
WINDOW_HOURS="${ANALYSIS_AUDIT_WINDOW_HOURS:-48}"
# Songs audited per run, oldest first. The rest wait for the next run.
MAX_SONGS="${ANALYSIS_AUDIT_MAX_SONGS:-10}"
# Attempts per song, the first included, when the audit itself fails (admin-api, model, GitHub).
MAX_ATTEMPTS="${ANALYSIS_AUDIT_MAX_ATTEMPTS:-2}"
# Bounds for one admin-api/oEmbed request and one model pass. A hung oneshot keeps the timer from
# starting the next run, so a stall would stop auditing without an error.
HTTP_TIMEOUT=30
MODEL_TIMEOUT=10m
# GitHub rejects an issue body over 65536 characters.
MAX_BODY_CHARS=60000
MODEL="${ANALYSIS_AUDIT_MODEL:-sonnet}"
MAX_BUDGET_USD="${ANALYSIS_AUDIT_MAX_BUDGET_USD:-1}"
LABEL="${ANALYSIS_AUDIT_LABEL:-analysis-audit}"

DRY_RUN=0
CHECK_PREFLIGHT=0
ONLY_WORK=""

usage() {
  cat <<'USAGE'
Usage: run.sh [--dry-run] [--work ID] [--check-preflight] [--state-file FILE]

  --dry-run          Audit and print each issue body, but open no issue and leave the ledger alone.
  --work ID          Audit this one work even if the ledger has it (still records it unless --dry-run).
  --check-preflight  Verify tools, admin-api and GitHub access, then exit.
  --state-file FILE  Ledger path (default: $XDG_STATE_HOME/kotonoha-analysis-audit/ledger.json).
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --work) ONLY_WORK="$2"; shift ;;
    --check-preflight) CHECK_PREFLIGHT=1 ;;
    --state-file) LEDGER_FILE="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

mkdir -p "$STATE_DIR" "$LOG_DIR" "$(dirname "$LEDGER_FILE")"
LOG_FILE="$LOG_DIR/analysis-audit-$(date +%Y%m%d).log"

log() {
  local level="$1"; shift
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$*" | tee -a "$LOG_FILE" >&2
}

die() { log "ERROR" "$*"; exit 1; }

TMP_DIR="$(mktemp -d)"
RUN_RECORD_DIR="${KOTONOHA_RUN_RECORD_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/kotonoha-runners}"
# daily-digest reports a runner as stopped when this record goes stale. Dry, single-work and
# preflight runs say nothing about the timer, so they leave it alone.
record_run() {
  local code="$1" f="$RUN_RECORD_DIR/analysis-audit.json"
  [[ $DRY_RUN == 0 && -z "$ONLY_WORK" && $CHECK_PREFLIGHT == 0 ]] || return 0
  mkdir -p "$RUN_RECORD_DIR" 2>/dev/null || return 0
  jq -n --arg at "$(date -Iseconds)" --argjson code "$code" \
    '{name: "analysis-audit", finishedAt: $at, exitCode: $code}' > "$f.tmp" && mv "$f.tmp" "$f" || true
}
trap 'code=$?; rm -rf "$TMP_DIR"; record_run "$code"' EXIT

admin_get() {
  curl -sS --fail-with-body --max-time "$HTTP_TIMEOUT" -H "Authorization: Bearer $ANALYSIS_AUDIT_TOKEN" "$ADMIN_API_BASE$1"
}

preflight() {
  local tool
  for tool in jq curl gh claude python3; do
    command -v "$tool" >/dev/null 2>&1 || die "Missing tool: $tool"
  done
  [[ -n "${ANALYSIS_AUDIT_TOKEN:-}" ]] || die "ANALYSIS_AUDIT_TOKEN is required"
  admin_get "/song-analysis-works?status=COMPLETED&size=1" | jq -e '.content|type=="array"' >/dev/null \
    || die "admin-api did not return song analysis works"
  gh auth status >/dev/null 2>&1 || die "gh is not authenticated"
  if [[ $DRY_RUN -eq 0 ]] && ! gh label list --limit 200 --json name -q '.[].name' | grep -qx "$LABEL"; then
    gh label create "$LABEL" --color FBCA04 --description "곡 분석 결과 자동 감사" >/dev/null \
      || die "Could not create the $LABEL label"
  fi
  if [[ ! -f "$LEDGER_FILE" ]]; then
    # A dry run reads an empty ledger without creating the real one.
    [[ $DRY_RUN -eq 1 ]] && LEDGER_FILE="$TMP_DIR/ledger-empty.json"
    printf '{"version":1,"works":{}}\n' > "$LEDGER_FILE"
  fi
  jq -e '.version==1 and (.works|type=="object")' "$LEDGER_FILE" >/dev/null || die "Ledger is not readable: $LEDGER_FILE"
}

# {"version":1,"works":{"<workId>":{status,attempts,auditedAt,songId,title,artist,summary,issueUrl}}}
#
# status: clean | reported | failed
#   clean     audited, nothing to report
#   reported  an issue was opened (issueUrl)
#   failed    the audit itself failed; retried until attempts reaches MAX_ATTEMPTS
ledger_put() {
  local work_id="$1" patch="$2"
  [[ $DRY_RUN -eq 1 ]] && return 0
  local out="$TMP_DIR/ledger.json"
  # An unchecked mv would replace the ledger with an empty file, and every audited song would get a
  # second issue once someone deletes it.
  jq --arg id "$work_id" --argjson patch "$patch" '.works[$id] = ((.works[$id] // {attempts: 0}) + $patch)' \
    "$LEDGER_FILE" > "$out" && mv "$out" "$LEDGER_FILE" || { log "ERROR" "Ledger update failed for work $work_id"; return 1; }
}

# Completed works to audit, oldest first, one JSON object per line. Every completed work is read:
# pages run by id, and a resumed old work completes long after its id's neighbours, so no page
# boundary says the rest are outside the window.
pending_works() {
  local auditable='select(.status == "COMPLETED" and .lyricId != null and .completedAt != null)'
  if [[ -n "$ONLY_WORK" ]]; then
    admin_get "/song-analysis-works/$ONLY_WORK" | jq -c "$auditable"
    return
  fi
  local cutoff page=0 body
  cutoff="$(date -u -d "-${WINDOW_HOURS} hours" '+%Y-%m-%dT%H:%M:%S')"
  local all="$TMP_DIR/works.jsonl"
  : > "$all"
  while :; do
    body="$(admin_get "/song-analysis-works?status=COMPLETED&size=200&page=$page")" || die "Fetching works page $page failed"
    jq -c '.content[]' <<<"$body" >> "$all"
    jq -e '.last' <<<"$body" >/dev/null && break
    page=$((page + 1))
    [[ $page -lt 50 ]] || { log "WARN" "Stopped after 50 pages of completed works; older ones are not considered"; break; }
  done
  jq -c --arg cutoff "$cutoff" --argjson max "$MAX_SONGS" --argjson attempts "$MAX_ATTEMPTS" \
    --slurpfile ledger "$LEDGER_FILE" -s '
    $ledger[0].works as $done
    | [.[] | '"$auditable"' | select(.completedAt >= $cutoff)
       | select(($done[.id|tostring]) as $d | $d == null or ($d.status == "failed" and $d.attempts < $attempts))]
    | sort_by(.completedAt) | .[:$max][]' "$all"
}

# The issue for a work, if one exists. A `gh issue create` that timed out after GitHub took it would
# otherwise get a second issue on the retry.
existing_issue() {
  gh issue list --label "$LABEL" --state all --search "\"workId=$1,\" in:body" --json url -q '.[0].url // empty'
}

# oEmbed answers for any public video without a key; status 0 means YouTube did not answer.
fetch_mv() {
  local url="$1" out="$2"
  if [[ -z "$url" ]]; then printf '{"status":null}\n' > "$out"; return; fi
  local body="$TMP_DIR/oembed.json" status
  status="$(curl -sS --max-time "$HTTP_TIMEOUT" -o "$body" -w '%{http_code}' --get --data-urlencode "url=$url" -d format=json \
    https://www.youtube.com/oembed 2>/dev/null)" || status=0
  if [[ "$status" == "200" ]]; then
    jq '{status: 200, title, author_name}' "$body" > "$out"
  else
    jq -n --argjson s "${status:-0}" '{status: $s}' > "$out"
  fi
}

# One model pass over the song. No tools: the lyric is untrusted text and the pass only judges it.
#   audit_with_model <checked.json> <result.json>
audit_with_model() {
  local checked="$1" result="$2" out="$TMP_DIR/claude.json" prompt="$TMP_DIR/prompt.md"
  { cat "$SCRIPT_DIR/prompts/audit.md"; printf '\n```\n'; jq -r '.promptText' "$checked"; printf '```\n'; } > "$prompt"
  # Scrubbed environment: the model gets no admin or GitHub credentials. HOME stays so the CLI finds
  # its own auth; ANTHROPIC_*/CLAUDE_* pass through for people who run it with an API key.
  local passthrough=() var
  for var in $(compgen -e | grep -E '^(ANTHROPIC_|CLAUDE_)' || true); do
    passthrough+=("$var=${!var}")
  done
  if ! (cd "$TMP_DIR" && env -i HOME="$HOME" PATH="$PATH" TERM=dumb LANG="${LANG:-C.UTF-8}" "${passthrough[@]}" \
      timeout "$MODEL_TIMEOUT" claude -p \
        --model "$MODEL" \
        --output-format json \
        --json-schema "$(cat "$SCRIPT_DIR/schemas/audit.schema.json")" \
        --tools "" \
        --strict-mcp-config \
        --no-session-persistence \
        --max-budget-usd "$MAX_BUDGET_USD" \
        < "$prompt" > "$out" 2>>"$LOG_FILE"); then
    log "ERROR" "claude exited non-zero"
    return 1
  fi
  if ! jq -e '.is_error == false and (.structured_output|type=="object")' "$out" >/dev/null; then
    log "ERROR" "claude returned no structured output: $(jq -c 'del(.usage,.modelUsage)' "$out" | head -c 600)"
    return 1
  fi
  log "INFO" "Model pass cost \$$(jq -r '.total_cost_usd * 1000 | round / 1000' "$out")"
  jq -c '.structured_output | .findings |= map(. + {source: "model"})' "$out" > "$result"
}

# Issue body from data. The model's sentences are quoted as findings, never as the frame.
#   issue_body <work.json> <mv.json> <audit.json>   (audit: {summary, findings})
issue_body() {
  jq -rn --slurpfile w "$1" --slurpfile mv "$2" --slurpfile a "$3" \
    --arg admin "$ADMIN_WEB_BASE" --arg model "$MODEL" '
    $w[0] as $w | $mv[0] as $mv | $a[0].summary as $summary | $a[0].findings as $f
    # Lyric and model text: a stray @name would notify that GitHub user, a backtick would break the span.
    | def quiet: gsub("@"; "@​");
    def item:
      "- [ ] "
      + (if .lineIndex != null then "**\(.lineIndex)번 줄** " else "" end)
      + (if .target != null then "`\(.target | gsub("`"; "'"'"'") | quiet)` " else "" end)
      + (.problem | quiet)
      + (if .source == "rule" then " _(규칙)_" elif .confidence == "medium" then " _(추정)_" else "" end)
      + (if .evidence != null then "\n  > \(.evidence | gsub("\n"; " ") | quiet)" else "" end)
      + (if .suggestion != null then "\n  → \(.suggestion | quiet)" else "" end);
    def category_name: {
      LYRICS_WRONG_SONG: "다른 곡의 가사", LYRICS_NOT_JAPANESE: "일본어가 아닌 가사", LYRICS_BROKEN: "깨진 가사",
      ANALYSIS_BROKEN: "빠진 분석", MV_MISSING: "MV 없음", MV_MISMATCH: "MV 오류",
      TRANSLATION: "줄 번역", SEGMENTATION: "형태소 분절", MEANING: "단어 뜻"}[.];
    def order($c): ["LYRICS_WRONG_SONG","LYRICS_NOT_JAPANESE","LYRICS_BROKEN","ANALYSIS_BROKEN","MV_MISSING",
                "MV_MISMATCH","TRANSLATION","SEGMENTATION","MEANING"] | index($c);
    def item:
      "- [ ] "
      + (if .lineIndex != null then "**\(.lineIndex)번 줄** " else "" end)
      + (if .target != null then "`\(.target)` " else "" end)
      + .problem
      + (if .source == "rule" then " _(규칙)_" elif .confidence == "medium" then " _(추정)_" else "" end)
      + (if .evidence != null then "\n  > \(.evidence | gsub("\n"; " "))" else "" end)
      + (if .suggestion != null then "\n  → \(.suggestion)" else "" end);
    "## 곡",
    "",
    "- 「\($w.rawTitle)」 / \($w.rawArtist)",
    "- 어드민: \($admin)/songs/\($w.songId) (songId=\($w.songId), workId=\($w.id), lyricId=\($w.lyricId), \($w.triggerSource))",
    "- MV: " + (if $w.youtubeUrl == null then "없음"
                elif $mv.status == 200 then "\($w.youtubeUrl) — 「\($mv.title)」, 채널 「\($mv.author_name)」"
                else $w.youtubeUrl end),
    "- 분석 완료: \($w.completedAt[:16] | sub("T"; " ")) UTC",
    "",
    "> \($summary | quiet)",
    "",
    ($f | group_by(.category) | sort_by(order(.[0].category)) | .[]
      | "## \(.[0].category | category_name) (\(length))", "", (.[] | item), ""),
    "---",
    "`.github/scripts/analysis-audit` 가 올린 issue. _(규칙)_ 은 고정 규칙, 나머지는 \($model) 판정이고 _(추정)_ 은 확신이 덜한 것."
  '
}

# audit_work runs under `if !`, where set -e is off, so every step that can fail returns 1 itself.
# Song data goes through files, not arguments: a long song's JSON passes the 128 KiB argv limit.
audit_work() {
  local work="$1"
  local id lyric_id
  id="$(jq -r '.id' <<<"$work")"; lyric_id="$(jq -r '.lyricId' <<<"$work")"
  log "INFO" "Auditing work $id 「$(jq -r '.rawTitle' <<<"$work")」 / $(jq -r '.rawArtist' <<<"$work")"

  local detail="$TMP_DIR/work.json" lyric="$TMP_DIR/lyric.json" mv="$TMP_DIR/mv.json"
  local checked="$TMP_DIR/checked.json" model="$TMP_DIR/model.json" audit="$TMP_DIR/audit.json"
  admin_get "/song-analysis-works/$id" > "$detail" || { log "ERROR" "Fetching work $id failed"; return 1; }
  admin_get "/lyrics/$lyric_id" > "$lyric" || { log "ERROR" "Fetching lyric $lyric_id failed"; return 1; }
  fetch_mv "$(jq -r '.youtubeUrl // empty' "$detail")" "$mv" || { log "ERROR" "Reading the MV failed for work $id"; return 1; }
  python3 -I "$SCRIPT_DIR/checks.py" "$detail" "$lyric" "$mv" > "$checked" || { log "ERROR" "checks.py failed on work $id"; return 1; }
  audit_with_model "$checked" "$model" || return 1
  jq -cs '{summary: .[1].summary, findings: (.[0].findings + .[1].findings)}' "$checked" "$model" > "$audit" \
    || { log "ERROR" "Merging findings failed for work $id"; return 1; }

  local count base
  count="$(jq '.findings | length' "$audit")"
  [[ "$count" =~ ^[0-9]+$ ]] || { log "ERROR" "Unreadable findings for work $id"; return 1; }
  base="$(jq -c --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" --slurpfile w "$detail" \
    '{songId: $w[0].songId, title: $w[0].rawTitle, artist: $w[0].rawArtist, summary, auditedAt: $now}' "$audit")" \
    || { log "ERROR" "Building the ledger entry failed for work $id"; return 1; }

  if [[ "$count" -eq 0 ]]; then
    log "INFO" "Work $id: nothing to report"
    ledger_put "$id" "$(jq -c '. + {status: "clean"}' <<<"$base")"
    return
  fi
  log "INFO" "Work $id: $count finding(s) $(jq -c '.findings | group_by(.category) | map({(.[0].category): length}) | add' "$audit")"

  local title body_file="$TMP_DIR/issue.md"
  title="$(jq -r --slurpfile w "$detail" '"분석 감사: 「\($w[0].rawTitle)」 / \($w[0].rawArtist) (\(.findings | length)건)"' "$audit")"
  issue_body "$detail" "$mv" "$audit" > "$body_file" || { log "ERROR" "Building the issue body failed for work $id"; return 1; }
  if [[ "$(wc -m < "$body_file")" -gt $MAX_BODY_CHARS ]]; then
    { head -c "$MAX_BODY_CHARS" "$body_file" | iconv -c -f UTF-8 -t UTF-8; printf '\n\n…(길어서 잘림)\n'; } > "$body_file.cut"
    mv "$body_file.cut" "$body_file"
  fi
  if [[ $DRY_RUN -eq 1 ]]; then
    log "INFO" "[dry-run] would open: $title"
    cat "$body_file" >&2
    return 0
  fi
  local url
  url="$(existing_issue "$id")" || { log "ERROR" "Searching for an existing issue failed for work $id"; return 1; }
  if [[ -n "$url" ]]; then
    log "INFO" "Work $id already has $url"
  else
    url="$(gh issue create --title "$title" --body-file "$body_file" --label "$LABEL")" \
      || { log "ERROR" "gh issue create failed for work $id"; return 1; }
    log "INFO" "Issue opened: $url"
  fi
  ledger_put "$id" "$(jq -c --arg u "$url" '. + {status: "reported", issueUrl: $u}' <<<"$base")"
}

main() {
  preflight
  if [[ $CHECK_PREFLIGHT -eq 1 ]]; then log "INFO" "Preflight OK"; exit 0; fi
  log "INFO" "Analysis audit start dryRun=$DRY_RUN window=${WINDOW_HOURS}h max=$MAX_SONGS model=$MODEL ledger=$LEDGER_FILE"

  local works="$TMP_DIR/pending.jsonl"
  pending_works > "$works"
  log "INFO" "$(wc -l < "$works") work(s) to audit"

  local work id
  while read -r work; do
    id="$(jq -r '.id' <<<"$work")"
    if ! audit_work "$work"; then
      local attempts
      attempts="$(jq -r --arg id "$id" '(.works[$id].attempts // 0) + 1' "$LEDGER_FILE")"
      ledger_put "$id" "$(jq -cn --argjson a "$attempts" '{status: "failed", attempts: $a}')"
      log "WARN" "Audit of work $id failed (attempt $attempts/$MAX_ATTEMPTS)"
    fi
  done < "$works"

  log "INFO" "Analysis audit done"
}

main "$@"
