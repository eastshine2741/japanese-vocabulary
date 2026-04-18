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
IMAGE="japanese-vocabulary:${GIT_SHA}"

echo "=== namespace: $NS | image: $IMAGE ==="

# --- 1. Gradle 빌드 ---
STEP_START=$SECONDS
echo "[1/6] Building bootJar..."
cd "$PROJECT_ROOT/backend" && ./gradlew bootJar --no-daemon
cd "$PROJECT_ROOT"
echo "  → $((SECONDS - STEP_START))s"

# --- 2. Docker 이미지 빌드 ---
STEP_START=$SECONDS
echo "[2/6] Building image..."
docker build -t "$IMAGE" -f "$PROJECT_ROOT/backend/Dockerfile" "$PROJECT_ROOT/backend/"
echo "  → $((SECONDS - STEP_START))s"

# --- 2. k3s 이미지 주입 ---
STEP_START=$SECONDS
echo "[3/6] Importing image to k3s..."
docker save "$IMAGE" | sudo k3s ctr images import -
echo "  → $((SECONDS - STEP_START))s"

# --- 3. Namespace 생성 ---
STEP_START=$SECONDS
echo "[4/6] Creating namespace..."
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
echo "  → $((SECONDS - STEP_START))s"

# --- 4. 매니페스트 적용 ---
STEP_START=$SECONDS
echo "[5/6] Applying manifests..."

# .env 로드 + IMAGE를 환경변수로 export (템플릿에서 사용)
set -a
source "$PROJECT_ROOT/.env"
export IMAGE NS
set +a

# mysql
envsubst < "$PROJECT_ROOT/k8s/mysql/secret.template.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/mysql/statefulset.yaml"
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/mysql/service.yaml"

# redis
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/redis/"

# backend
envsubst < "$PROJECT_ROOT/k8s/backend/secret.template.yaml" | kubectl apply -n "$NS" -f -
envsubst < "$PROJECT_ROOT/k8s/backend/deployment.yaml" | kubectl apply -n "$NS" -f -
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/backend/service.yaml"
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/backend/configmap.yaml"

# ingress
envsubst < "$PROJECT_ROOT/k8s/backend/ingress.yaml" | kubectl apply -n "$NS" -f -
echo "  → $((SECONDS - STEP_START))s"

# --- 5. 롤아웃 대기 ---
STEP_START=$SECONDS
echo "[6/6] Waiting for backend rollout..."
kubectl rollout status -n "$NS" deployment/backend --timeout=120s
echo "  → $((SECONDS - STEP_START))s"

echo ""
echo "=== Done in $((SECONDS - TOTAL_START))s ==="
echo "  kubectl get pods -n $NS"
echo "  kubectl port-forward -n $NS svc/backend 8080:8080"
