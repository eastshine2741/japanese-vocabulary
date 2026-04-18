#!/bin/bash
# deploy.sh - worktree별 namespace 배포 스크립트
# Usage: ./deploy.sh [namespace]
#   namespace 생략 시 현재 브랜치명에서 자동 추출

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

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

IMAGE="japanese-vocabulary:${NS}"

echo "=== namespace: $NS | image: $IMAGE ==="

# --- 1. Docker 이미지 빌드 & k3s 주입 ---
echo "[1/4] Building image..."
docker build -t "$IMAGE" -f "$PROJECT_ROOT/backend/Dockerfile" "$PROJECT_ROOT/backend/"

echo "[2/4] Importing image to k3s..."
docker save "$IMAGE" | sudo k3s ctr images import -

# --- 2. Namespace 생성 ---
echo "[3/4] Creating namespace..."
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

# --- 3. 매니페스트 적용 ---
echo "[4/4] Applying manifests..."
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/mysql/"
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/redis/"
kubectl apply -n "$NS" -f "$PROJECT_ROOT/k8s/backend/"

# backend 이미지 태그를 namespace별 태그로 갱신
kubectl set image -n "$NS" deployment/backend backend="$IMAGE"

# --- 4. 롤아웃 대기 ---
echo "Waiting for backend rollout..."
kubectl rollout status -n "$NS" deployment/backend --timeout=120s

echo ""
echo "=== Done ==="
echo "  kubectl get pods -n $NS"
echo "  kubectl port-forward -n $NS svc/backend 8080:8080"
