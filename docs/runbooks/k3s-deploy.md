# k3s Deploy

Deployment runs on a local k3s cluster. Backend (api, worker), DB, RabbitMQ, admin-api, admin-web, share-web (card share web page), landing-web (service intro page at `/`), and the batch CronJobs are deployed through `deploy.sh`.

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

# 즉시 한 번 실행
kubectl create job --from=cronjob/freeze-consume fc-$(date +%s) -n <ns>
kubectl create job --from=cronjob/streak-reminder-evening sr-$(date +%s) -n <ns>

# 가사 단어 후보 백필은 스케줄이 없는 수동 전용 CronJob 이다. 인자를 바꾸려면 Job 을 직접 편집한다.
kubectl create job --from=cronjob/lyric-word-candidate-backfill backfill-$(date +%s) -n <ns>

# 가사 토큰 reading 을 SungReading 규칙으로 다시 쓴다(재분석 없음). 먼저 Job args 에 --dryRun=true 를 붙여 로그로 바뀔 곳을 본다.
# lyrics 에 낙관적 락이 없어 같은 시각의 재분석·제보 승인을 덮어쓸 수 있다. 분석 작업이 없을 때 돌린다.
kubectl create job --from=cronjob/lyric-reading-backfill reading-$(date +%s) -n <ns>

# 곡 MV 재생 불가 이유(songs.mv_unavailable_reason, V53)를 채우는 수동 백필. V53 배포 뒤 한 번 돌린다. 곡 700개에 15 unit 남짓.
# batch-secret 의 YOUTUBE_API_KEY 를 쓴다(worker 와 같은 키, 같은 하루 quota).
kubectl create job --from=cronjob/mv-playability-backfill mvplay-$(date +%s) -n <ns>

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

## Prod Monitoring

`k8s/observability/install.sh` 가 kube-prometheus-stack 을, `deploy.sh` 가 앱·MySQL·RabbitMQ ServiceMonitor 를 올린다.

- Grafana 는 `https://grafana.kotonoha.eastshine.dev` 에 공개되고 built-in admin 로그인 하나로만 막힌다. DNS 레코드는 `api` 와 같은 이유로 proxy 를 끈다.
- `GRAFANA_ADMIN_USER`·`GRAFANA_ADMIN_PASSWORD` 는 Grafana DB 에 사용자가 하나도 없을 때만 쓰인다. PVC 에 DB 가 남아 있으면 `install.sh` 를 다시 돌려도 기존 계정의 이름·비밀번호는 그대로다. 그래서 바꿀 땐 손으로 먼저 바꾸고 `.env.prod` 를 맞춘 다음 `install.sh` 를 돌린다 (dashboard sidecar 가 이 값으로 reload API 를 부르므로 어긋나면 reload 가 401 로 실패한다).
  - 이름: `kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80` 후 `http://localhost:3000` 에 admin 으로 로그인 → Administration → Users and access → Users → `admin` → Username 을 `GRAFANA_ADMIN_USER` 로 바꾼다.
  - 비밀번호: `kubectl -n monitoring exec deploy/kube-prometheus-stack-grafana -c grafana -- grafana cli admin reset-admin-password '<새 비밀번호>'`
