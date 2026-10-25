# Signals and Discord rendering for run.sh. Input is the merged collector JSON.
# Targets (nodes, pods, apps, Sentry projects, runners, queues) are always written by their real
# names: the reader goes straight to kubectl, Sentry or Grafana with them.

def section_labels: {business: "어제 학습", funnel: "골든패스", infra: "서버", sentry: "Sentry",
                     github: "GitHub", runners: "자동화 러너", features: "새로 나간 기능"};

def pct: . * 100 | round | tostring + "%";
def comma: round | tostring | [scan("^\\d{1,3}(?=(?:\\d{3})*$)|\\d{3}")] | join(",");
def weekday_ko: strptime("%Y-%m-%d") | mktime | strftime("%w") | tonumber
  | ["일", "월", "화", "수", "목", "금", "토"][.];
def mmdd: split("-") | "\(.[1] | tonumber)/\(.[2] | tonumber)";
def month_day: split("-") | "\(.[1] | tonumber)월 \(.[2] | tonumber)일";
def short($n): if length > $n then .[:$n] + "…" else . end;
def link($text; $url): "[\($text)](<\($url)>)";
def days_between($a; $b): (($b | strptime("%Y-%m-%d") | mktime) - ($a | strptime("%Y-%m-%d") | mktime)) / 86400 | floor;
def ratio: if .den > 0 then .num / .den else 0 end;

# Monospace tables. Hangul and other wide characters take two cells in Discord's code font.
def dw: [explode[] | if (. >= 4352 and . <= 4607) or (. >= 11904 and . <= 42191) or (. >= 44032 and . <= 55203)
                         or (. >= 63744 and . <= 64255) or (. >= 65280 and . <= 65376) then 2 else 1 end] | add // 0;
def spaces($n): if $n > 0 then " " * $n else "" end;
def table($right):
  (map(map(tostring))) as $rows
  | [range(0; $rows[0] | length) as $c | $rows | map(.[$c] | dw) | max] as $w
  | "```\n" + ([$rows[] | [to_entries[] | .key as $c | .value as $v | spaces($w[$c] - ($v | dw)) as $gap
                           | if ($right | index($c)) then $gap + $v else $v + $gap end]
                         | join("  ") | sub(" +$"; "")] | join("\n")) + "\n```\n";

def sig($id; $sev; $section; $text): {id: $id, severity: $sev, section: $section, text: $text};

# JSON_ARRAYAGG has no defined order, so days are picked by date, not position.
def business_view:
  .date as $date
  | (.business.days | sort_by(.date)) as $d
  | ($d | map(select(.date == $date))[0]) as $y | ($d | map(select(.date < $date))) as $p
  | def avg($f): if ($p | length) == 0 then 0 else ($p | map(.[$f]) | add) / ($p | length) end;
  {y: $y, prev: ($p | last), avg: {reviewers: avg("reviewers"), cards: avg("cards"), signups: avg("signups")}};

def funnel_paths: [
  {key: "install", name: "신규 가입", steps: [["install", "설치"], ["install_login", "로그인"], ["install_rate", "첫 평가"]]},
  {key: "study", name: "복습", steps: [["reveal", "뒷면"], ["rate", "평가"]]},
  {key: "explore", name: "곡 탐색", steps: [["song_detail", "곡 상세"], ["song_review", "복습"], ["review_complete", "완주"]]}
];

