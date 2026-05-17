#!/bin/bash
# apply.sh - prod 클러스터 부트스트랩 (CCM + CSI)
# Usage: ./apply.sh
#   - .env에 HCLOUD_TOKEN, HCLOUD_NETWORK 정의되어 있어야 함
#   - kubeconfig은 사용자가 직접 export 해두어야 함 (prod 클러스터 가리키게)

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

# --- env 로드 ---
set -a
source "$ROOT/.env"
set +a

: "${HCLOUD_TOKEN:?HCLOUD_TOKEN not set in .env}"
: "${HCLOUD_NETWORK:?HCLOUD_NETWORK not set in .env}"

echo "=== context: $(kubectl config current-context) ==="

# --- 1. Secret ---
echo "[1/4] Applying hcloud secret..."
envsubst < "$DIR/hcloud-secret.template.yaml" | kubectl apply -f -

# --- 2. CCM ---
echo "[2/4] Applying CCM..."
kubectl apply -f "$DIR/ccm.yaml"
kubectl patch deployment hcloud-cloud-controller-manager -n kube-system \
  --type=strategic --patch-file "$DIR/ccm-patch.yaml"
kubectl -n kube-system rollout status deployment/hcloud-cloud-controller-manager --timeout=120s

# --- 3. CSI ---
echo "[3/4] Applying CSI driver..."
kubectl apply -f "$DIR/csi-driver.yaml"

# --- 4. Verify ---
echo "[4/4] Verifying..."
kubectl get nodes -o wide
kubectl get storageclass

echo ""
echo "=== Done ==="
echo "  kubectl get nodes               # 3대 모두 Ready 확인"
echo "  kubectl get storageclass        # hcloud-volumes (default) 확인"
