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

# --- 환경별 설정 (IMAGE_PREFIX는 prod에서 env 로드 후 GHCR_USERNAME으로 조립) ---
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

# --- kube context: 명시된 환경의 context를 kubectl에 직접 지정 ---
# 현재 활성 context와 무관하게 항상 DEPLOY_ENV에 맞는 context로 배포한다.
kubectl() {
  command kubectl --context "$KUBE_CONTEXT" "$@"
}

# --- namespace 결정 (dev만 동적, prod는 고정) ---
if [[ "$DEPLOY_ENV" == "dev" ]]; then
  if [[ -n "$DEPLOY_NS_ARG" ]]; then
    NS="$DEPLOY_NS_ARG"
  else
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    # feature/foo-bar → foo-bar, main → main
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

# --- env 파일 확인 ---
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi

# --- env 로드 ---
set -a
source "$ENV_FILE"
set +a

# --- prod-only: GHCR 검증 + IMAGE_PREFIX 조립 + 가드 prompt ---
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  if [[ -z "${GHCR_USERNAME:-}" || -z "${GHCR_TOKEN:-}" ]]; then
    echo "Error: GHCR_USERNAME / GHCR_TOKEN not set in $ENV_FILE" >&2
    exit 1
  fi
  IMAGE_PREFIX="ghcr.io/${GHCR_USERNAME}/kotonoha"

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
if [[ "$DEPLOY_ENV" == "dev" ]]; then
  ADMIN_API_IMAGE="${IMAGE_PREFIX}-admin-api:${GIT_SHA}"
  ADMIN_WEB_IMAGE="${IMAGE_PREFIX}-admin-web:${GIT_SHA}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
  ADMIN_PASSWORD_SHA256="${ADMIN_PASSWORD_SHA256:-}"
  ADMIN_TOKEN_SECRET="${ADMIN_TOKEN_SECRET:-dev-admin-token-secret-must-be-at-least-32-bytes}"
fi

if [[ "$DEPLOY_ENV" == "prod" ]]; then
  SENTRY_ENVIRONMENT="production"
else
  SENTRY_ENVIRONMENT="${NS}"
fi
SENTRY_RELEASE="${GIT_SHA}"
export API_IMAGE BATCH_IMAGE MIGRATION_IMAGE ADMIN_API_IMAGE ADMIN_WEB_IMAGE NS SENTRY_ENVIRONMENT SENTRY_RELEASE
export ADMIN_PASSWORD ADMIN_PASSWORD_SHA256 ADMIN_TOKEN_SECRET

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

# --- 1. Gradle 테스트 + 빌드 (test 실패 시 배포 중단) ---
STEP_START=$SECONDS
echo "[gradle] test + bootJar..."
if [[ "$DEPLOY_ENV" == "dev" ]]; then
  cd "$PROJECT_ROOT/backend" && ./gradlew :api:test :batch:test :admin-api:test :api:bootJar :batch:bootJar :admin-api:bootJar --no-daemon
else
  cd "$PROJECT_ROOT/backend" && ./gradlew :api:test :batch:test :api:bootJar :batch:bootJar --no-daemon
fi
cd "$PROJECT_ROOT"
echo "  → $((SECONDS - STEP_START))s"

# --- 2. Docker 이미지 빌드 + 배포 ---
STEP_START=$SECONDS
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  echo "[ghcr] login..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin

  echo "[build] images..."
  docker build -t "$API_IMAGE" -f "$PROJECT_ROOT/backend/api/Dockerfile" "$PROJECT_ROOT/backend/api/"
  docker build -t "$BATCH_IMAGE" -f "$PROJECT_ROOT/backend/batch/Dockerfile" "$PROJECT_ROOT/backend/batch/"
  docker build -t "$MIGRATION_IMAGE" -f "$PROJECT_ROOT/backend/migration/Dockerfile" "$PROJECT_ROOT/backend/migration/"

  echo "[push] ghcr..."
  docker push "$API_IMAGE"
  docker push "$BATCH_IMAGE"
  docker push "$MIGRATION_IMAGE"
else
  echo "[build] images..."
  docker build -t "$API_IMAGE" -f "$PROJECT_ROOT/backend/api/Dockerfile" "$PROJECT_ROOT/backend/api/"
  docker build -t "$BATCH_IMAGE" -f "$PROJECT_ROOT/backend/batch/Dockerfile" "$PROJECT_ROOT/backend/batch/"
  docker build -t "$MIGRATION_IMAGE" -f "$PROJECT_ROOT/backend/migration/Dockerfile" "$PROJECT_ROOT/backend/migration/"
  docker build -t "$ADMIN_API_IMAGE" -f "$PROJECT_ROOT/backend/admin-api/Dockerfile" "$PROJECT_ROOT/backend/admin-api/"
  docker build \
    --build-arg VITE_ADMIN_API_BASE_URL="/${NS}/admin/api" \
    --build-arg VITE_ADMIN_BASE_PATH="/${NS}/admin" \
    -t "$ADMIN_WEB_IMAGE" \
    -f "$PROJECT_ROOT/admin-web/Dockerfile" "$PROJECT_ROOT/admin-web/"

  echo "[k3s] importing images..."
  docker save "$API_IMAGE" "$BATCH_IMAGE" "$MIGRATION_IMAGE" "$ADMIN_API_IMAGE" "$ADMIN_WEB_IMAGE" | sudo k3s ctr images import -
