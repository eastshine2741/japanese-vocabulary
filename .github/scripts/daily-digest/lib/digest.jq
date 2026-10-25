# Signals and Discord rendering for run.sh. Input is the merged collector JSON.

def section_labels: {business: "지표", funnel: "골든패스", infra: "인프라", sentry: "Sentry",
                     github: "GitHub", runners: "러너"};

def pct: . * 100 | round | tostring + "%";
def signed: if . > 0 then "+\(.)" elif . < 0 then "-\(-.)" else "0" end;
def comma: round | tostring | [scan("^\\d{1,3}(?=(?:\\d{3})*$)|\\d{3}")] | join(",");
def weekday_ko: strptime("%Y-%m-%d") | mktime | strftime("%w") | tonumber
  | ["일", "월", "화", "수", "목", "금", "토"][.];
def mmdd: split("-") | "\(.[1] | tonumber)/\(.[2] | tonumber)";
def short($n): if length > $n then .[:$n] + "…" else . end;
def link($text; $url): "[\($text)](<\($url)>)";

def sig($id; $sev; $section; $text): {id: $id, severity: $sev, section: $section, text: $text};

# JSON_ARRAYAGG has no defined order, so days are picked by date, not position.
def business_view:
  .date as $date
  | (.business.days | sort_by(.date)) as $d
  | ($d | map(select(.date == $date))[0]) as $y | ($d | map(select(.date < $date))) as $p
  | def avg($f): if ($p | length) == 0 then 0 else ($p | map(.[$f]) | add) / ($p | length) end;
  {y: $y, prev: ($p | last), avg: {reviewers: avg("reviewers"), cards: avg("cards"), signups: avg("signups")}};

def funnel_paths: [
  {key: "install", name: "신규 유저", steps: [["install", "설치"], ["install_login", "로그인"], ["install_rate", "카드 평가"]]},
  {key: "study", name: "복습", steps: [["reveal", "카드 공개"], ["rate", "평가"]]},
  {key: "explore", name: "곡 탐색", steps: [["song_detail", "곡 상세"], ["song_review", "곡 복습"], ["review_complete", "완주"]]}
];

