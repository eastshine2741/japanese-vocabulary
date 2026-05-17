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
echo "[1/6] Applying hcloud secret..."
envsubst < "$DIR/hcloud-secret.template.yaml" | kubectl apply -f -

# --- 2. CCM ---
echo "[2/6] Applying CCM..."
kubectl apply -f "$DIR/ccm.yaml"
kubectl patch deployment hcloud-cloud-controller-manager -n kube-system \
  --type=strategic --patch-file "$DIR/ccm-patch.yaml"
kubectl -n kube-system rollout status deployment/hcloud-cloud-controller-manager --timeout=120s

# --- 3. CSI ---
echo "[3/6] Applying CSI driver..."
kubectl apply -f "$DIR/csi-driver.yaml"

# --- 4. Traefik LB annotation (Hetzner LB 생성 트리거) ---
echo "[4/6] Applying traefik config..."
kubectl apply -f "$DIR/traefik-config.yaml"

# --- 5. local-path가 살아있으면 default 해제 (hcloud-volumes만 default로) ---
echo "[5/6] Ensuring hcloud-volumes is the only default StorageClass..."
if kubectl get storageclass local-path >/dev/null 2>&1; then
  kubectl patch storageclass local-path \
    -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
fi

# --- 6. Verify ---
echo "[6/6] Verifying..."
kubectl get nodes -o wide
kubectl get storageclass

echo ""
echo "=== Done ==="
echo "  kubectl get nodes               # 3대 모두 Ready 확인"
echo "  kubectl get storageclass        # hcloud-volumes (default) 확인"
