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
- Prod needs a one-time bootstrap before the first deploy (`k8s/prod/bootstrap/apply.sh`): CCM, CSI, cert-manager, the Traefik LB annotation. Local k3s needs none — `./deploy.sh <ns>` is enough.

## Worker and Batch CronJobs

`worker` is the resident pod that consumes the song-analysis queue. `batch` no longer runs as a
Deployment — its image runs one task and exits (`--task=<name>`), and k8s CronJobs own the schedule.

RabbitMQ 는 네임스페이스마다 단일 노드 StatefulSet 이고, 큐 토폴로지는 오퍼레이터가 아니라
브로커가 부팅 때 읽는 definitions 파일이 소유한다. 앱은 이름만 참조한다
(`spring.rabbitmq.dynamic: false`).

| | |
|---|---|
| `rabbitmq/configmap.yaml` | `rabbitmq.conf`, `enabled_plugins`, `00-topology.json` (exchange/queue/binding) |
| `rabbitmq/secret.template.yaml` | `username`/`password` + `10-users.json` (계정 선언) |
| `rabbitmq/statefulset.template.yaml` | 브로커와 Service 둘 |

두 definitions 파일은 `/etc/rabbitmq/definitions.d/` 에 각각 `subPath` 로 마운트되고 파일 이름
순서대로 import 된다 — vhost 를 만드는 `00` 이 계정 `10` 보다 먼저여야 한다. 디렉터리째로 마운트하면
ConfigMap 볼륨이 만드는 `..data` 링크와 타임스탬프 디렉터리를 RabbitMQ 가 파일로 읽으려다
`eisdir` 로 부팅에 실패한다. 계정이 ConfigMap 이
아니라 Secret 에 있는 이유는, definitions 가 있으면 RabbitMQ 가 기본 계정 시딩을 건너뛰어
(`Will not seed default virtual host and user`) `RABBITMQ_DEFAULT_USER` 가 무시되기 때문이다.
계정도 definitions 로 선언해야 하고 그러면 비밀번호가 import 파일에 들어간다.

알아야 할 세 가지:

- **import 는 부팅 때만 돈다.** ConfigMap 을 고쳐도 파드가 그대로면 아무 일도 없다. `deploy.sh` 가
  두 선언의 해시를 파드 템플릿 annotation 에 넣어 롤아웃을 트리거한다.
- **기존 큐의 `arguments` 변경은 조용히 무시된다.** 에러도 경고도 없이 기존 값이 남는다.
  `x-dead-letter-*` 같은 인자를 바꾸려면 큐를 지우고 재시작해야 한다.
- **선언에 구조적 오류가 있으면 브로커가 부팅에서 죽는다.** (예: vhost 보다 계정이 먼저 오면
  `Please create virtual host "/" prior to importing definitions.`) `deploy.sh` 의
  `rollout status` 가 여기서 멈춘다.

재시작마다 재import 되므로 누가 손으로 지운 큐는 다음 재시작에 돌아온다. 돌아올 때까지는 없는
상태로 남는다 — 오퍼레이터의 상시 reconcile 과 다른 점이다.

```bash
kubectl get cronjob -n <ns>
kubectl logs -n <ns> -l app=worker -f

# 즉시 한 번 실행 (dev 의 CronJob 은 전부 suspend 되어 있다)
kubectl create job --from=cronjob/freeze-consume fc-$(date +%s) -n <ns>
kubectl create job --from=cronjob/streak-reminder-evening sr-$(date +%s) -n <ns>

# 가사 단어 후보 백필은 스케줄이 없는 수동 전용 CronJob 이다. 인자를 바꾸려면 Job 을 직접 편집한다.
kubectl create job --from=cronjob/lyric-word-candidate-backfill backfill-$(date +%s) -n <ns>

# 큐 상태
kubectl exec -n <ns> statefulset/rabbitmq -- rabbitmqctl list_queues name messages
kubectl exec -n <ns> statefulset/rabbitmq -- rabbitmqctl list_bindings
kubectl port-forward -n <ns> svc/rabbitmq 15672:15672           # 관리 UI

# 토폴로지 import 결과
kubectl logs -n <ns> statefulset/rabbitmq | grep -i 'definitions\|Importing'

# 브로커 자격증명 (deploy.sh 가 생성, 재배포 시 재사용)
kubectl get secret rabbitmq-default-user -n <ns> -o jsonpath='{.data.password}' | base64 -d

# 토폴로지만 다시 넣기 (ConfigMap 을 고친 뒤 deploy.sh 없이)
kubectl rollout restart -n <ns> statefulset/rabbitmq
```

브로커가 `CrashLoopBackOff` 면 거의 항상 definitions import 실패다. 위 `kubectl logs` 로
`failed_to_import_definitions` 를 찾는다. AMQP listener 는 import 가 끝난 뒤에 열리므로,
파드가 Ready 라면 큐는 있다.

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
| `DISCORD_ALERT_WEBHOOK_URL` | `.env.prod` only. Discord webhook for prod Alertmanager (warning/critical); `k8s/observability/install.sh` fills it into `k8s/observability/alertmanager.yaml` and stores the result as the `monitoring/alertmanager-config` Secret |
