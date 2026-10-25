# Daily Digest Runner

매일 아침 지표, 골든패스, 신기능 성과, 인프라, 문의, 다른 러너 상태를 모아 Discord 에 한 번 올리는 로컬 러너.
Alertmanager 알림은 터질 때 바로 오지만, 이 피드는 "오늘 무엇부터 볼지"를 정하려고 하루 한 번 본다.

```
collect_*  (prod MySQL, GA4 BigQuery, Prometheus, Sentry, GitHub, 러너 기록, git 태그·ReplicaSet)
   ↓  섹션별 JSON. 실패한 섹션은 {"error"} 로 남고 피드는 그대로 나간다
lib/digest.jq signals  →  임계값을 넘은 것만 신호로
   ↓
claude -p (sonnet, 도구 없음)  →  "오늘 볼 것" 3개 고르고 한 줄 이유만
   ↓
lib/digest.jq render  →  Discord webhook (포럼 채널이면 날짜별 글 하나)
```

## 지켜야 할 것

- **숫자는 수집기와 jq 만 만든다.** 모델은 신호 id 를 고르고 이유를 쓸 뿐이고, 목록에 없는 id 는 버린다.
  모델이 실패하면 심각도 순으로 대신 채운다.
- **지표 정의는 `docs/analytics.md` 를 따른다.** 운영자 제외(`users.id IN (1, 32)`, GA 는 설치 단위), 스토어 테스트
  기기 제외를 바꾸면 Grafana 와 숫자가 어긋난다.
- **prod MySQL 은 8일 범위만 읽는다.** `daily_study_summary` 는 날짜 인덱스가 없다. 전 기간 집계를 넣지 말 것.
- **GA4 어제 테이블은 대개 10시쯤 확정된다.** 08:00 실행이면 intraday 로 계산하고 골든패스에 "잠정"이 붙는다.
- **곡 탐색 완주는 `review_complete` 의 `mode = source` 만 센다.** 홈 세션 완주까지 세면 곡 복습보다 완주가 많아진다.
- **표는 embed 안 코드 블록으로 그린다.** Discord 는 마크다운 표를 그리지 않는다. 한글은 두 칸으로 세어 맞추고(`dw`),
  폰에서 줄이 접히지 않게 표 폭을 45칸 안쪽으로 둔다. 코드 블록 안엔 링크를 못 넣어 링크는 표 아래 목록으로 뺀다.
- **대상은 실제 이름으로 쓴다.** 노드, 파드, 앱, Sentry 프로젝트, 러너, 큐 이름을 줄이거나 바꾸면 찾아갈 수 없다.

## 신기능 성과

`main` 의 first-parent 커밋(머지 하나, 또는 직접 커밋 하나)이 단위다. `app-rn/` 이나 `backend/{api,worker,domains,integrations}/`
를 건드린 단위만 본다.

- **배포 시각은 추정하지 않고 찾는다.** 앱은 그 커밋을 포함한 태그로 성공한 첫 배포 워크플로 실행 시각(prod OTA
  `js-v*.prod` 의 Deploy EAS Update, 네이티브 `vX.Y.Z` 의 Android CD)이다. 태그가 lightweight 라 태그 날짜는 커밋 날짜라 쓰지 않는다.
  네이티브는 심사와 관리형 게시 때문에 실제 출시가 더 늦을 수 있다. 서버는 그 커밋을 포함한 첫 api/worker ReplicaSet
  이미지(deploy.sh 가 짧은 sha 로 태그)다. 둘 다 건드리면 둘 다 나간 시각. 머지만 되고 안 나간 기능은 "아직 배포 안 됨".
- **배포 시각을 모르면 재지 않는다.** 처음 맞는 기록이 남아 있는 것 중 가장 오래된 것(ReplicaSet revision 기록 끝,
  워크플로 목록 끝)이면 그보다 먼저 나갔을 수 있어 그 단위는 뺀다.
- **모델은 단위마다 한 번만, 도구 없이 묻는다.** 커밋 제목, 바뀐 경로, `analytics.ts` 만 보고 유저가 알아챌 기능인지와
  GA 비율 하나를 `features.json` 원장에 남긴다. 커밋 제목엔 다른 러너가 유저 제보로 쓴 글이 섞여 있어 저장소(.env 포함)를
  읽게 두지 않는다. `analytics.ts` 에 없는 이벤트나 값 없는 param 을 고르면 버린다. 8개씩 나눠 묻고 묶음마다 저장한다.
  원장의 `metric` 을 손으로 고치면 다음 실행부터 그 지표로 잰다. 다시 묻게 하려면 그 sha 를 지운다. 원장은 lookback 밖 단위를 지워 3주치만 남긴다.
- **비율은 그날 분모 유저 중 분자 유저를 날짜별로 합쳐 나눈다.** 배포 전 7일과 배포 다음 날부터 어제까지를 비교하고,
  배포 당일은 양쪽 모두에서 뺀다.
  배포 전 분자가 0 이면 이 기능이 새로 남기기 시작한 이벤트로 보고 배포 후 값만 보여준다.
- 하락 경고는 배포 후 이틀 이상, 양쪽 분모가 `DAILY_DIGEST_FEATURE_MIN_DEN` 이상, `DAILY_DIGEST_FEATURE_DROP` 이상 떨어졌을 때만.

## 러너 기록

다른 러너는 끝날 때 `~/.local/state/kotonoha-runners/<name>.json` 에 `{name, finishedAt, exitCode}` 를 쓴다
(`analysis-feedback/run.sh`, `issue-resolver/resolve.sh`, `analysis-audit/run.sh` 의 `record_run`). digest 는 이 파일만 보고,
`DAILY_DIGEST_EXPECTED_RUNNERS` 의 `이름:최대시간` 보다 오래됐거나 없으면 멈춘 러너로 올린다.
새 러너를 만들면 같은 기록을 쓰고 이 목록에 더한다.

## 실행

```bash
set -a; . .github/scripts/daily-digest/.env; set +a
.github/scripts/daily-digest/run.sh --dry-run            # 수집하고 메시지를 stdout 으로
.github/scripts/daily-digest/run.sh --dry-run --no-llm   # 모델 없이 심각도 순
.github/scripts/daily-digest/run.sh --date 2026-10-20    # 그날 기준 지표 (인프라, Sentry 는 늘 최근 24시간)
.github/scripts/daily-digest/run.sh                      # 실제 발송
```

마지막 수집 결과는 `~/.local/state/kotonoha-daily-digest/last-merged.json`, 신기능 원장은 `features.json`, 로그는 같은 곳의 `logs/`.
`--no-llm` 이면 새 단위를 분류하지 않고 원장에 있는 것만 잰다.

## systemd (user)

```ini
# ~/.config/systemd/user/daily-digest.service
[Unit]
Description=Kotonoha daily digest

[Service]
Type=oneshot
WorkingDirectory=/absolute/path/to/repo
EnvironmentFile=/absolute/path/to/repo/.github/scripts/daily-digest/.env
Environment=PATH=%h/google-cloud-sdk/bin:%h/bin:%h/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/absolute/path/to/repo/.github/scripts/daily-digest/run.sh
```

```ini
# ~/.config/systemd/user/daily-digest.timer
[Unit]
Description=Run daily digest at 08:00 KST

[Timer]
OnCalendar=*-*-* 08:00:00 Asia/Seoul
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now daily-digest.timer
journalctl --user -u daily-digest.service -n 100 --no-pager
```

`Persistent=true` 라 08:00 에 PC 가 꺼져 있었으면 켜진 뒤 바로 한 번 돈다.
