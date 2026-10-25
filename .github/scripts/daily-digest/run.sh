#!/usr/bin/env bash
# Daily digest runner.
#
# Collects yesterday's business metrics (prod MySQL), golden-path funnel (GA4 BigQuery), the last
# 24h of infra (Prometheus) and errors (Sentry), user reports (song_reports, GitHub VOC issues) and
# the other local runners' last runs, then posts one digest to Discord. Every number comes from a
# collector; the model only picks which signals go to the top.
#
# See README.md next to this file.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${DAILY_DIGEST_REPO_DIR:-$(git -C "$SCRIPT_DIR/../../.." rev-parse --show-toplevel)}"
LIB_DIR="$SCRIPT_DIR/lib"

STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}"
STATE_DIR="${DAILY_DIGEST_STATE_DIR:-$STATE_ROOT/kotonoha-daily-digest}"
LOG_DIR="$STATE_DIR/logs"
# Other runners record their last run here (see record_run in analysis-feedback/run.sh).
RUN_RECORD_DIR="${KOTONOHA_RUN_RECORD_DIR:-$STATE_ROOT/kotonoha-runners}"
ANALYSIS_FEEDBACK_LEDGER="${ANALYSIS_FEEDBACK_LEDGER:-$STATE_ROOT/kotonoha-analysis-feedback/ledger.json}"

KUBE_CONTEXT="${DAILY_DIGEST_KUBE_CONTEXT:-kotonoha-prod}"
BQ_EVENTS_DATASET="japanese-vocabulary-490916:analytics_539684755"
SENTRY_BASE="${SENTRY_API_BASE:-https://sentry.io/api/0}"
RANK_MODEL="${DAILY_DIGEST_RANK_MODEL:-sonnet}"
CLAUDE_MAX_BUDGET_USD="${DAILY_DIGEST_MAX_BUDGET_USD:-1}"
# name:max-age-hours. A runner whose record is older than that, or missing, is reported as stopped.
EXPECTED_RUNNERS="${DAILY_DIGEST_EXPECTED_RUNNERS:-analysis-feedback:3 issue-resolver:2}"

DRY_RUN=0
USE_LLM=1
TARGET_DATE=""

usage() {
  cat <<'USAGE'
Usage: run.sh [--dry-run] [--no-llm] [--date YYYY-MM-DD]

  --dry-run   Collect and render, print the messages to stdout, do not post to Discord.
  --no-llm    Order the top signals by severity instead of asking the model.
  --date      Day the business metrics and funnel are about (KST). Default: yesterday.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-llm) USE_LLM=0 ;;
    --date) TARGET_DATE="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

