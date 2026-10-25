# Analysis Audit Runner

새로 끝난 곡 분석을 곡마다 통째로 검사해, 문제가 있는 곡은 GitHub issue 하나로 올리는 로컬 러너.
`analysis-feedback` 은 파이프라인이 스스로 결손이라고 아는 것(뜻 없음, MV 못 찾음)만 받아 PR 을 만든다.
이 러너는 파이프라인이 정상이라고 내보낸 결과에서 틀린 것을 찾는다. 둘은 따로 돈다.

```
admin-api  COMPLETED works (지난 WINDOW 안, 원장에 없는 것, 오래된 순으로 MAX_SONGS 곡) + 그 lyric
YouTube oEmbed  MV 제목·채널, 퍼가기 가능 여부 (앱은 embed 로 틀어서 퍼가기 금지 = 재생 불가)
        ↓
checks.py   고정 규칙: 가사 줄 수, 일본어·한글 줄 비율, 시각 역행·곡 길이 초과, 빠진 분석·번역,
            토큰 위치 어긋남, 덮이지 않은 글자, 내용어 뜻 공란, MV 없음·재생 불가
claude -p   곡 하나를 표로 읽고 분절·뜻·번역·가사 오연결·MV 오연결 판정 (도구 없음)
        ↓
issue      곡당 1개, label analysis-audit. 문제가 없으면 원장에만 clean 으로 남긴다.
```

## 판단 근거

- **Sentry 로그가 아니라 admin-api 에서 결과를 읽는다.** 결손 로그 경로는 worker DSN 이 다른 Sentry 프로젝트로
  바뀌면서 3주 동안 아무 경고 없이 끊겼다. 완료된 작업을 직접 읽으면 설정이 어긋날 때 preflight 가 실패한다.
- **규칙과 모델을 나눈다.** 규칙은 비용 없이 늘 같은 답을 내고, 모델이 놓쳐도 잡히는 구조 결함(빈 가사, 위치
  어긋남)을 맡는다. 문턱은 2026-10 prod 40곡에서 정상 곡이 안 걸리도록 맞췄다. 일본어 버전 K-pop 은 줄마다
  영어가 섞여 글자 비율로는 걸리므로 줄 비율을 쓴다.
- **모델에 도구를 주지 않는다.** 가사·MV 제목은 외부에서 온 글이라 지시문이 섞여 있을 수 있다. 판정만 하는
  패스라 읽을 것도 실행할 것도 없다. 환경 변수도 비워서 띄운다.
- **취향 차이는 내지 않게 한다.** 풀어 두면 모델은 "わかる=이해하다 보다 알다가 자연스럽다" 같은 것으로 곡당
  15건을 채운다. 그러면 issue 가 읽히지 않는다. `medium` 은 issue 에 _(추정)_ 으로 표시된다.
- **곡당 issue.** 고칠 때 재분석·제보 승인이 곡 단위라서다. 같은 원인이 여러 곡에 걸치면 사람이 issue 를 묶는다.

비용: sonnet 기준 곡당 약 $0.05~0.09 (2026-10 측정).

## 실행

```bash
set -a; . .github/scripts/analysis-audit/.env; set +a
.github/scripts/analysis-audit/run.sh --check-preflight   # 도구·admin-api·gh 확인
.github/scripts/analysis-audit/run.sh --dry-run            # issue 본문을 출력만, 원장도 그대로
.github/scripts/analysis-audit/run.sh --dry-run --work 1269  # 한 작업만
.github/scripts/analysis-audit/run.sh                      # 실제
```

## 상태

`~/.local/state/kotonoha-analysis-audit/`

- `ledger.json` — workId 별 `clean` | `reported`(issueUrl) | `failed`. `failed` 는 첫 시도를 포함해
  `ANALYSIS_AUDIT_MAX_ATTEMPTS` 번까지 다음 실행에서 다시 한다. issue 를 올리기 전에 본문의 `workId=` 로 기존 issue 를
  찾으므로, 원장이 날아가도 같은 작업에 issue 가 두 번 생기지 않는다. 다시 감사하려면 해당 workId 를 지우거나 `--work` 로 돌린다.
- `logs/analysis-audit-YYYYMMDD.log`

재분석은 새 work 를 만들므로 같은 곡이라도 다시 감사된다.

## systemd (user)

```ini
# ~/.config/systemd/user/analysis-audit.service
[Unit]
Description=Kotonoha analysis audit runner

[Service]
Type=oneshot
WorkingDirectory=/absolute/path/to/repo
EnvironmentFile=/absolute/path/to/repo/.github/scripts/analysis-audit/.env
Environment=PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/absolute/path/to/repo/.github/scripts/analysis-audit/run.sh
```

```ini
# ~/.config/systemd/user/analysis-audit.timer
[Unit]
Description=Run analysis audit hourly

[Timer]
OnBootSec=10min
OnUnitActiveSec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now analysis-audit.timer
journalctl --user -u analysis-audit.service -n 100 --no-pager
```
