# Analysis Feedback Runner

곡 분석 파이프라인이 단어를 **뜻 없이 내보낸** 경우를 모아, 코드로 고칠 수 있는 것만 골라 PR을 만드는
로컬 러너.

```
batch: SegmentLyricsStage / SelectSensesStage
  └─ 결손 1건 = 로그 1줄  →  ANALYSIS_DEFECT {"songId":70,"lineIndex":3,"cause":"DICTIONARY_MISS","surface":"買えれ","headword":"買える","line":"金で買えれば 何でも"}
        ↓  (sentry-logback, warn)
Sentry kotonoha-batch-prod — 이벤트만 읽는다, 이슈는 안 본다
        ↓
run.sh  fetch → ledger(cause:headword) → 새 키만 → classify(sonnet, 읽기 전용)
        → fix(opus, origin/main 워크트리, translation 모듈만) → 테스트 main:실패/브랜치:통과 → PR
```

## Files

- `run.sh` — 러너. 판단은 전부 여기서: 무엇이 새 것인지, 어느 경로를 바꿔도 되는지, 재현 테스트가
  main에서 실패하고 브랜치에서 통과하는지.
- `prompts/classify.md` — 1차. 새 결손을 원인별로 묶고 `fix` / `expected_no_meaning` / `hold` 판정.
- `prompts/fix.md` — 2차. 워크트리에서 재현 테스트 + 최소 수정. PR 본문의 "왜"·"어떻게" 두 단락만 쓴다.
- `schemas/*.json` — 두 단계의 출력 스키마 (`claude -p --json-schema`).
- `fixtures/defects.json` — `--fixture` 용 샘플 (실제 prod 결손을 본뜬 것).
- `.env.template` — 환경변수 목록. 실제 값은 `.env` 에 (gitignored).

## 실행

```bash
set -a; . .github/scripts/analysis-feedback/.env; set +a
.github/scripts/analysis-feedback/run.sh --check-preflight   # 도구·Sentry 접근 확인
.github/scripts/analysis-feedback/run.sh --dry-run            # 분류까지만
.github/scripts/analysis-feedback/run.sh --no-push            # 수정·테스트까지, 푸시/PR 직전에 멈춤
.github/scripts/analysis-feedback/run.sh                      # 실제
```

Sentry 없이 흐름만 볼 때:

```bash
.github/scripts/analysis-feedback/run.sh --dry-run \
  --fixture .github/scripts/analysis-feedback/fixtures/defects.json \
  --state-file "$(mktemp)"
```

## 상태

`~/.local/state/kotonoha-analysis-feedback/`

- `ledger.json` — 키 `cause:headword` 별 상태. `new` → `ignored` | `held` | `fixing`(PR 링크) |
  `provider_error`(jisho 장애, LLM에 안 보냄). 같은 단어가 다른 곡에서 다시 나와도 키가 같으면 다시 안 묻는다.
- `logs/analysis-feedback-YYYYMMDD.log`
- `worktrees/` — 수정 패스용. PR 후 정리되며 `--no-push` 일 때만 남는다.

수동으로 상태를 되돌리려면 `ledger.json` 에서 해당 키의 `status` 를 `new` 로 바꾸면 된다.

## systemd (user)

```ini
# ~/.config/systemd/user/analysis-feedback.service
[Unit]
Description=Kotonoha analysis feedback runner

[Service]
Type=oneshot
WorkingDirectory=/absolute/path/to/repo
EnvironmentFile=/absolute/path/to/repo/.github/scripts/analysis-feedback/.env
Environment=PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/absolute/path/to/repo/.github/scripts/analysis-feedback/run.sh
```

```ini
# ~/.config/systemd/user/analysis-feedback.timer
[Unit]
Description=Run analysis feedback hourly

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now analysis-feedback.timer
journalctl --user -u analysis-feedback.service -n 100 --no-pager
```

## PR이 안 만들어지는 경우 (전부 로그에 남는다)

- 분류가 후보 키를 정확히 한 묶음씩 덮지 않음 → 그 실행은 버리고 키는 `new` 유지.
- 수정이 `backend/domains/translation/` 밖을 건드림, `SentryConfig`/`application.yml`/`logback` 을 건드림,
  `logger.warn`/`logger.error` 호출을 줄임, 테스트를 안 넣음.
- 재현 테스트가 브랜치에서 실패하거나 **origin/main 에서도 통과**함 (결손을 재현하지 못한 테스트).
- 커밋이 1개가 아님, 브랜치가 이미 origin에 있음.

실패한 키는 `fixAttempts` 가 올라가고 `ANALYSIS_FEEDBACK_MAX_FIX_ATTEMPTS`(기본 2) 에 닿으면 `held` 가 된다.
