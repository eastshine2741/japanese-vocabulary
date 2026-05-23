#!/bin/bash
# deploy.sh - k3s 배포 스크립트
# Usage:
#   ./deploy.sh [namespace]            # dev (k3s local, default context)
#   DEPLOY_ENV=prod ./deploy.sh        # prod (Hetzner k3s, kotonoha-prod context)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
TOTAL_START=$SECONDS

DEPLOY_ENV="${DEPLOY_ENV:-dev}"

# --- 환경별 설정 (IMAGE_PREFIX는 prod에서 env 로드 후 GHCR_USERNAME으로 조립) ---
if [[ "$DEPLOY_ENV" == "prod" ]]; then
  EXPECTED_CONTEXT="kotonoha-prod"
  NS="kotonoha"
  ENV_FILE="$PROJECT_ROOT/.env.prod"
elif [[ "$DEPLOY_ENV" == "dev" ]]; then
  EXPECTED_CONTEXT="default"
  ENV_FILE="$PROJECT_ROOT/.env"
  IMAGE_PREFIX="japanese-vocabulary"
else
  echo "Error: invalid DEPLOY_ENV '$DEPLOY_ENV' (expected: dev | prod)" >&2
  exit 1
fi

# --- context 확인 ---
CURRENT_CONTEXT="$(kubectl config current-context)"
if [[ "$CURRENT_CONTEXT" != "$EXPECTED_CONTEXT" ]]; then
  echo "Error: expected kubectl context '$EXPECTED_CONTEXT', got '$CURRENT_CONTEXT'" >&2
  exit 1
fi

# --- namespace 결정 (dev만 동적, prod는 고정) ---
if [[ "$DEPLOY_ENV" == "dev" ]]; then
  if [[ -n "${1:-}" ]]; then
    NS="$1"
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
  echo "  context:   $EXPECTED_CONTEXT"
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

export API_IMAGE BATCH_IMAGE MIGRATION_IMAGE NS

echo "=== env: $DEPLOY_ENV | namespace: $NS | sha: $GIT_SHA ==="

# --- 1. Gradle 빌드 ---
STEP_START=$SECONDS
echo "[build] bootJar..."
cd "$PROJECT_ROOT/backend" && ./gradlew :api:bootJar :batch:bootJar --no-daemon
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

  echo "[k3s] importing images..."
  docker save "$API_IMAGE" "$BATCH_IMAGE" "$MIGRATION_IMAGE" | sudo k3s ctr images import -
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

  echo ""
  echo "=== Step A done in $((SECONDS - TOTAL_START))s ==="
  echo "  ✔ Images pushed: $API_IMAGE / $BATCH_IMAGE / $MIGRATION_IMAGE"
  echo "  ✔ Namespace '$NS' + ghcr-pull secret ready"
  echo ""
  echo "  TODO (Step B): prod manifest apply"
  echo "    - imagePullSecrets, imagePullPolicy"
  echo "    - hcloud-volumes PVC, 10Gi"
  echo "    - Ingress for api.kotonoha.eastshine.dev + TLS"
  echo "    - mysqldump CronJob"
  exit 0
fi

# --- 5. (dev) 매니페스트 적용 ---
STEP_START=$SECONDS
echo "[apply] infra (mysql + redis)..."
envsubst < "$PROJECT_ROOT/k8s/mysql/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/mysql/statefulset.yaml"
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/mysql/service.yaml"
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/redis/"
echo "  → $((SECONDS - STEP_START))s"

# --- 6. DB 마이그레이션 ---
STEP_START=$SECONDS
echo "[migration] running..."
kubectl rollout status -n "$NS" statefulset/mysql --timeout=120s
kubectl delete job migration -n "$NS" --ignore-not-found
envsubst < "$PROJECT_ROOT/k8s/migration/job.yaml" | kubectl apply -n "$NS" -f -
kubectl wait --for=condition=complete -n "$NS" job/migration --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

# --- 7. API + Batch ---
STEP_START=$SECONDS
echo "[apply] api + batch..."
envsubst < "$PROJECT_ROOT/k8s/api/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/api/configmap.yaml"
envsubst < "$PROJECT_ROOT/k8s/api/deployment.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/api/service.yaml"
envsubst < "$PROJECT_ROOT/k8s/api/ingress.yaml" | kubectl apply -n "$NS" -f -

envsubst < "$PROJECT_ROOT/k8s/batch/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/batch/configmap.yaml"
envsubst < "$PROJECT_ROOT/k8s/batch/deployment.yaml" | kubectl apply -n "$NS" -f -
echo "  → $((SECONDS - STEP_START))s"

# --- 8. 롤아웃 대기 ---
STEP_START=$SECONDS
echo "[rollout] waiting..."
kubectl rollout status -n "$NS" deployment/api --timeout=120s
kubectl rollout status -n "$NS" deployment/batch --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

echo ""
echo "=== Done in $((SECONDS - TOTAL_START))s ==="
echo "  kubectl get pods -n $NS"
echo "  kubectl port-forward -n $NS svc/api 8080:8080"