export TZ=Asia/Seoul
TARGET_DATE="${TARGET_DATE:-$(date -d yesterday +%F)}"
[[ $TARGET_DATE =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "--date must be YYYY-MM-DD" >&2; exit 2; }
SINCE_ISO="$(date -d '24 hours ago' +%FT%T%:z)"

mkdir -p "$STATE_DIR" "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily-digest-$(date +%Y%m%d).log"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

log() {
  local level="$1"; shift
  printf '%s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$*" | tee -a "$LOG_FILE" >&2
}

preflight() {
  local tool
  for tool in jq curl git gh kubectl bq; do
    command -v "$tool" >/dev/null 2>&1 || { log "ERROR" "Missing tool: $tool"; exit 1; }
  done
  [[ $USE_LLM == 0 ]] || command -v claude >/dev/null 2>&1 || { log "ERROR" "Missing tool: claude"; exit 1; }
  [[ $DRY_RUN == 1 ]] || : "${DISCORD_DIGEST_WEBHOOK_URL:?DISCORD_DIGEST_WEBHOOK_URL is required}"
}

# Runs one collector into $WORK_DIR/<name>.json. A failing collector leaves {"error": ...} so the
# digest still goes out and says which section is missing.
collect() {
  local name="$1"; shift
  local out="$WORK_DIR/$name.json" err="$WORK_DIR/$name.err"
  # Subshell, so a collector that exits (a ${x:?} or set -e) only loses its own section.
  if ( "$@" ) > "$out" 2> "$err" && jq -e . "$out" >/dev/null 2>&1; then
    log "INFO" "collected $name"
  else
    log "WARN" "collector $name failed: $(tail -c 300 "$err" | tr '\n' ' ')"
    jq -n --arg e "$(head -n 1 "$err" | head -c 200)" '{error: (if $e == "" then "unknown" else $e end)}' > "$out"
  fi
}

mysql_json() {
  kubectl --context "$KUBE_CONTEXT" -n kotonoha exec -i mysql-0 -- \
    sh -c 'mysql -N -B --raw -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" 2>/dev/null'
}

collect_business() {
  { printf "SET @d = '%s';\n" "$TARGET_DATE"; cat "$SCRIPT_DIR/queries/business.sql"; } | mysql_json
}

collect_funnel() {
  local end start provisional=true rows
  end="$(date -d "$TARGET_DATE" +%Y%m%d)"
  start="$(date -d "$TARGET_DATE - 7 days" +%Y%m%d)"
  # The daily export for yesterday usually lands around 10:00 KST, after this runs; until then
  # yesterday exists only as the intraday table and the numbers are provisional.
  bq show "$BQ_EVENTS_DATASET.events_$end" >/dev/null 2>&1 && provisional=false
  rows="$(bq query --quiet --use_legacy_sql=false --format=json \
    --parameter="start::$start" --parameter="end::$end" \
    --parameter="excl_start::$(date -d "$TARGET_DATE - 30 days" +%Y%m%d)" --parameter="today::$(date +%Y%m%d)" \
    < "$SCRIPT_DIR/queries/funnel.sql")"
  jq -n --argjson rows "$rows" --arg date "$end" --argjson provisional "$provisional" \
    '{date: $date, provisional: $provisional,
      days: [$rows[] | with_entries(if .key == "date" then . else .value |= tonumber end)]}'
}

prom() {
  kubectl --context "$KUBE_CONTEXT" get --raw \
    "/api/v1/namespaces/monitoring/services/kps-prometheus:9090/proxy/api/v1/query?query=$(jq -rn --arg s "$1" '$s|@uri')" \
    | jq -e '.data.result'
}

