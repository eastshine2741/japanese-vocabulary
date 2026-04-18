#!/bin/bash
# deploy.sh - worktree별 namespace 배포 스크립트
# Usage: ./deploy.sh [namespace]
#   namespace 생략 시 현재 브랜치명에서 자동 추출

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
TOTAL_START=$SECONDS

# --- context 확인 ---
EXPECTED_CONTEXT="default"
CURRENT_CONTEXT="$(kubectl config current-context)"
if [[ "$CURRENT_CONTEXT" != "$EXPECTED_CONTEXT" ]]; then
  echo "Error: expected kubectl context '$EXPECTED_CONTEXT', got '$CURRENT_CONTEXT'" >&2
  exit 1
fi

# --- namespace 결정 ---
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

GIT_SHA="$(git rev-parse --short HEAD)"
API_IMAGE="japanese-vocabulary-api:${GIT_SHA}"
BATCH_IMAGE="japanese-vocabulary-batch:${GIT_SHA}"
MIGRATION_IMAGE="japanese-vocabulary-migration:${GIT_SHA}"

echo "=== namespace: $NS | sha: $GIT_SHA ==="

# --- 1. Gradle 빌드 ---
STEP_START=$SECONDS
echo "[1/8] Building bootJar..."
cd "$PROJECT_ROOT/backend" && ./gradlew :api:bootJar :batch:bootJar --no-daemon
cd "$PROJECT_ROOT"
echo "  → $((SECONDS - STEP_START))s"

# --- 2. Docker 이미지 빌드 ---
STEP_START=$SECONDS
echo "[2/8] Building images..."
docker build -t "$API_IMAGE" -f "$PROJECT_ROOT/backend/api/Dockerfile" "$PROJECT_ROOT/backend/api/"
docker build -t "$BATCH_IMAGE" -f "$PROJECT_ROOT/backend/batch/Dockerfile" "$PROJECT_ROOT/backend/batch/"
docker build -t "$MIGRATION_IMAGE" -f "$PROJECT_ROOT/backend/migration/Dockerfile" "$PROJECT_ROOT/backend/migration/"
echo "  → $((SECONDS - STEP_START))s"

# --- 3. k3s 이미지 주입 ---
STEP_START=$SECONDS
echo "[3/8] Importing images to k3s..."
docker save "$API_IMAGE" "$BATCH_IMAGE" "$MIGRATION_IMAGE" | sudo k3s ctr images import -
echo "  → $((SECONDS - STEP_START))s"

# --- 4. Namespace 생성 ---
STEP_START=$SECONDS
echo "[4/8] Creating namespace..."
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
echo "  → $((SECONDS - STEP_START))s"

# --- 5. 매니페스트 적용 (인프라 + 시크릿) ---
STEP_START=$SECONDS
echo "[5/8] Applying infra manifests..."

# .env 로드 + 이미지를 환경변수로 export (템플릿에서 사용)
set -a
source "$PROJECT_ROOT/.env"
export API_IMAGE BATCH_IMAGE MIGRATION_IMAGE NS
set +a

# mysql
envsubst < "$PROJECT_ROOT/k8s/mysql/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/mysql/statefulset.yaml"
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/mysql/service.yaml"

# redis
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/redis/"

echo "  → $((SECONDS - STEP_START))s"

# --- 6. DB 마이그레이션 ---
STEP_START=$SECONDS
echo "[6/8] Running migration..."

# MySQL이 준비될 때까지 대기
kubectl rollout status -n "$NS" statefulset/mysql --timeout=120s

# 이전 migration job 정리 후 실행
kubectl delete job migration -n "$NS" --ignore-not-found
envsubst < "$PROJECT_ROOT/k8s/migration/job.yaml" | kubectl apply -n "$NS" -f -
kubectl wait --for=condition=complete -n "$NS" job/migration --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

# --- 7. API + Batch 배포 ---
STEP_START=$SECONDS
echo "[7/8] Deploying api + batch..."

# api
envsubst < "$PROJECT_ROOT/k8s/api/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/api/configmap.yaml"
envsubst < "$PROJECT_ROOT/k8s/api/deployment.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/api/service.yaml"
envsubst < "$PROJECT_ROOT/k8s/api/ingress.yaml" | kubectl apply -n "$NS" -f -

# batch
envsubst < "$PROJECT_ROOT/k8s/batch/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/batch/configmap.yaml"
envsubst < "$PROJECT_ROOT/k8s/batch/deployment.yaml" | kubectl apply -n "$NS" -f -

echo "  → $((SECONDS - STEP_START))s"

# --- 8. 롤아웃 대기 ---
STEP_START=$SECONDS
echo "[8/8] Waiting for rollouts..."
kubectl rollout status -n "$NS" deployment/api --timeout=120s
kubectl rollout status -n "$NS" deployment/batch --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

echo ""
echo "=== Done in $((SECONDS - TOTAL_START))s ==="
echo "  kubectl get pods -n $NS"
echo "  kubectl port-forward -n $NS svc/api 8080:8080"