# Every step pair: yesterday's conversion against the pooled conversion of the 7 days before.
def funnel_steps:
  .thresholds as $t
  | (.date | gsub("-"; "")) as $date_key
  | (.funnel.days | map(select(.date == $date_key))[0] // {}) as $y
  | (.funnel.days | map(select(.date != $date_key))) as $p
  | [funnel_paths[] as $path | range(1; $path.steps | length) as $i
      | $path.steps[$i - 1] as $from | $path.steps[$i] as $to
      | ($y[$from[0]] // 0) as $base | ($y[$to[0]] // 0) as $next
      | (($p | map(.[$from[0]]) | add) // 0) as $pb
      | {path: $path.name, key: "\($path.key).\($to[0])", from: $from[1], to: $to[1], base: $base, next: $next,
         conv: (if $base > 0 then $next / $base else null end),
         baseline: (if $pb > 0 then ($p | map(.[$to[0]]) | add) / $pb else null end),
         small: ($base < $t.funnel_min_base)}
      | . + {drop: (.small | not) and .conv != null and .baseline != null
                   and ((.baseline - .conv) * 100 >= $t.funnel_drop_pp)}];

# A feature whose own ratio fell after it shipped. Needs a real before (the event existed), enough
# users on both sides, and two full days after, or one quiet day reads as a regression.
def feature_drop($t):
  .measured as $m
  | $m != null and $m.error == null and $m.after.days >= 2 and $m.before.num > 0
    and $m.before.den >= $t.feature_min_den and $m.after.den >= $t.feature_min_den
    and ($m.after | ratio) < ($m.before | ratio) * (1 - $t.feature_drop);

def runner_status_ko: {ok: "정상", failed: "실패", stale: "멈춤", missing: "기록 없음"}[.];
def defect_status_ko: {new: "새로", ignored: "무시", held: "보류", fixing: "수정 중", provider_error: "사전 장애"}[.] // .;

def signals:
  .thresholds as $t
  | .date as $root_date
  | [
      (["business", "funnel", "infra", "sentry", "github", "runners", "features"][] as $k
        | select(.[$k].error != null)
        | sig("collect.\($k)"; "warn"; $k; "\(section_labels[$k]) 데이터를 못 가져왔어요: \(.[$k].error | short(80))")),

      (select(.business.error == null) | business_view as $b
        | (select($b.avg.reviewers >= $t.min_active and $b.y.reviewers < $b.avg.reviewers * (1 - $t.reviewer_drop))
           | sig("business.reviewers"; "warn"; "business";
                 "어제 복습한 사람이 \($b.y.reviewers)명으로 7일 평균(\($b.avg.reviewers | round)명)보다 \((1 - $b.y.reviewers / $b.avg.reviewers) | pct) 적어요"))),

      (select(.funnel.error == null and (.funnel.days | any(.date == ($root_date | gsub("-"; "")))) | not)
        | sig("funnel.missing"; "warn"; "funnel"; "어제 GA 이벤트가 BigQuery에 아직 없어요")),

      (select(.funnel.error == null) | funnel_steps[] | select(.drop)
        | sig("funnel.\(.key)"; "warn"; "funnel";
              "\(.path) 경로에서 \(.from)→\(.to)로 넘어간 비율이 \(.conv | pct)예요. 7일 평균은 \(.baseline | pct)였어요")),

      (select(.infra.error == null) | .infra as $i
        | ($i.alerts[] | sig("infra.alert.\(.name)"; (if .severity == "critical" then "crit" else "warn" end); "infra";
                             "Alertmanager에서 \(.name) 알림(\(.severity))이 울렸어요")),
          ($i.oom[] | sig("infra.oom.\(.)"; "crit"; "infra"; "\(.) 파드가 메모리 부족(OOMKilled)으로 재시작됐어요")),
          ($i.restarts[] | select(.pod as $p | $i.oom | index($p) | not)
            | sig("infra.restart.\(.pod)"; "warn"; "infra"; "\(.pod) 파드가 \(.count)번 재시작했어요")),
          ($i.disk[] | select(.used >= $t.disk_warn)
            | sig("infra.disk.\(.node)"; (if .used >= $t.disk_crit then "crit" else "warn" end); "infra";
                  "\(.node) 노드 디스크가 \(.used | pct) 찼어요")),
          ($i.mem[] | select(.used >= $t.mem_warn)
            | sig("infra.mem.\(.node)"; "warn"; "infra"; "\(.node) 노드가 메모리를 \(.used | pct) 쓰고 있어요")),
          ($i.http[] | select(.server_error >= $t.server_error_warn)
            | sig("infra.5xx.\(.app)"; "warn"; "infra"; "\(.app)에서 5xx 응답이 \(.server_error)건 나왔어요")),
          ($i.analysis.failed | map(select(.code != "LYRICS_NOT_FOUND")) | (map(.count) | add // 0) as $n
            | select($n >= $t.analysis_fail_warn)
            | sig("infra.analysis_failed"; "warn"; "infra"; "곡 분석이 \($n)건 실패했어요(가사 없음은 빼고)")),
          ($i.analysis.oldest_pending_sec | select(. >= $t.pending_age_warn_sec)
            | sig("infra.analysis_pending"; "warn"; "infra"; "곡 분석이 \(. / 60 | round)분째 대기 중이에요")),
          ($i.queues[] | select((.queue | test("dlq$")) and .messages > 0)
            | sig("infra.dlq.\(.queue)"; "warn"; "infra"; "\(.queue) 큐에 메시지가 \(.messages)건 쌓였어요"))),

      (select(.sentry.error == null) | .sentry.new_issues[] | select(.level == "error" or .level == "fatal")
        | sig("sentry.\(.url | split("/") | map(select(. != "")) | last)"; "warn"; "sentry";
              "\(.project)에서 새 에러가 \(.count)번 났어요: \(.title | short(60))")),

      (select(.business.error == null) | .business.reports
        | (select(.new > 0) | sig("reports.new"; "info"; "github"; "가사 제보가 \(.new)건 새로 들어왔어요")),
          (select(.pending > 0 and (.oldest_pending_days // 0) >= $t.report_age_warn_days)
            | sig("reports.pending"; "warn"; "github"; "가사 제보 \(.pending)건이 아직 처리 안 됐어요. 가장 오래된 건 \(.oldest_pending_days)일째예요"))),

      (select(.github.error == null) | .github
        | (.voc_new[] | sig("voc.\(.number)"; "warn"; "github"; "새 VOC #\(.number): \(.title | short(60))")),
          (select(.plan_ready | length > 0) | sig("github.plan_ready"; "info"; "github"; "계획 승인을 기다리는 이슈가 \(.plan_ready | length)건 있어요"))),

      (select(.features.error == null) | .today as $today | .features.features[]
        | (select(feature_drop($t))
           | sig("feature.\(.sha)"; "warn"; "features";
                 "\(.title) 배포 후 '\(.label)' 비율이 \(.measured.before | ratio | pct)에서 \(.measured.after | ratio | pct)로 떨어졌어요")),
          (select(.shipped == null and (days_between(.merged_at; $today) >= 3))
           | sig("feature.unshipped.\(.sha)"; "info"; "features"; "\(.title): 머지한 지 \(days_between(.merged_at; $today))일 됐는데 아직 배포 안 됐어요"))),

      (select(.runners.error == null) | .runners.runners[] | select(.status != "ok")
        | sig("runner.\(.name)"; "warn"; "runners";
              if .status == "missing" then "\(.name) 러너의 실행 기록이 없어요"
              elif .status == "stale" then "\(.name) 러너가 \(.age_h)시간째 안 돌았어요"
              else "\(.name) 러너가 마지막 실행에서 실패했어요(exit \(.exit_code))" end))
    ];

def title: "\(.today | month_day) (\(.today | weekday_ko)) 아침 피드";

def colors: {crit: 14242639, warn: 15246141, ok: 5990000, error: 9109504};
def section_color($section):
  .signals | map(select(.section == $section) | .severity) as $sev
  | if ($sev | index("crit")) then colors.crit elif ($sev | index("warn")) then colors.warn else colors.ok end;
def embed($title; $color; $body): {title: $title, color: $color, description: ($body | short(4000))};
def failed_embed($title; $err): embed($title; colors.error; "데이터를 못 가져왔어요.\n`\($err | short(200))`");

def render_highlights($picks):
  .signals as $s
  | ($s | map(select(.severity != "info"))) as $hot
  | (if $picks != null
     then [$picks[] | . as $p | first($s[] | select(.id == $p.id)) + {why: $p.why}]
     else ($hot | sort_by(if .severity == "crit" then 0 else 1 end) | .[:3])
     end) as $top
  | embed("오늘 먼저 볼 것";
      (if ($top | any(.severity == "crit")) then colors.crit elif ($top | length) > 0 then colors.warn else colors.ok end);
      if ($top | length) == 0 then "오늘은 따로 볼 게 없어요."
        + (if ($hot | length) > 0 then " 경고 \($hot | length)건은 아래에 있어요." else "" end)
      else [$top | to_entries[]
        | "**\(.key + 1). \(.value.text)**" + (if (.value.why // "") != "" then "\n\(.value.why)" else "" end)] | join("\n\n")
        + (if ($hot | length) > ($top | length) then "\n\n이 밖의 경고 \(($hot | length) - ($top | length))건은 아래에 있어요." else "" end)
      end);

def render_business:
  "어제 학습 (\(.date | month_day) \(.date | weekday_ko))" as $title
  | if .business.error then failed_embed($title; .business.error)
    else business_view as $b | .business as $raw
    | embed($title; section_color("business");
        ([["", "어제", "전날", "7일 평균"],
          ["복습한 사람", ($b.y.reviewers | comma), ($b.prev.reviewers // 0 | comma), ($b.avg.reviewers | comma)],
          ["복습한 카드", ($b.y.cards | comma), ($b.prev.cards // 0 | comma), ($b.avg.cards | comma)],
          ["새로 가입", ($b.y.signups | comma), ($b.prev.signups // 0 | comma), ($b.avg.signups | comma)]] | table([1, 2, 3]))
        + "가입 다음 날 다시 온 사람 \($raw.d1.returned)/\($raw.d1.users)명, 일주일 뒤 다시 온 사람 \($raw.d7.returned)/\($raw.d7.users)명")
    end;

def render_funnel:
  ("골든패스" + (if .funnel.provisional then " (잠정, 오전 10시쯤 확정)" else "" end)) as $title
  | if .funnel.error then failed_embed($title; .funnel.error)
    else funnel_steps as $steps
    | embed($title; section_color("funnel");
        ([["단계", "어제", "비율", "7일", ""]]
         + [$steps[] | ["\(.from)→\(.to)", "\(.base)→\(.next)",
                        (if .conv then .conv | pct else "-" end), (if .baseline then .baseline | pct else "-" end),
                        (if .drop then "낮음" elif .small then "표본 적음" else "" end)]]
         | table([1, 2, 3])))
    end;

def render_features:
  .thresholds as $t | .today as $today | .features.unclassified as $unclassified
  | "새로 나간 기능 (최근 \($t.feature_track_days)일)" as $title
  | if .features.error then failed_embed($title; .features.error)
    elif (.features.features | length) == 0 then
      embed($title; colors.ok; "최근에 나간 기능이 없어요."
        + (if $unclassified > 0 then " 아직 분류 안 된 변경이 \($unclassified)건 있어요." else "" end))
    else .features.features as $f
    # Unmeasured features would repeat the same hint every day for two weeks; the hint shows on the
    # two days after shipping, later they fold into one line of titles.
    | ($f | map(select(.shipped != null and .measured != null))) as $measured
    | ($f | map(select(.shipped != null and .measured == null and days_between(.shipped; $today) <= 2))) as $fresh
    | ($f | map(select(.shipped != null and .measured == null and days_between(.shipped; $today) > 2))) as $folded
    | ($f | map(select(.shipped == null))) as $unshipped
    | embed($title; section_color("features");
        ([
          (if ($measured | length) > 0 then
            ([["기능", "배포", "전", "후"]]
             + [$measured[] | [(.title | short(12)), (.shipped | mmdd),
                               (if .measured.error or .measured.before.num == 0 then "-" else .measured.before | ratio | pct end),
                               (if .measured.error then "실패" elif .measured.after.days == 0 then "내일부터"
                                else .measured.after | ratio | pct end)]]
             | table([2, 3]))
            + ([$measured[] | "**\(.title)**: \(.label)"
                + (if .measured.error then ", 조회에 실패했어요"
                   elif .measured.after.days == 0 then ""
                   elif .measured.before.num == 0 then ", 새로 남기기 시작한 이벤트라 배포 후 \(.measured.after.days)일치만 있어요"
                   else ", 배포 후 \(.measured.after.days)일치" + (if .measured.after.den < $t.feature_min_den then "라 아직 표본이 적어요" else "" end)
                   end)] | join("\n"))
           else empty end),
          (if ($fresh | length) > 0 then
            "측정할 이벤트가 없는 새 기능\n" + ([$fresh[] | "- **\(.title)** (\(.shipped | mmdd) \(.via)): \(.no_metric_hint // "이벤트를 정하지 못했어요")"] | join("\n"))
           else empty end),
          (if ($unshipped | length) > 0 then
            "머지했지만 아직 안 나간 기능\n" + ([$unshipped[] | "- **\(.title)** (\(.merged_at | mmdd) 머지, \(.via))"] | join("\n"))
           else empty end),
          (if ($folded | length) > 0 then "측정할 이벤트가 없는 기능 \($folded | length)개: " + ($folded | map(.title) | join(", ")) else empty end),
          (if $unclassified > 0 then "아직 분류 안 된 변경 \($unclassified)건은 다음 실행에서 분류해요." else empty end)
        ] | join("\n\n")))
    end;

def render_infra:
  "서버 (지난 24시간)" as $title
  | if .infra.error then failed_embed($title; .infra.error)
    else .infra as $i
    | (.signals | map(select(.section == "infra"))) as $s
    | ($i.analysis.failed | map(select(.code == "LYRICS_NOT_FOUND") | .count) | add // 0) as $nolyrics
    | ($i.analysis.failed | map(.count) | add // 0) as $failed
    | embed($title; section_color("infra");
        ([($i.http[] | [.app, "요청 \(.total | comma)", "5xx \(.server_error)"]),
          ["곡 분석", "성공 \($i.analysis.success)", "실패 \($failed)" + (if $nolyrics > 0 then " (가사 없음 \($nolyrics))" else "" end)],
          ["LLM 비용", "$\($i.llm_cost_usd * 100 | round / 100)", ""],
          ($i.disk | if length == 0 then ["디스크", "데이터 없음", ""] else max_by(.used) | ["디스크 최대", .node, (.used | pct)] end)]
         | table([]))
        + (if ($s | length) == 0 then "특별한 문제는 없어요." else [$s[] | "- \(.text)"] | join("\n") end))
    end;

def render_sentry:
  "새 에러 (Sentry, 지난 24시간)" as $title
  | if .sentry.error then failed_embed($title; .sentry.error)
    elif (.sentry.new_issues | length) == 0 then embed($title; colors.ok; "새로 생긴 에러가 없어요.")
    else .sentry.new_issues as $n
    | embed($title; section_color("sentry");
        ([$n[:5][] | "- \(link(.title | short(70); .url))\n  `\(.project)`에서 \(.count)번"] | join("\n"))
        + (if ($n | length) > 5 then "\n그 밖에 \(($n | length) - 5)건" + (if .sentry.truncated then " 넘게" else "" end) + " 더 있어요." else "" end))
    end;

def render_reports:
  "문의" as $title
  | if .business.error and .github.error then failed_embed($title; .github.error)
    else . as $root
    | embed($title; section_color("github");
        ([["", "새로 들어옴", "남은 것"],
          (if .business.error then ["가사 제보", "-", "-"] else .business.reports | ["가사 제보", .new, .pending] end),
          (if .github.error then ["VOC", "-", "-"] else .github | ["VOC", (.voc_new | length), .voc_open] end)]
         | table([1, 2]))
        + ([(if .business.error == null and .business.reports.pending > 0
             then "가장 오래 기다린 가사 제보는 \(.business.reports.oldest_pending_days)일째예요." else empty end),
            (if .github.error == null then (.github.voc_new[] | "- \(link("#\(.number) \(.title | short(70))"; .url))") else empty end)]
           | join("\n")))
    end;

def render_runners:
  "자동화 러너" as $title
  | if .runners.error then failed_embed($title; .runners.error)
    else . as $root
    | embed($title; section_color("runners");
        ([["러너", "상태", "마지막 실행"]]
         + [.runners.runners[] | [.name, (.status | runner_status_ko),
                                  (if .status == "missing" then "-" elif .age_h == 0 then "1시간 안" else "\(.age_h)시간 전" end)]]
         | table([]))
        + ([(.runners.analysis_defects_24h | select(. != null and length > 0)
              | "analysis-feedback 러너가 지난 24시간에 찾은 새 결손: " + ([to_entries[] | "\(.key | defect_status_ko) \(.value)"] | join(", "))),
            (if $root.github.error then empty
             else $root.github
               | (select(.plan_ready | length > 0) | "계획 승인을 기다리는 이슈",
                    (.plan_ready[:5][] | "- \(link("#\(.number) \(.title | short(70))"; .url))")),
                 (select(.new_prs | length > 0) | "새 PR \(.new_prs | length)건",
                    (.new_prs[:8][] | "- \(link("#\(.number) \(.title | short(70))"; .url))"))
             end)]
           | join("\n")))
    end;

def render($picks):
  [render_highlights($picks), render_business, render_funnel, render_features, render_infra, render_sentry,
   render_reports, render_runners];

# Groups embeds into Discord messages: at most 10 embeds and 6000 characters of embed text each.
def pack:
  reduce .[] as $e ([];
    (($e.title | length) + ($e.description | length)) as $size
    | if length > 0 and (last | length) < 10
         and ((last | map((.title | length) + (.description | length)) | add) + $size) <= 5800
      then .[-1] += [$e] else . + [[$e]] end);