collect_infra() {
  local f="$WORK_DIR/prom"; mkdir -p "$f"
  # One row per alert name: some rules fire as both warning and critical, keep the worse one.
  prom 'max by (alertname) (max_over_time(ALERTS{alertstate="firing", severity="critical"}[24h])) * 2 or max by (alertname) (max_over_time(ALERTS{alertstate="firing", severity="warning"}[24h]))' > "$f/alerts"
  prom 'round(sum by (pod) (increase(kube_pod_container_status_restarts_total{namespace="kotonoha"}[24h]))) > 0' > "$f/restarts"
  prom 'max by (pod) (kube_pod_container_status_last_terminated_reason{namespace="kotonoha", reason="OOMKilled"}) * on (pod) group_left () (sum by (pod) (increase(kube_pod_container_status_restarts_total{namespace="kotonoha"}[24h])) > 0)' > "$f/oom"
  prom '(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * on (instance) group_left (nodename) node_uname_info' > "$f/disk"
  prom '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * on (instance) group_left (nodename) node_uname_info' > "$f/mem"
  # Prometheus scrapes /actuator every few seconds; counting it would bury real traffic.
  prom 'round(sum by (application, outcome) (increase(http_server_requests_seconds_count{uri!~"/actuator.*"}[24h])))' > "$f/http"
  prom 'round(sum by (outcome, failed_stage, error_code) (increase(kotonoha_song_analysis_work_duration_seconds_count[24h])))' > "$f/analysis"
  prom 'max(kotonoha_song_analysis_oldest_pending_age_seconds)' > "$f/pending"
  prom 'max by (queue) (rabbitmq_detailed_queue_messages)' > "$f/queues"
  prom 'sum(increase(kotonoha_llm_cost_usd_total[24h]))' > "$f/cost"
  jq -n \
    --slurpfile alerts "$f/alerts" --slurpfile restarts "$f/restarts" --slurpfile oom "$f/oom" \
    --slurpfile disk "$f/disk" --slurpfile mem "$f/mem" --slurpfile http "$f/http" \
    --slurpfile analysis "$f/analysis" --slurpfile pending "$f/pending" --slurpfile queues "$f/queues" \
    --slurpfile cost "$f/cost" '
    def v: .value[1] | tonumber;
    {
      alerts: [$alerts[0][] | {name: .metric.alertname, severity: (if v >= 2 then "critical" else "warning" end)}],
      restarts: [$restarts[0][] | {pod: .metric.pod, count: v}],
      oom: [$oom[0][] | .metric.pod],
      disk: [$disk[0][] | {node: .metric.nodename, used: v}],
      mem: [$mem[0][] | {node: .metric.nodename, used: v}],
      http: ($http[0] | group_by(.metric.application) | map({
        app: .[0].metric.application,
        total: (map(v) | add),
        server_error: (map(select(.metric.outcome == "SERVER_ERROR") | v) | add // 0)})),
      analysis: {
        success: ($analysis[0] | map(select(.metric.outcome == "success") | v) | add // 0),
        failed: [$analysis[0][] | select(.metric.outcome != "success" and v > 0)
                 | {stage: (.metric.failed_stage // "unknown"), code: (.metric.error_code // "unknown"), count: v}],
        oldest_pending_sec: ($pending[0][0] | if . then v else 0 end)
      },
      queues: [$queues[0][] | {queue: .metric.queue, messages: v}],
      llm_cost_usd: ($cost[0][0] | if . then v else 0 end)
    }'
}

collect_sentry() {
  [[ -n "${SENTRY_AUTH_TOKEN:-}" && -n "${SENTRY_ORG:-}" ]] || { echo "SENTRY_AUTH_TOKEN/SENTRY_ORG missing" >&2; return 1; }
  curl -fsS -G -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
    "$SENTRY_BASE/organizations/$SENTRY_ORG/issues/" \
    --data-urlencode 'query=is:unresolved firstSeen:-24h' \
    --data-urlencode 'statsPeriod=24h' \
    --data-urlencode 'project=-1' \
    --data-urlencode 'sort=freq' \
    --data-urlencode 'limit=25' \
    | jq '{new_issues: [.[] | {title, level, count: (.count | tonumber), project: .project.slug, url: .permalink}],
           truncated: (length >= 25)}'
}

collect_github() {
  local voc_new voc_open plan_ready prs
  voc_new="$(gh issue list -R "$GH_REPO" --label type:voc --state all --search "created:>=$SINCE_ISO" \
    --json number,title,url --limit 50)"
  voc_open="$(gh issue list -R "$GH_REPO" --label type:voc --state open --json number --limit 500 --jq length)"
  # issue-resolver stops at plan-ready until someone approves the plan.
  plan_ready="$(gh issue list -R "$GH_REPO" --label status:plan-ready --state open --json number,title,url --limit 50)"
  prs="$(gh pr list -R "$GH_REPO" --state all --search "created:>=$SINCE_ISO" \
    --json number,title,url,headRefName,state --limit 50)"
  jq -n --argjson voc_new "$voc_new" --argjson voc_open "$voc_open" \
    --argjson plan_ready "$plan_ready" --argjson prs "$prs" \
    '{voc_new: $voc_new, voc_open: $voc_open, plan_ready: $plan_ready, new_prs: $prs}'
}

collect_runners() {
  local now records="[]" defects='null' f epoch
  now="$(date +%s)"
  for f in "$RUN_RECORD_DIR"/*.json; do
    jq -e '.name and .finishedAt' "$f" >/dev/null 2>&1 || continue
    epoch="$(date -d "$(jq -r '.finishedAt' "$f")" +%s)" || continue
    records="$(jq --slurpfile r "$f" --argjson epoch "$epoch" '. + [$r[0] + {epoch: $epoch}]' <<<"$records")"
  done
  if [[ -f "$ANALYSIS_FEEDBACK_LEDGER" ]]; then
    defects="$(jq --arg since "$(date -u -d '24 hours ago' +%FT%T)" '
      [.defects[] | select(.firstSeen >= $since) | .status] | group_by(.) | map({(.[0]): length}) | add // {}' \
      "$ANALYSIS_FEEDBACK_LEDGER")"
  fi
  jq -n --arg expected "$EXPECTED_RUNNERS" --argjson records "$records" --argjson now "$now" \
    --argjson defects "$defects" '
    ($records | map({(.name): .}) | add // {}) as $by_name
    | {
        runners: [$expected | split(" ")[] | select(. != "") | split(":") | {name: .[0], max_age_h: (.[1] | tonumber)}
          | . as $r | $by_name[$r.name] as $rec
          | if $rec == null then $r + {status: "missing"}
            else ((($now - $rec.epoch) / 3600) | floor) as $age
              | $r + {age_h: $age, exit_code: $rec.exitCode,
                      status: (if $age > $r.max_age_h then "stale" elif $rec.exitCode != 0 then "failed" else "ok" end)}
            end],
        analysis_defects_24h: $defects
      }'
}

claude_rank() {
  local merged="$1" prompt out
  prompt="$WORK_DIR/rank-prompt.md"; out="$WORK_DIR/rank-out.json"
  {
    cat "$SCRIPT_DIR/prompts/rank.md"
    printf '\n## 신호\n```json\n%s\n```\n' "$(jq '.signals' "$merged")"
    printf '\n## 원자료\n```json\n%s\n```\n' "$(jq 'del(.signals)' "$merged")"
  } > "$prompt"
  local passthrough=() var
  for var in $(compgen -e | grep -E '^(ANTHROPIC_|CLAUDE_)' || true); do
    passthrough+=("$var=${!var}")
  done
  # Scrubbed environment: the model sees the collected JSON, no credentials, no tools.
  env -i HOME="$HOME" PATH="$PATH" TERM=dumb LANG="${LANG:-C.UTF-8}" "${passthrough[@]}" \
    claude -p \
      --model "$RANK_MODEL" \
      --output-format json \
      --json-schema "$(cat "$SCRIPT_DIR/schemas/rank.schema.json")" \
      --tools "" \
      --strict-mcp-config \
      --no-session-persistence \
      --max-budget-usd "$CLAUDE_MAX_BUDGET_USD" \
      < "$prompt" > "$out" 2>>"$LOG_FILE" || return 1
  jq -e '.is_error == false and (.structured_output.picks | type == "array")' "$out" >/dev/null || return 1
  # Only ids that exist survive, once each; the model cannot add a signal of its own.
  jq --slurpfile m "$merged" '[.structured_output.picks[]
    | select(.id as $id | $m[0].signals | any(.id == $id))]
    | reduce .[] as $p ([]; if any(.[]; .id == $p.id) then . else . + [$p] end) | .[:3]' "$out"
}

discord_post() {
  local body="$1" query="$2"
  curl -fsS -H 'Content-Type: application/json' -d "$body" "${DISCORD_DIGEST_WEBHOOK_URL}?wait=true${query}"
}

# A forum channel webhook needs thread_name on the first post and opens one post per digest; the
# rest of the chunks go into that post. A text channel webhook just gets the chunks in order.
send() {
  local chunks="$1" title="$2" count i body thread_id="" resp
  count="$(jq length <<<"$chunks")"
  for ((i = 0; i < count; i++)); do
    # flags 4 = SUPPRESS_EMBEDS, so Sentry/GitHub links do not unfurl into cards.
    body="$(jq -c --argjson i "$i" --arg title "$title" --arg forum "${DISCORD_DIGEST_FORUM:-0}" '
      {content: .[$i], flags: 4, allowed_mentions: {parse: []}}
      + (if $i == 0 and $forum == "1" then {thread_name: $title} else {} end)' <<<"$chunks")"
    if [[ -n "$thread_id" ]]; then
      discord_post "$body" "&thread_id=$thread_id" >/dev/null
    else
      resp="$(discord_post "$body" "")"
      [[ "${DISCORD_DIGEST_FORUM:-0}" == 1 ]] && thread_id="$(jq -r '.channel_id' <<<"$resp")"
    fi
  done
}

notify_failure() {
  local code=$?
  [[ $code == 0 || $DRY_RUN == 1 || -z "${DISCORD_DIGEST_WEBHOOK_URL:-}" ]] && return
  local body
  body="$(jq -nc --arg c "데일리 피드 생성 실패 (exit $code). 로그: $LOG_FILE" \
    --arg t "$(date +%m/%d) 피드 실패" --arg forum "${DISCORD_DIGEST_FORUM:-0}" \
    '{content: $c} + (if $forum == "1" then {thread_name: $t} else {} end)')"
  discord_post "$body" "" >/dev/null || true
}

main() {
  trap 'notify_failure; rm -rf "$WORK_DIR"' EXIT
  preflight
  GH_REPO="${DAILY_DIGEST_GH_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)}"
  log "INFO" "digest for $TARGET_DATE (24h window since $SINCE_ISO)"

  collect business collect_business
  collect funnel collect_funnel
  collect infra collect_infra
  collect sentry collect_sentry
  collect github collect_github
  collect runners collect_runners

  local merged="$WORK_DIR/merged.json"
  jq -n \
    --arg date "$TARGET_DATE" --arg today "$(date +%F)" \
    --argjson thresholds "$(jq -n '{
      reviewer_drop: (env.DAILY_DIGEST_REVIEWER_DROP // "0.3" | tonumber),
      min_active: (env.DAILY_DIGEST_MIN_ACTIVE // "10" | tonumber),
      funnel_min_base: (env.DAILY_DIGEST_FUNNEL_MIN_BASE // "10" | tonumber),
      funnel_drop_pp: (env.DAILY_DIGEST_FUNNEL_DROP_PP // "15" | tonumber),
      disk_warn: 0.8, disk_crit: 0.9, mem_warn: 0.9,
      server_error_warn: 10, analysis_fail_warn: 5, pending_age_warn_sec: 1800,
      report_age_warn_days: 3}')" \
    --slurpfile business "$WORK_DIR/business.json" --slurpfile funnel "$WORK_DIR/funnel.json" \
    --slurpfile infra "$WORK_DIR/infra.json" --slurpfile sentry "$WORK_DIR/sentry.json" \
    --slurpfile github "$WORK_DIR/github.json" --slurpfile runners "$WORK_DIR/runners.json" \
    '{date: $date, today: $today, thresholds: $thresholds, business: $business[0], funnel: $funnel[0], infra: $infra[0],
      sentry: $sentry[0], github: $github[0], runners: $runners[0]}' \
    | jq -L "$LIB_DIR" 'include "digest"; . + {signals: signals}' > "$merged"
  cp "$merged" "$STATE_DIR/last-merged.json"

  # null = no ranking, fall back to severity order. [] = the model looked and found nothing worth the top.
  local picks='null'
  if [[ $USE_LLM == 1 ]] && jq -e '.signals | any(.severity != "info")' "$merged" >/dev/null; then
    picks="$(claude_rank "$merged")" || { log "WARN" "rank pass failed, falling back to severity order"; picks='null'; }
  fi

  local chunks title
  chunks="$(jq -L "$LIB_DIR" --argjson picks "$picks" 'include "digest"; render($picks) | pack(1900)' "$merged")"
  title="$(jq -r -L "$LIB_DIR" 'include "digest"; title' "$merged")"

  if [[ $DRY_RUN == 1 ]]; then
    printf '# %s\n\n' "$title"
    jq -r '.[] | ., "\n----- (message break) -----\n"' <<<"$chunks"
  else
    send "$chunks" "$title"
    log "INFO" "posted $(jq length <<<"$chunks") message(s)"
  fi
}

main
