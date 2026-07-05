# Sentry Auto Triage Runner

Local cron runner for unresolved Sentry issues. It polls Sentry, asks Codex to choose exactly one outcome, then records the result as a Sentry issue note.

Outcomes:

- PR for a narrow clear fix.
- GitHub issue for broad or low-confidence work.
- Cause-only Sentry note for minor, transient, expected, or external causes.

The runner does not resolve, ignore, archive, delete, or otherwise mutate Sentry issues.

## Files

- `.github/scripts/sentry/triage.sh` - cron-safe runner.
- `.github/scripts/sentry/prompts/triage.md` - Codex classification prompt.
- `.github/scripts/sentry/schemas/sentry-triage-result.schema.json` - Codex output schema.
- `.github/scripts/sentry/schemas/sentry-pr-implementation-result.schema.json` - second-pass PR implementation schema.
- `.github/scripts/sentry/triage.env.example` - public-safe env list.
- `.github/scripts/sentry/fixtures/` - dry-run fixtures.

## Required Local Tools

- `bash`
- `jq`
- `curl`
- `git`
- `gh` authenticated with permission to create issues and PRs
- `codex` authenticated with local ChatGPT-managed auth

Check Codex CLI shape:

```bash
codex --ask-for-approval never exec --help
```

The triage pass runs read-only in the main repo. The PR implementation pass is the only Codex pass allowed to use `workspace-write`, and it runs inside an isolated worktree.

Both Codex passes are pinned to `gpt-5.5` with `model_reasoning_effort="high"`.

Codex is launched with a scrubbed environment (`env -i`) so Sentry, GitHub, deployment, and app secrets from the cron shell are not inherited. The PR worktree is created with `git worktree add` and intentionally does not copy ignored local config such as `.env`, keystores, service account files, or mobile app env files.

## Environment

Use `.github/scripts/sentry/triage.env.example` as a template. Required live variables:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT` as the numeric Sentry project id accepted by the organization issues API, or comma-separated `SENTRY_PROJECTS`
`SENTRY_AUTH_TOKEN` must be able to read organization issues/events for the configured projects and write issue notes; `--check-preflight` verifies read access before cron work starts.

Optional:

- `SENTRY_ENVIRONMENT`
- `SENTRY_ENVIRONMENTS` for comma-separated repeated environment filters
- `SENTRY_TRIAGE_REPLAY_DAYS`, default `7`
- `SENTRY_TRIAGE_MAX_PAGES`, default `5`
- `SENTRY_TRIAGE_PR_MAX_CHANGED_FILES`, default `8`
- `SENTRY_TRIAGE_PR_MAX_DIFF_LINES`, default `400`
- `SENTRY_TRIAGE_NOTE_COMPLETION_LOOKUP_LIMIT`, default `100`
- `SENTRY_TRIAGE_REPO_DIR`

## State And Logs

Default state:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/kotonoha-sentry-triage/processed.json
```

Default logs:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/kotonoha-sentry-triage/logs/sentry-triage-YYYYMMDD.log
```

The ledger records each issue by Sentry issue id. `actionStatus=external_created` means a PR or GitHub issue already exists and the next run should retry only Sentry note completion.

The Sentry poll query converts the replay window into a UTC `firstSeen:>YYYY-MM-DDTHH:MM:SS` cutoff and uses cursor pagination. If the configured page cap is reached while Sentry still advertises a next page, the runner logs a truncation warning and relies on the next cron run plus local ledger dedupe.

## Dry Run

Run fixture paths without external mutation:

```bash
.github/scripts/sentry/triage.sh --dry-run --fixture .github/scripts/sentry/fixtures/pr-small-null-check.json
.github/scripts/sentry/triage.sh --dry-run --fixture .github/scripts/sentry/fixtures/github-issue-large-refactor.json
.github/scripts/sentry/triage.sh --dry-run --fixture .github/scripts/sentry/fixtures/cause-only-transient.json
.github/scripts/sentry/run-dry-run-tests.sh
```

Use an isolated state file for replay checks:

```bash
tmp_state="$(mktemp)"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$tmp_state"
.github/scripts/sentry/triage.sh --dry-run --record-dry-run --state-file "$tmp_state" --fixture .github/scripts/sentry/fixtures/partial-success-sentry-note-retry.json
```

## Run Once

Load the private env file and check local prerequisites:

```bash
cd /absolute/path/to/this/repo
set -a
. .github/scripts/sentry/triage.env
set +a
.github/scripts/sentry/triage.sh --check-preflight
```

Run one live pass:

```bash
set -a
. .github/scripts/sentry/triage.env
set +a
.github/scripts/sentry/triage.sh
```

## User Systemd Timer

This machine uses user-level systemd timers for local automation. Create these files:

```ini
# ~/.config/systemd/user/sentry-triage.service
[Unit]
Description=Sentry Auto Triage Runner

[Service]
Type=oneshot
WorkingDirectory=/absolute/path/to/this/repo
EnvironmentFile=/absolute/path/to/this/repo/.github/scripts/sentry/triage.env
ExecStart=/absolute/path/to/this/repo/.github/scripts/sentry/triage.sh
```

```ini
# ~/.config/systemd/user/sentry-triage.timer
[Unit]
Description=Run Sentry Auto Triage every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and inspect it:

```bash
systemctl --user daemon-reload
systemctl --user enable --now sentry-triage.timer
systemctl --user list-timers --all sentry-triage.timer
journalctl --user -u sentry-triage.service -n 100 --no-pager
```

Stop it:

```bash
systemctl --user disable --now sentry-triage.timer
```

## Cron Alternative

Example every five minutes:

```cron
*/5 * * * * cd /absolute/path/to/this/repo && . ./.github/scripts/sentry/triage.env && ./.github/scripts/sentry/triage.sh >> /tmp/kotonoha-sentry-triage-cron.log 2>&1
```

Prefer loading real secrets from a private file outside git.

## Sentry Note Completion

Full completion means:

1. Create the PR, create the GitHub issue, or classify the issue as cause-only.
2. Write a Sentry issue note with the PR link, GitHub issue link, or cause explanation.
3. Mark the local ledger record as completed only after the note succeeds.

Notes include a `Sentry triage completed: <short-id>` marker. On retry, the runner searches recent issue notes for that marker and external URL before posting, so a timeout after Sentry accepted the note is unlikely to create duplicate completion comments. Increase `SENTRY_TRIAGE_NOTE_COMPLETION_LOOKUP_LIMIT` for issues with long activity histories.

## Safety Checks

Recommended before enabling cron:

```bash
bash -n .github/scripts/sentry/triage.sh
shellcheck .github/scripts/sentry/triage.sh
rg -n 'sentry_api(_page)? .*(PUT|PATCH|DELETE)|/issues/.*/(resolve|resolved|ignored|archive)' .github/scripts/sentry/triage.sh
rg -n "deplo[y]\\.sh|kubectl roll[o]ut|pr[o]d deploy" .github/scripts/sentry/triage.sh .github/scripts/sentry/prompts
rg -n "c[o]dex exec --ask-for-approval|c[o]dex exec --sandbox workspace-write" .github/scripts/sentry/triage.sh .github/scripts/sentry/prompts
```
