# Sentry Auto Triage Runner

Local cron runner for unresolved Sentry issues. It polls Sentry, asks Codex to choose exactly one outcome, then marks the Discord Sentry notification as handled.

Outcomes:

- PR for a narrow clear fix.
- GitHub issue for broad or low-confidence work.
- Cause-only Discord reply for minor, transient, expected, or external causes.

The runner does not resolve, ignore, archive, delete, or otherwise mutate Sentry issues.

## Files

- `.github/scripts/sentry-triage.sh` - cron-safe runner.
- `.github/scripts/prompts/sentry/triage.md` - Codex classification prompt.
- `.github/scripts/schemas/sentry-triage-result.schema.json` - Codex output schema.
- `.github/scripts/schemas/sentry-pr-implementation-result.schema.json` - second-pass PR implementation schema.
- `.github/scripts/sentry-triage.env.example` - public-safe env list.
- `.github/scripts/fixtures/sentry-triage/` - dry-run fixtures.

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

Codex is launched with a scrubbed environment (`env -i`) so Sentry, Discord, GitHub, deployment, and app secrets from the cron shell are not inherited. The PR worktree is created with `git worktree add` and intentionally does not copy ignored local config such as `.env`, keystores, service account files, or mobile app env files.

## Environment

Use `.github/scripts/sentry-triage.env.example` as a template. Required live variables:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT` as the numeric Sentry project id accepted by the organization issues API, or comma-separated `SENTRY_PROJECTS`
- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`

Optional:

- `SENTRY_ENVIRONMENT`
- `SENTRY_ENVIRONMENTS` for comma-separated repeated environment filters
- `SENTRY_TRIAGE_REPLAY_DAYS`, default `7`
- `SENTRY_TRIAGE_MAX_PAGES`, default `5`
- `SENTRY_TRIAGE_PR_MAX_CHANGED_FILES`, default `8`
- `SENTRY_TRIAGE_PR_MAX_DIFF_LINES`, default `400`
- `SENTRY_TRIAGE_DISCORD_COMPLETION_LOOKUP_PAGES`, default `5`
- `SENTRY_TRIAGE_DISCORD_FALLBACK=1` to post a bot-owned fallback message when the original Sentry Discord notification cannot be found
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

The ledger records each issue by Sentry issue id. `actionStatus=external_created` means a PR or GitHub issue already exists and the next run should retry only Discord completion.

The Sentry poll query uses the replay window and cursor pagination. If the configured page cap is reached while Sentry still advertises a next page, the runner logs a truncation warning and relies on the next cron run plus local ledger dedupe.

## Dry Run

Run fixture paths without external mutation:

```bash
.github/scripts/sentry-triage.sh --dry-run --fixture .github/scripts/fixtures/sentry-triage/pr-small-null-check.json
.github/scripts/sentry-triage.sh --dry-run --fixture .github/scripts/fixtures/sentry-triage/github-issue-large-refactor.json
.github/scripts/sentry-triage.sh --dry-run --fixture .github/scripts/fixtures/sentry-triage/cause-only-transient.json
.github/scripts/sentry/run-dry-run-tests.sh
```

Use an isolated state file for replay checks:

```bash
tmp_state="$(mktemp)"
printf '{"version":1,"issues":{},"attempts":[]}\n' > "$tmp_state"
.github/scripts/sentry-triage.sh --dry-run --record-dry-run --state-file "$tmp_state" --fixture .github/scripts/fixtures/sentry-triage/partial-success-discord-failed.json
```

## Cron

Example every five minutes:

```cron
*/5 * * * * cd /absolute/path/to/this/repo && . ./.github/scripts/sentry-triage.env && ./.github/scripts/sentry-triage.sh >> /tmp/kotonoha-sentry-triage-cron.log 2>&1
```

Prefer loading real secrets from a private file outside git.

## Discord Completion

Full completion means:

1. Find the original Sentry Discord notification by Sentry permalink or short id.
2. Add the handled emoji.
3. Reply using `message_reference` with the PR link, GitHub issue link, or cause explanation.

Replies include `allowed_mentions: { "parse": [] }` and a `Sentry triage completed: <short-id>` marker. On retry, the runner searches up to `SENTRY_TRIAGE_DISCORD_COMPLETION_LOOKUP_PAGES * SENTRY_TRIAGE_DISCORD_HISTORY_LIMIT` recent messages for that marker before posting so a timeout after Discord accepted the reply is unlikely to create duplicate completion comments. Increase those values for busy channels.

If the bot cannot read or mutate the original Sentry notification, enable `SENTRY_TRIAGE_DISCORD_FALLBACK=1`. In fallback mode the runner posts a bot-owned triage message keyed by the Sentry issue, and docs/logs should not claim original-message mutation support.

## Safety Checks

Recommended before enabling cron:

```bash
bash -n .github/scripts/sentry-triage.sh
shellcheck .github/scripts/sentry-triage.sh
rg -n 'sentry_api(_page)? .*(PUT|POST|PATCH|DELETE)|/issues/.*/(resolve|resolved|ignored|archive)' .github/scripts/sentry-triage.sh
rg -n "deplo[y]\\.sh|kubectl roll[o]ut|pr[o]d deploy" .github/scripts/sentry-triage.sh .github/scripts/prompts/sentry
rg -n "c[o]dex exec --ask-for-approval|c[o]dex exec --sandbox workspace-write" .github/scripts/sentry-triage.sh .github/scripts/prompts/sentry
```
