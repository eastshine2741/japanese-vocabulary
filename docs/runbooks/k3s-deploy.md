# k3s Deploy

Deployment runs on a local k3s cluster. Backend, DB, admin-api, admin-web, and batch are deployed through `deploy.sh`.

```bash
./deploy.sh              # current branch name decides namespace
./deploy.sh foo          # explicit namespace
./deploy.sh foo --restore-dev-dump
./teardown.sh            # delete current branch namespace; refuses main
./teardown.sh foo        # delete explicit namespace
```

Rules:

- Image tags use the git commit SHA. Uncommitted changes are not deployed.
- Secrets come from repo-root `.env` (gitignored), then `envsubst` fills templates.
- `deploy.sh` passes an explicit kubectl context for the selected environment (`default` for dev).
- Local dev admin web is available through `http://localhost/<namespace>/admin` when k3s ingress is running.
- Port-forward `svc/admin-api 8081:8081` only for direct Admin API checks.

## Dev MySQL Dump Restore

Use a local dump when a fresh worktree namespace should start from the shared dev DB contents.

```bash
mkdir -p local/mysql
# Put the dump here manually. This path is gitignored.
local/mysql/dev-dump.sql

./deploy.sh <namespace> --restore-dev-dump
```

Restore rules:

- This is dev-only. `DEPLOY_ENV=prod ./deploy.sh --restore-dev-dump` fails.
- The dump is imported after the MySQL StatefulSet is ready and before the Flyway migration job runs.
- The dump is only accepted for a fresh MySQL PVC. If `mysql-data-mysql-0` already exists in the namespace, deploy fails rather than overwriting the worktree DB.
- If restore fails after the PVC was created, delete the namespace with `./teardown.sh <namespace>` before retrying.
- Dump creation and refresh are manual. `deploy.sh` does not dump from the `main` namespace.

## Multi-worktree Frontend

`DEPLOY_NS` separates Android package names so multiple branch builds can coexist on the same device.

```bash
cd app-rn
DEPLOY_NS=issue-21 npx expo run:android
```

- Missing `DEPLOY_NS` defaults to `main`, producing `dev.eastshine.kotonoha.main`.
- If the package name changes, run `npx expo prebuild --clean` to regenerate `android/`.
- `android/` is gitignored and generated per worktree.
- Google OAuth needs a separate client_id per namespace.
- `app-rn/.env` `EXPO_PUBLIC_BACKEND_URL` must point at the matching namespace server.
- Worktree packages may lack a `google-services.json` client. Use `EXPO_PUBLIC_FIREBASE_DISABLED=1` to disable Firebase push during local builds; first run needs `prebuild --clean` because plugin configuration changes.

## Environment Variables

`.env` lives at repo root and is gitignored.

| Variable | Purpose |
|---|---|
| `MYSQL_USER` / `MYSQL_PASSWORD` | MySQL credentials |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `JWT_SECRET` | JWT signing key; defaults to dev key |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Web OAuth Client ID, same audience as `EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID` |
| `PENCIL_CLI_KEY` | Pencil CLI auth for headless `.pen` editing |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | Base64-encoded Firebase service account JSON |
| `ADMIN_PASSWORD` / `ADMIN_PASSWORD_SHA256` | Admin API password source. Local dev defaults `ADMIN_PASSWORD` to `admin` in `deploy.sh` if unset |
| `ADMIN_TOKEN_SECRET` | Admin-only bearer token signing key. Separate from public `JWT_SECRET` |
