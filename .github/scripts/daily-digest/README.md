# Daily Digest Runner

매일 아침 지표, 골든패스, 인프라, 문의, 다른 러너 상태를 모아 Discord 에 한 번 올리는 로컬 러너.
Alertmanager 알림은 터질 때 바로 오지만, 이 피드는 "오늘 무엇부터 볼지"를 정하려고 하루 한 번 본다.

```
collect_*  (prod MySQL, GA4 BigQuery, Prometheus, Sentry, GitHub, 러너 기록)
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

## 러너 기록

다른 러너는 끝날 때 `~/.local/state/kotonoha-runners/<name>.json` 에 `{name, finishedAt, exitCode}` 를 쓴다
(`analysis-feedback/run.sh`, `issue-resolver/resolve.sh` 의 `record_run`). digest 는 이 파일만 보고,
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

마지막 수집 결과는 `~/.local/state/kotonoha-daily-digest/last-merged.json`, 로그는 같은 곳의 `logs/`.

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
