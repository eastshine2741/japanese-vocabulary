#!/bin/bash
# deploy.sh - k3s 배포 스크립트
# Usage:
#   ./deploy.sh [namespace] [--restore-dev-dump]  # dev (k3s local, default context)
#   DEPLOY_ENV=prod ./deploy.sh                   # prod (Hetzner k3s, kotonoha-prod context)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
TOTAL_START=$SECONDS
RESTORE_DEV_DUMP=false
DEV_MYSQL_DUMP_FILE="$PROJECT_ROOT/local/mysql/dev-dump.sql"
DEV_MYSQL_PVC="mysql-data-mysql-0"
DEPLOY_NS_ARG=""

DEPLOY_ENV="${DEPLOY_ENV:-dev}"

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh [namespace] [--restore-dev-dump]
  DEPLOY_ENV=prod ./deploy.sh

Options:
  --restore-dev-dump  Dev only. Restore local/mysql/dev-dump.sql into a fresh MySQL PVC before Flyway migration.
  -h, --help          Show this help.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --restore-dev-dump)
      RESTORE_DEV_DUMP=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "Error: unknown option '$arg'" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -n "$DEPLOY_NS_ARG" ]]; then
        echo "Error: multiple namespace arguments: '$DEPLOY_NS_ARG' and '$arg'" >&2
        usage >&2
        exit 1
      fi
      DEPLOY_NS_ARG="$arg"
      ;;
  esac
done

# prod의 IMAGE_PREFIX는 env 로드 후 GHCR_USERNAME으로 조립한다.
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  KUBE_CONTEXT="kotonoha-prod"
  NS="kotonoha"
  ENV_FILE="$PROJECT_ROOT/.env.prod"
  K8S_DIR="$PROJECT_ROOT/k8s/prod"
elif [[ "$DEPLOY_ENV" == "dev" ]]; then
  KUBE_CONTEXT="default"
  ENV_FILE="$PROJECT_ROOT/.env"
  IMAGE_PREFIX="japanese-vocabulary"
  K8S_DIR="$PROJECT_ROOT/k8s/dev"
else
  echo "Error: invalid DEPLOY_ENV '$DEPLOY_ENV' (expected: dev | prod)" >&2
  exit 1
fi

# 활성 context와 무관하게 DEPLOY_ENV의 context로 배포한다.
kubectl() {
  command kubectl --context "$KUBE_CONTEXT" "$@"
}

if [[ "$DEPLOY_ENV" == "dev" ]]; then
  if [[ -n "$DEPLOY_NS_ARG" ]]; then
    NS="$DEPLOY_NS_ARG"
  else
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    NS="${BRANCH##*/}"
    NS="$(echo "$NS" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')"
  fi
  if [[ ! "$NS" =~ ^[a-z][a-z0-9-]*$ ]]; then
    echo "Error: invalid namespace '$NS'" >&2
    exit 1
  fi
fi

