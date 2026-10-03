# k3s Deploy

Deployment runs on a local k3s cluster. Backend (api, worker), DB, RabbitMQ, admin-api, admin-web, and the batch CronJobs are deployed through `deploy.sh`.

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
- Prod admin runs at `https://kotonoha.eastshine.dev/admin`; it needs a `kotonoha.eastshine.dev` A record pointing at the same LB IP as `api.kotonoha.eastshine.dev`. See `docs/admin-service.md`.
- Prod requires `ADMIN_PASSWORD_SHA256` and `ADMIN_TOKEN_SECRET` in `.env.prod`; `deploy.sh` refuses to deploy without them.
- Both clusters need a one-time bootstrap before the first deploy: `k8s/dev/bootstrap/apply.sh` (local k3s) and `k8s/prod/bootstrap/apply.sh` (Hetzner). They install the RabbitMQ operators; `deploy.sh` stops with a pointer if the CRDs are missing.

## Worker and Batch CronJobs

`worker` is the resident pod that consumes the song-analysis queue. `batch` no longer runs as a
Deployment — its image runs one task and exits (`--task=<name>`), and k8s CronJobs own the schedule.

RabbitMQ 는 오퍼레이터가 소유한다. `RabbitmqCluster` CR 하나가 브로커를, `Queue`/`Exchange`/`Binding`
CR 이 토폴로지를 선언하고, 앱은 이름만 참조한다 (`spring.rabbitmq.dynamic: false`).

```bash
kubectl get cronjob -n <ns>
kubectl logs -n <ns> -l app=worker -f

# 즉시 한 번 실행 (dev 의 CronJob 은 전부 suspend 되어 있다)
kubectl create job --from=cronjob/freeze-consume fc-$(date +%s) -n <ns>
kubectl create job --from=cronjob/streak-reminder-evening sr-$(date +%s) -n <ns>
kubectl create job --from=cronjob/apple-music-recommendation amr-$(date +%s) -n <ns>

# 가사 단어 후보 백필은 스케줄이 없는 수동 전용 CronJob 이다. 인자를 바꾸려면 Job 을 직접 편집한다.
kubectl create job --from=cronjob/lyric-word-candidate-backfill backfill-$(date +%s) -n <ns>

# 큐 상태
kubectl get rabbitmqcluster,queues,exchanges,bindings -n <ns>   # CR 조정 결과
kubectl port-forward -n <ns> svc/rabbitmq 15672:15672           # 관리 UI
kubectl exec -n <ns> statefulset/rabbitmq-server -- rabbitmqctl list_queues name messages

# 브로커 자격증명 (오퍼레이터가 생성)
kubectl get secret rabbitmq-default-user -n <ns> -o jsonpath='{.data.password}' | base64 -d
```

토폴로지 CR 이 `Ready` 가 아니면 worker 가 큐를 찾지 못한다. `kubectl describe queue song-analysis-work -n <ns>`
로 조정 실패 사유를 본다. `deploy.sh` 는 배포 끝에 이 조건들을 기다린다.

DLQ(`song-analysis.work.dlq`)에 메시지가 쌓이면 브로커가 아니라 worker 환경(주로 DB 접근)을 본다.
분석 자체의 실패는 `song_analysis_work` 행이 `FAILED` 로 남고 DLQ 에는 오지 않는다.

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
| `GITHUB_VOC_TOKEN` | Fine-grained PAT (Issues: write on `eastshine2741/japanese-vocabulary`) used by `POST /api/voc` to file `type:voc` issues; blank makes the endpoint return 503 |
| `JWT_SECRET` | JWT signing key; defaults to dev key |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Web OAuth Client ID, same audience as `EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID` |
| `PENCIL_CLI_KEY` | Pencil CLI auth for headless `.pen` editing |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | Base64-encoded Firebase service account JSON. worker / batch cron / admin-api 가 함께 마운트한다 |
| `ADMIN_PASSWORD` / `ADMIN_PASSWORD_SHA256` | Admin API password source. Local dev defaults `ADMIN_PASSWORD` to `admin` in `deploy.sh` if unset |
| `ADMIN_TOKEN_SECRET` | Admin-only bearer token signing key. Separate from public `JWT_SECRET` |