- mysqld-exporter 계정·비밀번호는 `deploy.sh` 가 매 배포 맞춘다.
- `long_query_time` 은 같은 단계에서 `SET PERSIST` 로 1초로 건다 (datadir 의 `mysqld-auto.cnf` 에 남아 재시작 없이 유지된다). 슬로 쿼리 로그는 꺼 둔다. `Slow_queries` 카운터는 로그와 무관하게 오르고, 어떤 쿼리인지는 perf_schema 다이제스트 패널에서 본다. 로그를 켜면 FILE·TABLE(`mysql.slow_log`, CSV 엔진) 모두 로테이션 없이 10Gi PVC 에 쌓인다. 기존 커넥션은 접속 때 받은 세션 값을 쓰므로 앱이 재연결해야 1초 기준이 다 적용된다.
- `grafana-bigquery` Secret 은 env 로 읽혀서, 키만 바꾸면 Grafana 가 모른다. `kubectl -n monitoring rollout restart deploy/kube-prometheus-stack-grafana`.

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
| `APPLE_MUSIC_TEAM_ID` / `APPLE_MUSIC_KEY_ID` / `APPLE_MUSIC_PRIVATE_KEY_BASE64` | MusicKit key (`base64 -w0 AuthKey_<KEY_ID>.p8`) that signs the Apple Music API developer token. api(검색) / worker(아티스트 별칭 확인) / batch(노래방 신곡 매칭) 가 쓴다 |
| `GITHUB_VOC_TOKEN` | Fine-grained PAT (Issues: write on `eastshine2741/japanese-vocabulary`) used by `POST /api/voc` to file `type:voc` issues; blank makes the endpoint return 503 |
| `GEMINI_API_KEY` | Gemini — sense-select 을 뺀 단어 뜻 파이프라인 LLM 단계 (`worker`) |
| `TYPESAFE_API_KEY` | TypeSafe Jev — sense-select 단계 (`worker`) |
| `OBJECT_STORAGE_ENDPOINT` / `_BUCKET` / `_ACCESS_KEY` / `_SECRET_KEY` / `_PUBLIC_BASE_URL` | Cloudflare R2 (`kotonoha-prod` / `kotonoha-dev`, dev 네임스페이스 공유, `infra/terraform` 이 만든다). 프로필 이미지 업로드. 하나라도 비면 업로드 API 가 503 |
| `JWT_SECRET` | JWT signing key; defaults to dev key |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Web OAuth Client ID, same audience as `EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID` |
| `PENCIL_CLI_KEY` | Pencil CLI auth for headless `.pen` editing |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | Base64-encoded Firebase service account JSON. worker / batch cron / admin-api 가 함께 마운트한다 |
| `ADMIN_PASSWORD` / `ADMIN_PASSWORD_SHA256` | Admin API password source. Local dev defaults `ADMIN_PASSWORD` to `admin` in `deploy.sh` if unset |
| `ADMIN_TOKEN_SECRET` | Admin-only bearer token signing key. Separate from public `JWT_SECRET` |
| `ADMIN_LYRIC_SYNC_AGENT_TOKEN` | 로컬 PC 가사 싱크 실행기(`lyric-sync-agent/`)가 admin-api 에 쓰는 고정 토큰(32자 이상, `openssl rand -hex 32`). 이 토큰은 실행기 API 만 열고 admin 화면 API 는 못 쓴다. 비면 실행기 API 가 닫힌다(prod 는 경고만) |
| `SHARE_APPLE_APP_ID` | `.env.prod`. `<TeamID>.dev.eastshine.kotonoha`. 비면 `/.well-known/apple-app-site-association` 이 404 라 카드 공유 링크(`/c/*`)가 Universal Link 로 앱을 열지 않는다 |
| `SHARE_ANDROID_SHA256_FINGERPRINTS` | `.env.prod`. 앱 서명 인증서 SHA-256 (Play 앱 서명 키, 쉼표로 여러 개). 비면 `/.well-known/assetlinks.json` 이 404 라 App Links 검증이 안 된다 |
| `SHARE_TOKEN_KEYS` | 카드 공유 링크 서명 키. `kid:secret`(secret 32자 이상)을 쉼표로 잇고 첫 키로 서명한다. prod 필수(`.env.prod`, 예 `s1:$(openssl rand -hex 32)`), dev 는 기본값. 키를 버리면 올라간 링크가 깨지므로 바꿀 땐 새 키를 앞에 붙이고 옛 키를 남긴다 |
| `SHARE_DEV_ORIGIN` | dev 전용. 카드 공유 링크 호스트 (기본 `http://localhost`, 링크는 `<origin>/<ns>/c/{token}`). 폰에서 열려면 앱 `EXPO_PUBLIC_BACKEND_URL` 의 호스트를 `http://<IP>.sslip.io` 로 쓴다 — X 는 IP 주소를 링크로 보지 않아 23자로 줄여 세지 않고 전부 세서 글자 수를 넘긴다 |
| `SHARE_APP_SCHEME` | dev 는 `deploy.sh` 가 `kotonoha.<ns 영숫자만>` 으로 채운다(앱 scheme 과 같은 규칙). prod 는 기본 `kotonoha` |
| `GRAFANA_BIGQUERY_SA_KEY_BASE64` | `.env.prod` only. Grafana BigQuery 데이터소스(uid `bigquery`)용 서비스 계정 키 `base64 -w0`. `install.sh` 가 `monitoring/grafana-bigquery` Secret 으로 만든다. 생성 절차와 하루 할당량 설정은 표 아래. |
| `DISCORD_ALERT_WEBHOOK_URL` | `.env.prod` only. Discord webhook for prod Alertmanager (warning/critical); `k8s/observability/install.sh` fills it into `k8s/observability/alertmanager.yaml` and stores the result as the `monitoring/alertmanager-config` Secret |

`GRAFANA_BIGQUERY_SA_KEY_BASE64` 서비스 계정 (Browser 역할이 없어 데이터소스 설정 화면의 프로젝트 드롭다운은 비지만, `defaultProject` 가 고정이라 쿼리엔 지장 없다):

```bash
P=japanese-vocabulary-490916
SA=grafana-bigquery@$P.iam.gserviceaccount.com
gcloud iam service-accounts create grafana-bigquery --project "$P"
gcloud projects add-iam-policy-binding "$P" --member "serviceAccount:$SA" --role roles/bigquery.jobUser
bq query --project_id "$P" --location asia-northeast3 --use_legacy_sql=false \
  "GRANT \`roles/bigquery.dataViewer\` ON SCHEMA \`$P.analytics_539684755\` TO 'serviceAccount:$SA'"
gcloud iam service-accounts keys create grafana-bigquery.json --iam-account "$SA"
base64 -w0 grafana-bigquery.json   # → GRAFANA_BIGQUERY_SA_KEY_BASE64, 그다음 json 파일은 지운다
```

BigQuery 하루 할당량 (콘솔에서 한 번): IAM & Admin → Quotas & System Limits → Service 필터 `BigQuery API` → "Query usage per day" 선택 → Edit → Unlimited 해제 → `0.01`(TiB, 약 10 GB) → Submit request.
데이터소스의 `MaxBytesBilled`(1GiB)는 쿼리 1건마다의 상한이라, 새로고침이 반복되면 하루 총량은 막지 못한다. 이 할당량은 프로젝트 전체(모든 사용자·도구) 합계라 넘으면 태평양 시간 자정까지 이 프로젝트의 BigQuery 쿼리가 전부 `usageQuotaExceeded` 로 실패한다.
