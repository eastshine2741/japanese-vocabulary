# Issue Resolver Runner

Local GitHub issue automation runner. It polls GitHub issues by labels and invokes Claude phase prompts.

This is separate from the Sentry auto-triage runner:

- `issue-resolver/` handles GitHub issues labeled `status:new`, `status:feedback`, and `status:approved`.
- `sentry/` handles Sentry error triage and Discord completion.

## Files

- `resolve.sh` - systemd-timer-safe runner.
- `prompts/preamble.md` - shared prompt preamble.
- `prompts/phase-a-analyze.md` - analyze new issues.
- `prompts/phase-b-revise.md` - revise plans from feedback.
- `prompts/phase-c-implement.md` - implement approved issues.

## User Systemd Timer

The local timer points at:

```text
~/.config/systemd/user/issue-resolver.timer
~/.config/systemd/user/issue-resolver.service
```

The service should execute:

```text
.github/scripts/issue-resolver/resolve.sh
```