# Per step pair: yesterday's conversion against the pooled conversion of the 7 days before.
def funnel_view:
  .thresholds as $t
  | (.date | gsub("-"; "")) as $date_key
  | (.funnel.days | map(select(.date == $date_key))) as $ys
  | ($ys[0] // null) as $y
  | (.funnel.days | map(select(.date != $date_key))) as $p
  | funnel_paths | map(. as $path | {
      key, name,
      counts: [.steps[] | {label: .[1], n: ($y[.[0]] // 0)}],
      drops: [range(1; .steps | length) as $i
        | $path.steps[$i - 1][0] as $from | $path.steps[$i][0] as $to
        | ($y[$from] // 0) as $base
        | (($p | map(.[$from]) | add) // 0) as $pb
        | select($base >= $t.funnel_min_base and $pb > 0)
        | (($y[$to] // 0) / $base) as $conv
        | (($p | map(.[$to]) | add) / $pb) as $baseline
        | select(($baseline - $conv) * 100 >= $t.funnel_drop_pp)
        | {from: $path.steps[$i - 1][1], to: $path.steps[$i][1], conv: $conv, baseline: $baseline}],
      small: (($y[.steps[0][0]] // 0) < $t.funnel_min_base)
    });

def signals:
  .thresholds as $t
  | .date as $root_date
  | [
      (["business", "funnel", "infra", "sentry", "github", "runners"][] as $k
        | select(.[$k].error != null)
        | sig("collect.\($k)"; "warn"; $k; "\(section_labels[$k]) 수집 실패: \(.[$k].error | short(80))")),

      (select(.business.error == null) | business_view as $b
        | (select($b.avg.reviewers >= $t.min_active and $b.y.reviewers < $b.avg.reviewers * (1 - $t.reviewer_drop))
           | sig("business.reviewers"; "warn"; "business";
                 "복습 유저 \($b.y.reviewers)명, 7일 평균 \($b.avg.reviewers | round)명보다 \((1 - $b.y.reviewers / $b.avg.reviewers) | pct) 적음"))),

      (select(.funnel.error == null and (.funnel.days | any(.date == ($root_date | gsub("-"; "")))) | not)
        | sig("funnel.missing"; "warn"; "funnel"; "어제 GA 이벤트가 BigQuery 에 없음")),

      (select(.funnel.error == null) | funnel_view[] as $f | $f.drops[]
        | sig("funnel.\($f.key).\(.to)"; "warn"; "funnel";
              "\($f.name) 경로 \(.from)→\(.to) \(.conv | pct), 7일 \(.baseline | pct)")),

      (select(.infra.error == null) | .infra as $i
        | ($i.alerts[] | sig("infra.alert.\(.name)"; (if .severity == "critical" then "crit" else "warn" end); "infra";
                             "Alertmanager \(.name) 발화 (\(.severity))")),
          ($i.oom[] | sig("infra.oom.\(.)"; "crit"; "infra"; "\(.) OOMKilled")),
          ($i.restarts[] | select(.pod as $p | $i.oom | index($p) | not)
            | sig("infra.restart.\(.pod)"; "warn"; "infra"; "\(.pod) 재시작 \(.count)회")),
          ($i.disk[] | select(.used >= $t.disk_warn)
            | sig("infra.disk.\(.node)"; (if .used >= $t.disk_crit then "crit" else "warn" end); "infra";
                  "\(.node) 디스크 \(.used | pct)")),
          ($i.mem[] | select(.used >= $t.mem_warn) | sig("infra.mem.\(.node)"; "warn"; "infra"; "\(.node) 메모리 \(.used | pct)")),
          ($i.http[] | select(.server_error >= $t.server_error_warn)
            | sig("infra.5xx.\(.app)"; "warn"; "infra"; "\(.app) 5xx \(.server_error)건")),
          ($i.analysis.failed | map(select(.code != "LYRICS_NOT_FOUND")) | (map(.count) | add // 0) as $n
            | select($n >= $t.analysis_fail_warn)
            | sig("infra.analysis_failed"; "warn"; "infra"; "곡 분석 실패 \($n)건 (가사 없음 제외)")),
          ($i.analysis.oldest_pending_sec | select(. >= $t.pending_age_warn_sec)
            | sig("infra.analysis_pending"; "warn"; "infra"; "곡 분석 대기 \(. / 60 | round)분째")),
          ($i.queues[] | select((.queue | test("dlq$")) and .messages > 0)
            | sig("infra.dlq.\(.queue)"; "warn"; "infra"; "\(.queue) 메시지 \(.messages)건"))),

      (select(.sentry.error == null) | .sentry.new_issues[] | select(.level == "error" or .level == "fatal")
        | sig("sentry.\(.url | split("/") | map(select(. != "")) | last)"; "warn"; "sentry";
              "Sentry 새 에러 \(.title | short(60)) (\(.project), \(.count)회)")),

      (select(.business.error == null) | .business.reports
        | (select(.new > 0) | sig("reports.new"; "info"; "github"; "가사 제보 \(.new)건 새로 들어옴")),
          (select(.pending > 0 and (.oldest_pending_days // 0) >= $t.report_age_warn_days)
            | sig("reports.pending"; "warn"; "github"; "가사 제보 \(.pending)건 대기, 가장 오래된 건 \(.oldest_pending_days)일째"))),

      (select(.github.error == null) | .github
        | (.voc_new[] | sig("voc.\(.number)"; "warn"; "github"; "VOC #\(.number) \(.title | short(60))")),
          (select(.plan_ready | length > 0) | sig("github.plan_ready"; "info"; "github"; "계획 승인 대기 이슈 \(.plan_ready | length)건"))),

      (select(.runners.error == null) | .runners.runners[] | select(.status != "ok")
        | sig("runner.\(.name)"; "warn"; "runners";
              if .status == "missing" then "\(.name) 실행 기록 없음"
              elif .status == "stale" then "\(.name) \(.age_h)시간째 실행 안 됨"
              else "\(.name) 마지막 실행 실패 (exit \(.exit_code))" end))
    ];

def title: "\(.today | mmdd) (\(.today | weekday_ko)) 데일리 피드";

def render_highlights($picks):
  .signals as $s
  | ($s | map(select(.severity != "info"))) as $hot
  | (if $picks != null
     then [$picks[] | . as $p | first($s[] | select(.id == $p.id)) + {why: $p.why}]
     else ($hot | sort_by(if .severity == "crit" then 0 else 1 end) | .[:3])
     end) as $top
  | if ($top | length) == 0 then "### 오늘 볼 것\n특이사항 없음"
      + (if ($hot | length) > 0 then ", 경고 \($hot | length)건은 아래 섹션에" else "" end)
    else "### 오늘 볼 것\n" + ([$top | to_entries[]
      | "\(.key + 1). \(.value.text)" + (if (.value.why // "") != "" then "\n   \(.value.why)" else "" end)] | join("\n"))
      + (if ($hot | length) > ($top | length) then "\n그 밖의 경고 \(($hot | length) - ($top | length))건은 아래 섹션에" else "" end)
    end;

def render_business:
  if .business.error then "### 지표\n수집 실패"
  else business_view as $b | .business as $raw
  | def line($label; $f; $unit):
      "\($label) **\($b.y[$f] | comma)**\($unit)  전일 \(($b.y[$f] - ($b.prev[$f] // 0)) | signed)  7일 평균 \($b.avg[$f] | comma)";
  "### 지표 (\(.date | mmdd) \(.date | weekday_ko))\n"
  + ([line("복습 유저"; "reviewers"; "명"), line("평가한 카드"; "cards"; "장"), line("신규 가입"; "signups"; "명"),
      "D1 복귀 \($raw.d1.returned)/\($raw.d1.users)  D7 복귀 \($raw.d7.returned)/\($raw.d7.users)"] | join("\n"))
  end;

def render_funnel:
  if .funnel.error then "### 골든패스\n수집 실패"
  else .funnel.provisional as $prov
  | "### 골든패스" + (if $prov then " (잠정)" else "" end) + "\n"
  + ([funnel_view[]
      | "\(.name)  " + ([.counts[] | "\(.label) \(.n)"] | join(" → "))
        + (if .small then "  표본 부족" else "" end)
        + ([.drops[] | "\n  ⚠️ \(.from)→\(.to) \(.conv | pct), 7일 \(.baseline | pct)"] | join(""))]
     | join("\n"))
  end;

def render_infra:
  if .infra.error then "### 인프라 (최근 24시간)\n수집 실패"
  else .infra as $i | . as $root
  | ($root.signals | map(select(.section == "infra"))) as $s
  | ($i.analysis.failed | map(select(.code == "LYRICS_NOT_FOUND") | .count) | add // 0) as $nolyrics
  | ($i.analysis.failed | map(.count) | add // 0) as $failed
  | "### 인프라 (최근 24시간)\n"
  + ([
      ($i.http[] | "\(.app | sub("^japanese-vocabulary-"; ""))  요청 \(.total | comma)  5xx \(.server_error)"),
      "곡 분석  성공 \($i.analysis.success)  실패 \($failed)" + (if $nolyrics > 0 then " (가사 없음 \($nolyrics))" else "" end),
      "LLM 비용  $\($i.llm_cost_usd * 100 | round / 100)",
      ($i.disk | if length == 0 then "디스크  데이터 없음" else max_by(.used) | "디스크 최대  \(.node) \(.used | pct)" end),
      (if ($s | length) == 0 then "이상 없음" else ($s[] | "⚠️ \(.text)") end)
    ] | join("\n"))
  end;

def render_sentry:
  if .sentry.error then "### Sentry 새 이슈 (최근 24시간)\n수집 실패"
  elif (.sentry.new_issues | length) == 0 then "### Sentry 새 이슈 (최근 24시간)\n없음"
  else .sentry.new_issues as $n
  | "### Sentry 새 이슈 (최근 24시간) \($n | length)건" + (if .sentry.truncated then " 이상" else "" end) + "\n"
  + ([$n[:5][] | "- \(link(.title | short(70); .url))  \(.project | sub("^kotonoha-"; ""))  \(.count)회"] | join("\n"))
  + (if ($n | length) > 5 then "\n- 외 \(($n | length) - 5)건" else "" end)
  end;

def render_reports:
  "### 문의\n"
  + ([
      (if .business.error then "가사 제보  수집 실패"
       else .business.reports | "가사 제보  새 \(.new)  대기 \(.pending)"
         + (if .pending > 0 then " (가장 오래된 건 \(.oldest_pending_days)일째)" else "" end)
       end),
      (if .github.error then "VOC  수집 실패"
       else .github | "VOC  새 \(.voc_new | length)  열림 \(.voc_open)",
         (.voc_new[] | "- \(link("#\(.number) \(.title | short(70))"; .url))")
       end)
    ] | join("\n"));

def render_runners:
  "### 러너\n"
  + ([
      (if .runners.error then "러너 상태  수집 실패"
       else (.runners.runners[]
         | (if .age_h == 0 then "1시간 안" else "\(.age_h)시간 전" end) as $ago
         | "\(.name)  " + (if .status == "missing" then "⚠️ 기록 없음"
                           elif .status == "stale" then "⚠️ 마지막 실행 \($ago)"
                           elif .status == "failed" then "⚠️ 실패 (exit \(.exit_code)), \($ago)"
                           else "정상, \($ago)" end)),
         (.runners.analysis_defects_24h | select(. != null and length > 0)
           | "분석 결손 새 키  " + ([to_entries[] | "\(.key) \(.value)"] | join("  ")))
       end),
      (if .github.error then empty
       else .github
         | (select(.plan_ready | length > 0) | "계획 승인 대기  \(.plan_ready | length)건",
              (.plan_ready[:5][] | "- \(link("#\(.number) \(.title | short(70))"; .url))")),
           (select(.new_prs | length > 0) | "새 PR  \(.new_prs | length)건",
              (.new_prs[:8][] | "- \(link("#\(.number) \(.title | short(70))"; .url))"))
       end)
    ] | join("\n"));

def render($picks):
  [render_highlights($picks), render_business, render_funnel, render_infra, render_sentry, render_reports, render_runners];

def join_upto($n; $sep):
  reduce .[] as $s ([];
    if length > 0 and ((last | length) + ($sep | length) + ($s | length)) <= $n then .[-1] += $sep + $s else . + [$s] end);

# Packs sections into Discord messages of at most $n characters. A section longer than $n is split
# at line breaks so a link is never cut in half; only a single line longer than $n is cut.
def pack($n):
  [.[] | if length <= $n then .
         else [split("\n")[] | if length <= $n then . else ([range(0; length; $n) as $i | .[$i:$i + $n]] | .[]) end]
              | join_upto($n; "\n") | .[] end]
  | join_upto($n; "\n\n");
