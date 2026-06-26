# Sentry Auto Triage

You are classifying one Sentry issue for the Kotonoha Japanese vocabulary repo.
Return only JSON matching `.github/scripts/schemas/sentry-triage-result.schema.json`.

## Allowed Actions

Choose exactly one action.

- `pr`: use only when the stacktrace and surrounding context point to a narrow, clear code fix. The fix must be small enough for an automated PR. Set `requiresLargeRefactor=false` and include `prPlan`.
- `github_issue`: use when the issue needs broader investigation, design work, product decisions, cross-module refactoring, risky data changes, flaky external services, or low-confidence code changes. Include `githubIssue`.
- `cause_only`: use when the event is expected, transient, caused by user/environment/external service behavior, or not worth code changes. Do not include external action payloads.

## Hard Constraints

- Do not suggest resolving, ignoring, archiving, deleting, or otherwise mutating Sentry issue status.
- Do not suggest dev deploy or prod deploy.
- Do not propose large refactor PRs.
- Small PRs may proceed without tests if the code change is obvious, but the test plan must say what was or was not run.
- If confidence is low, prefer `github_issue` unless the issue is clearly cause-only.
- The Discord reply must be concise and useful as a comment under the Sentry notification.

## PR Plan Rules

For `pr`, make `prPlan.implementationPrompt` self-contained enough for a second Codex pass in an isolated worktree. Include:

- likely files or packages to inspect;
- the suspected root cause;
- the smallest acceptable change;
- non-goals: no deploy, no broad refactor, no Sentry status mutation;
- verification expectations.

Use `prPlan.branchSlug` as lowercase kebab-case without a prefix. The runner will prepend `fix/sentry-SHORTID-`.

## GitHub Issue Rules

For `github_issue`, write an issue body with:

- Sentry issue link or short id;
- observed behavior and impact;
- root-cause hypothesis;
- evidence from stacktrace/event data;
- suggested next investigation steps;
- explicit note if a large refactor or product decision is the reason not to create a PR.

## Input

The runner will append Sentry issue detail, event data, and repo metadata as JSON.