fi
echo "  → $((SECONDS - STEP_START))s"

# --- 3. Namespace ---
STEP_START=$SECONDS
echo "[ns] ensuring namespace '$NS'..."
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
echo "  → $((SECONDS - STEP_START))s"

# --- 4. ImagePullSecret (prod only) ---
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

# --- 5. 매니페스트 적용 ---
STEP_START=$SECONDS
echo "[apply] infra (mysql + redis)..."
envsubst < "$K8S_DIR/mysql/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$K8S_DIR/mysql/statefulset.yaml"
kubectl apply -n "$NS" -f "$K8S_DIR/mysql/service.yaml"
kubectl apply -n "$NS" -f "$K8S_DIR/redis/"
echo "  → $((SECONDS - STEP_START))s"

# --- 6. DB 마이그레이션 ---
STEP_START=$SECONDS
echo "[migration] running..."
kubectl rollout status -n "$NS" statefulset/mysql --timeout=120s
if [[ "$RESTORE_DEV_DUMP" == "true" ]]; then
  echo "[mysql] restoring $DEV_MYSQL_DUMP_FILE before Flyway migration..."
  if ! kubectl exec -n "$NS" statefulset/mysql -- sh -c 'command -v mysql >/dev/null'; then
    echo "Error: mysql client is not available in the mysql pod." >&2
    echo "Database PVC may already have been created. Recover with: ./teardown.sh $NS" >&2
    exit 1
  fi
  if ! kubectl exec -i -n "$NS" statefulset/mysql -- sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < "$DEV_MYSQL_DUMP_FILE"; then
    echo "Error: failed to restore dev dump into namespace '$NS'." >&2
    echo "Database PVC may contain a partial import. Recover with: ./teardown.sh $NS" >&2
    exit 1
  fi
fi
kubectl delete job migration -n "$NS" --ignore-not-found
envsubst < "$K8S_DIR/migration/job.yaml" | kubectl apply -n "$NS" -f -
kubectl wait --for=condition=complete -n "$NS" job/migration --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

# --- 7. API + Batch ---
STEP_START=$SECONDS
echo "[apply] api + batch..."
envsubst < "$K8S_DIR/api/secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/api/configmap.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/api/deployment.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$K8S_DIR/api/service.yaml"
envsubst < "$K8S_DIR/api/ingress.yaml" | kubectl apply -n "$NS" -f -

envsubst < "$K8S_DIR/batch/secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/batch/firebase-secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/batch/configmap.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$K8S_DIR/batch/deployment.yaml" | kubectl apply -n "$NS" -f -
[[ -f "$K8S_DIR/batch/service.yaml" ]] && kubectl apply -n "$NS" -f "$K8S_DIR/batch/service.yaml"

for sm in "$K8S_DIR/api/servicemonitor.yaml" "$K8S_DIR/batch/servicemonitor.yaml"; do
  [[ -f "$sm" ]] && kubectl apply -n "$NS" -f "$sm"
done

if [[ "$DEPLOY_ENV" == "dev" ]]; then
  envsubst < "$K8S_DIR/admin-api/secret.template.yaml" | kubectl apply -n "$NS" -f -
  envsubst < "$K8S_DIR/admin-api/configmap.yaml" | kubectl apply -n "$NS" -f -
  envsubst < "$K8S_DIR/admin-api/deployment.yaml" | kubectl apply -n "$NS" -f -
  kubectl apply -n "$NS" -f "$K8S_DIR/admin-api/service.yaml"
  envsubst < "$K8S_DIR/admin-api/ingress.yaml" | kubectl apply -n "$NS" -f -

  envsubst < "$K8S_DIR/admin-web/deployment.yaml" | kubectl apply -n "$NS" -f -
  kubectl apply -n "$NS" -f "$K8S_DIR/admin-web/service.yaml"
  envsubst < "$K8S_DIR/admin-web/ingress.yaml" | kubectl apply -n "$NS" -f -
fi
echo "  → $((SECONDS - STEP_START))s"

# --- 8. 롤아웃 대기 ---
STEP_START=$SECONDS
echo "[rollout] waiting..."
kubectl rollout status -n "$NS" deployment/api --timeout=120s
kubectl rollout status -n "$NS" deployment/batch --timeout=120s
if [[ "$DEPLOY_ENV" == "dev" ]]; then
  kubectl rollout status -n "$NS" deployment/admin-api --timeout=120s
  kubectl rollout status -n "$NS" deployment/admin-web --timeout=120s
fi
echo "  → $((SECONDS - STEP_START))s"

echo ""
echo "=== Done in $((SECONDS - TOTAL_START))s ==="
echo "  kubectl get pods -n $NS"
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  echo "  kubectl get certificate -n $NS"
  echo "  curl https://api.kotonoha.eastshine.dev/health"
else
  echo "  kubectl port-forward -n $NS svc/api 8080:8080"
  echo "  kubectl port-forward -n $NS svc/admin-api 8081:8081"
  echo "  admin web via ingress: http://localhost/$NS/admin"
fi