if [[ "$RESTORE_DEV_DUMP" == "true" && "$DEPLOY_ENV" != "dev" ]]; then
  echo "Error: --restore-dev-dump is only supported with DEPLOY_ENV=dev" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ "$DEPLOY_ENV" == "prod" ]]; then
  if [[ -z "${GHCR_USERNAME:-}" || -z "${GHCR_TOKEN:-}" ]]; then
    echo "Error: GHCR_USERNAME / GHCR_TOKEN not set in $ENV_FILE" >&2
    exit 1
  fi
  IMAGE_PREFIX="ghcr.io/${GHCR_USERNAME}/kotonoha"

  # prod admin-api 는 평문 비밀번호 대신 sha256 해시와 토큰 시크릿을 요구한다.
  ADMIN_TOKEN_SECRET="${ADMIN_TOKEN_SECRET:-}"
  if [[ ! "${ADMIN_PASSWORD_SHA256:-}" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Error: ADMIN_PASSWORD_SHA256 must be a 64-char lowercase hex sha256 in $ENV_FILE" >&2
    echo "  generate: printf '%s' 'your-password' | sha256sum" >&2
    exit 1
  fi
  if [[ ${#ADMIN_TOKEN_SECRET} -lt 32 ]]; then
    echo "Error: ADMIN_TOKEN_SECRET must be at least 32 characters in $ENV_FILE" >&2
    echo "  generate: openssl rand -hex 32" >&2
    exit 1
  fi

  echo ""
  echo "⚠️  PROD DEPLOY"
  echo "  context:   $KUBE_CONTEXT"
  echo "  namespace: $NS"
  echo "  registry:  $IMAGE_PREFIX"
  echo ""
  read -rp "Type 'kotonoha' to continue: " CONFIRM
  if [[ "$CONFIRM" != "kotonoha" ]]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

GIT_SHA="$(git rev-parse --short HEAD)"
API_IMAGE="${IMAGE_PREFIX}-api:${GIT_SHA}"
BATCH_IMAGE="${IMAGE_PREFIX}-batch:${GIT_SHA}"
MIGRATION_IMAGE="${IMAGE_PREFIX}-migration:${GIT_SHA}"
ADMIN_API_IMAGE="${IMAGE_PREFIX}-admin-api:${GIT_SHA}"
ADMIN_WEB_IMAGE="${IMAGE_PREFIX}-admin-web:${GIT_SHA}"
WORKER_IMAGE="${IMAGE_PREFIX}-worker:${GIT_SHA}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
ADMIN_PASSWORD_SHA256="${ADMIN_PASSWORD_SHA256:-}"
if [[ "$DEPLOY_ENV" == "dev" ]]; then
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
  ADMIN_TOKEN_SECRET="${ADMIN_TOKEN_SECRET:-dev-admin-token-secret-must-be-at-least-32-bytes}"
fi

# 곡 분석 파이프라인이 batch 에서 worker 로 옮겨졌다. 전용 DSN 이 없으면 batch 가 쓰던 프로젝트로
# 계속 보낸다 — .github/scripts/analysis-feedback 러너가 그 프로젝트(kotonoha-batch-prod)를 읽는다.
SENTRY_DSN_WORKER="${SENTRY_DSN_WORKER:-${SENTRY_DSN_BATCH:-}}"

# admin-web 은 asset base 와 router basename 을 빌드 시점에 굽는다.
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  ADMIN_WEB_BASE_PATH="/admin"
else
  ADMIN_WEB_BASE_PATH="/${NS}/admin"
fi
ADMIN_WEB_API_BASE_URL="${ADMIN_WEB_BASE_PATH}/api"

if [[ "$DEPLOY_ENV" == "prod" ]]; then
  SENTRY_ENVIRONMENT="production"
else
  SENTRY_ENVIRONMENT="${NS}"
fi
SENTRY_RELEASE="${GIT_SHA}"

# build/libs 의 -plain.jar 를 제외한 boot jar 하나만 Dockerfile 에 넘긴다.
# admin-api 는 reels/ 가 필요해 build context 가 repo root 다 (3번째 인자).
build_boot_image() {
  local module="$1" image="$2" ctx="${3:-$PROJECT_ROOT/backend/$1}"
  local module_dir="$PROJECT_ROOT/backend/$module"
  local jar boot_jars=()

  for jar in "$module_dir"/build/libs/*.jar; do
    [[ -f "$jar" ]] || continue
    [[ "$jar" == *-plain.jar ]] && continue
    boot_jars+=("$(basename "$jar")")
  done

  if [[ ${#boot_jars[@]} -ne 1 ]]; then
    echo "Error: $module boot jar 를 하나로 특정할 수 없음 (found: ${boot_jars[*]:-none}). backend/$module/build/libs 확인." >&2
    exit 1
  fi

  docker build \
    --build-arg JAR_FILE="${boot_jars[0]}" \
    -t "$image" \
    -f "$module_dir/Dockerfile" "$ctx/"
}
export API_IMAGE BATCH_IMAGE WORKER_IMAGE MIGRATION_IMAGE ADMIN_API_IMAGE ADMIN_WEB_IMAGE NS SENTRY_ENVIRONMENT SENTRY_RELEASE
export ADMIN_PASSWORD ADMIN_PASSWORD_SHA256 ADMIN_TOKEN_SECRET
export SENTRY_DSN_WORKER

echo "=== env: $DEPLOY_ENV | namespace: $NS | sha: $GIT_SHA ==="

if [[ "$RESTORE_DEV_DUMP" == "true" ]]; then
  echo "[mysql] checking dev dump restore preconditions..."
  if kubectl get pvc "$DEV_MYSQL_PVC" -n "$NS" >/dev/null 2>&1; then
    echo "Error: --restore-dev-dump requested, but MySQL PVC '$DEV_MYSQL_PVC' already exists in namespace '$NS'." >&2
    echo "Refusing to overwrite an existing worktree database." >&2
    echo "To restore from the dump, first delete the namespace with: ./teardown.sh $NS" >&2
    exit 1
  fi
  if [[ ! -r "$DEV_MYSQL_DUMP_FILE" ]]; then
    echo "Error: dev dump file is not readable: $DEV_MYSQL_DUMP_FILE" >&2
    echo "Create or copy the dump to local/mysql/dev-dump.sql, then rerun with --restore-dev-dump." >&2
    exit 1
  fi
fi

STEP_START=$SECONDS
echo "[gradle] test + bootJar..."
cd "$PROJECT_ROOT/backend" && ./gradlew \
  :api:test :batch:test :worker:test :admin-api:test \
  :api:bootJar :batch:bootJar :worker:bootJar :admin-api:bootJar --no-daemon
cd "$PROJECT_ROOT"
echo "  → $((SECONDS - STEP_START))s"

STEP_START=$SECONDS
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  echo "[ghcr] login..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

  echo "[build] images..."
  build_boot_image api "$API_IMAGE"
  build_boot_image batch "$BATCH_IMAGE"
  build_boot_image worker "$WORKER_IMAGE"
  docker build -t "$MIGRATION_IMAGE" -f "$PROJECT_ROOT/backend/migration/Dockerfile" "$PROJECT_ROOT/backend/migration/"
  build_boot_image admin-api "$ADMIN_API_IMAGE" "$PROJECT_ROOT"
  docker build \
    --build-arg VITE_ADMIN_API_BASE_URL="$ADMIN_WEB_API_BASE_URL" \
    --build-arg VITE_ADMIN_BASE_PATH="$ADMIN_WEB_BASE_PATH" \
    -t "$ADMIN_WEB_IMAGE" \
    -f "$PROJECT_ROOT/admin-web/Dockerfile" "$PROJECT_ROOT"

  echo "[push] ghcr..."
  docker push "$API_IMAGE"
  docker push "$BATCH_IMAGE"
  docker push "$WORKER_IMAGE"
  docker push "$MIGRATION_IMAGE"
  docker push "$ADMIN_API_IMAGE"
  docker push "$ADMIN_WEB_IMAGE"
else
  echo "[build] images..."
  build_boot_image api "$API_IMAGE"
  build_boot_image batch "$BATCH_IMAGE"
  build_boot_image worker "$WORKER_IMAGE"
  docker build -t "$MIGRATION_IMAGE" -f "$PROJECT_ROOT/backend/migration/Dockerfile" "$PROJECT_ROOT/backend/migration/"
  build_boot_image admin-api "$ADMIN_API_IMAGE" "$PROJECT_ROOT"
  docker build \
    --build-arg VITE_ADMIN_API_BASE_URL="$ADMIN_WEB_API_BASE_URL" \
    --build-arg VITE_ADMIN_BASE_PATH="$ADMIN_WEB_BASE_PATH" \
    -t "$ADMIN_WEB_IMAGE" \
    -f "$PROJECT_ROOT/admin-web/Dockerfile" "$PROJECT_ROOT"

  echo "[k3s] importing images..."
  docker save "$API_IMAGE" "$BATCH_IMAGE" "$WORKER_IMAGE" "$MIGRATION_IMAGE" "$ADMIN_API_IMAGE" "$ADMIN_WEB_IMAGE" | sudo k3s ctr images import -
fi
echo "  → $((SECONDS - STEP_START))s"

STEP_START=$SECONDS
echo "[ns] ensuring namespace '$NS'..."
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
echo "  → $((SECONDS - STEP_START))s"

if [[ "$DEPLOY_ENV" == "prod" ]]; then
  STEP_START=$SECONDS
  echo "[secret] ghcr ImagePullSecret..."
  kubectl create secret docker-registry ghcr-pull \
    --docker-server=ghcr.io \
    --docker-username="$GHCR_USERNAME" \
    --docker-password="$GHCR_TOKEN" \
    --namespace="$NS" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "  → $((SECONDS - STEP_START))s"
fi

STEP_START=$SECONDS
echo "[apply] infra (mysql + redis + rabbitmq)..."
envsubst < "$K8S_DIR/mysql/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$K8S_DIR/mysql/statefulset.yaml"
kubectl apply -n "$NS" -f "$K8S_DIR/mysql/service.yaml"
kubectl apply -n "$NS" -f "$K8S_DIR/redis/"
# 브로커 계정. 오퍼레이터가 네임스페이스마다 만들어 주던 것을 여기서 만든다.
# api/admin-api/worker 가 secretKeyRef 로 읽으므로 파드보다 먼저 있어야 한다.
# 이미 있으면 비밀번호를 재사용한다 — 배포마다 바뀌면 재시작하지 않은 파드가 옛 자격증명으로 남는다.
RABBITMQ_PASSWORD="$(
  kubectl get secret rabbitmq-default-user -n "$NS" -o jsonpath='{.data.password}' 2>/dev/null \
    | base64 -d 2>/dev/null || true
)"
if [[ -z "$RABBITMQ_PASSWORD" ]]; then
  RABBITMQ_PASSWORD="$(openssl rand -hex 24)"
fi
export RABBITMQ_PASSWORD
envsubst < "$K8S_DIR/rabbitmq/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$K8S_DIR/rabbitmq/configmap.yaml"
# 토폴로지 import 는 브로커 부팅 때만 돈다. ConfigMap/Secret 만 바뀌면 파드가 그대로 남아
# 변경이 조용히 묻히므로, 두 선언의 해시를 파드 템플릿에 넣어 롤아웃을 트리거한다.
RABBITMQ_DEFINITIONS_HASH="$(
  {
    cat "$K8S_DIR/rabbitmq/configmap.yaml"
    envsubst < "$K8S_DIR/rabbitmq/secret.template.yaml"
  } | sha256sum | cut -c1-16
)"
export RABBITMQ_DEFINITIONS_HASH
envsubst < "$K8S_DIR/rabbitmq/statefulset.template.yaml" | kubectl apply -n "$NS" -f -
echo "  → $((SECONDS - STEP_START))s"

STEP_START=$SECONDS
echo "[migration] running..."
kubectl rollout status -n "$NS" statefulset/mysql --timeout=120s
if [[ "$RESTORE_DEV_DUMP" == "true" ]]; then
  echo "[mysql] restoring $DEV_MYSQL_DUMP_FILE before Flyway migration..."
  if ! kubectl exec -n "$NS" statefulset/mysql -- sh -c 'command -v mysql >/dev/null && command -v mysqladmin >/dev/null'; then
    echo "Error: mysql/mysqladmin client is not available in the mysql pod." >&2
    echo "Database PVC may already have been created. Recover with: ./teardown.sh $NS" >&2
    exit 1
  fi
  if ! kubectl exec -n "$NS" statefulset/mysql -- sh -c '
    for i in $(seq 1 60); do
      if MYSQL_PWD="$MYSQL_PASSWORD" mysqladmin ping -h127.0.0.1 -P3306 -u"$MYSQL_USER" --silent >/dev/null 2>&1; then
        exit 0
      fi
      sleep 2
    done
    exit 1
  '; then
    echo "Error: MySQL did not become ready for TCP connections within 120 seconds." >&2
    echo "Database PVC may already have been created. Recover with: ./teardown.sh $NS" >&2
    exit 1
  fi
  if ! kubectl exec -i -n "$NS" statefulset/mysql -- sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -P3306 -u"$MYSQL_USER" "$MYSQL_DATABASE"' < "$DEV_MYSQL_DUMP_FILE"; then
    echo "Error: failed to restore dev dump into namespace '$NS'." >&2
    echo "Database PVC may contain a partial import. Recover with: ./teardown.sh $NS" >&2
    exit 1
  fi
fi
kubectl delete job migration -n "$NS" --ignore-not-found
envsubst < "$K8S_DIR/migration/job.yaml" | kubectl apply -n "$NS" -f -
kubectl wait --for=condition=complete -n "$NS" job/migration --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

STEP_START=$SECONDS
echo "[apply] worker..."
# firebase 자격증명은 worker(분석 완료 알림), batch(연속 학습 알림), admin-api(수동 푸시)가 같이 쓴다.
envsubst < "$K8S_DIR/batch/firebase-secret.template.yaml" | kubectl apply -n "$NS" -f -

envsubst < "$K8S_DIR/worker/secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/worker/configmap.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/worker/deployment.yaml" | kubectl apply -n "$NS" -f -
[[ -f "$K8S_DIR/worker/service.yaml" ]] && kubectl apply -n "$NS" -f "$K8S_DIR/worker/service.yaml"
# worker 가 롤아웃을 마친 뒤에 api 를 올린다. 순서를 지키려고 여기서 기다린다.
# 토폴로지를 따로 기다릴 필요가 없다. AMQP listener 는 definitions import 가 끝난 뒤에 열리고
# readinessProbe 가 그 포트를 보므로, Ready 는 곧 큐가 있다는 뜻이다. 선언에 구조적 오류가 있으면
# 브로커가 부팅에서 죽어 여기서 멈춘다.
kubectl rollout status -n "$NS" statefulset/rabbitmq --timeout=300s
kubectl rollout status -n "$NS" deployment/worker --timeout=180s

echo "[apply] api + batch cronjobs..."
envsubst < "$K8S_DIR/api/secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/api/configmap.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/api/deployment.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$K8S_DIR/api/service.yaml"
envsubst < "$K8S_DIR/api/ingress.yaml" | kubectl apply -n "$NS" -f -

# batch 는 더 이상 상주하지 않는다. 남아 있는 예전 Deployment 를 걷어낸다.
kubectl delete deployment batch -n "$NS" --ignore-not-found
kubectl delete service batch -n "$NS" --ignore-not-found
# apply 는 매니페스트에서 빠진 CronJob 을 지우지 않는다.
kubectl delete cronjob apple-music-recommendation -n "$NS" --ignore-not-found
envsubst < "$K8S_DIR/batch/secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/batch/configmap.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/batch/cronjobs.yaml" | kubectl apply -n "$NS" -f -

echo "[apply] admin-api + admin-web..."
envsubst < "$K8S_DIR/admin-api/secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/admin-api/configmap.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/admin-api/deployment.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$K8S_DIR/admin-api/service.yaml"

envsubst < "$K8S_DIR/admin-web/deployment.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$K8S_DIR/admin-web/service.yaml"

if [[ "$DEPLOY_ENV" == "prod" ]]; then
  # prod 는 한 호스트를 path 로 나눠 쓴다 (admin/ 아래 cert + IngressRoute).
  kubectl apply -n "$NS" -f "$K8S_DIR/admin/certificate.yaml"
  kubectl apply -n "$NS" -f "$K8S_DIR/admin/ingress.yaml"
else
  envsubst < "$K8S_DIR/admin-api/ingress.yaml" | kubectl apply -n "$NS" -f -
  envsubst < "$K8S_DIR/admin-web/ingress.yaml" | kubectl apply -n "$NS" -f -
fi

for sm in "$K8S_DIR/api/servicemonitor.yaml" "$K8S_DIR/worker/servicemonitor.yaml" "$K8S_DIR/admin-api/servicemonitor.yaml"; do
  [[ -f "$sm" ]] && kubectl apply -n "$NS" -f "$sm"
done
echo "  → $((SECONDS - STEP_START))s"

STEP_START=$SECONDS
echo "[rollout] waiting..."
kubectl rollout status -n "$NS" deployment/api --timeout=120s
kubectl rollout status -n "$NS" deployment/admin-api --timeout=120s
kubectl rollout status -n "$NS" deployment/admin-web --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

echo ""
echo "=== Done in $((SECONDS - TOTAL_START))s ==="
echo "  kubectl get pods -n $NS"
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  echo "  kubectl get certificate -n $NS"
  echo "  curl https://api.kotonoha.eastshine.dev/health"
  echo "  admin web: https://kotonoha.eastshine.dev/admin"
else
  echo "  kubectl port-forward -n $NS svc/api 8080:8080"
  echo "  kubectl port-forward -n $NS svc/admin-api 8081:8081"
  echo "  rabbitmq ui: kubectl port-forward -n $NS svc/rabbitmq 15672:15672"
  echo "  admin web via ingress: http://localhost/$NS/admin"
  echo ""
  echo "  dev 의 CronJob 은 suspend 상태다. 수동 실행:"
  echo "    kubectl create job --from=cronjob/freeze-consume fc-\$(date +%s) -n $NS"
fi
