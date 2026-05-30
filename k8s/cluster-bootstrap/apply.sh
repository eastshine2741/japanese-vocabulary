#!/bin/bash
# apply.sh - prod 클러스터 부트스트랩 (Helm 기반)
# Usage: ./apply.sh
#   - .env에 HCLOUD_TOKEN, HCLOUD_NETWORK 정의되어 있어야 함
#   - kubeconfig은 사용자가 직접 export 해두어야 함 (prod 클러스터 가리키게)
#   - helm CLI 설치 필요

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

# --- env 로드 ---
set -a
source "$ROOT/.env"
set +a

: "${HCLOUD_TOKEN:?HCLOUD_TOKEN not set in .env}"
: "${HCLOUD_NETWORK:?HCLOUD_NETWORK not set in .env}"

# --- chart 버전 (업그레이드 시 여기서 핀) ---
CCM_VERSION="1.31.0"
CSI_VERSION="2.21.0"
CERT_MANAGER_VERSION="v1.20.2"

echo "=== context: $(kubectl config current-context) ==="

# --- 1. hcloud Secret (CCM/CSI 공통) ---
echo "[1/6] Applying hcloud secret..."
envsubst < "$DIR/hcloud-secret.template.yaml" | kubectl apply -f -

# --- helm repos ---
helm repo add hcloud https://charts.hetzner.cloud --force-update >/dev/null
helm repo add jetstack https://charts.jetstack.io --force-update >/dev/null
helm repo update hcloud jetstack >/dev/null

# --- 2. CCM ---
echo "[2/6] Installing CCM (chart $CCM_VERSION)..."
helm upgrade --install hcloud-cloud-controller-manager \
  hcloud/hcloud-cloud-controller-manager \
  --version "$CCM_VERSION" \
  -n kube-system \
  -f "$DIR/values/ccm.yaml"
kubectl -n kube-system rollout status deployment/hcloud-cloud-controller-manager --timeout=180s

# --- 3. CSI ---
echo "[3/6] Installing CSI (chart $CSI_VERSION)..."
helm upgrade --install hcloud-csi \
  hcloud/hcloud-csi \
  --version "$CSI_VERSION" \
  -n kube-system \
  -f "$DIR/values/csi.yaml"

# --- 4. cert-manager ---
echo "[4/6] Installing cert-manager (chart $CERT_MANAGER_VERSION)..."
helm upgrade --install cert-manager jetstack/cert-manager \
  --version "$CERT_MANAGER_VERSION" \
  -n cert-manager --create-namespace \
  -f "$DIR/values/cert-manager.yaml"
kubectl -n cert-manager rollout status deployment/cert-manager --timeout=180s
kubectl -n cert-manager rollout status deployment/cert-manager-webhook --timeout=180s
kubectl -n cert-manager rollout status deployment/cert-manager-cainjector --timeout=180s
kubectl apply -f "$DIR/cluster-issuer.yaml"

# --- 5. Traefik LB annotation (Hetzner LB 생성 트리거) ---
echo "[5/6] Applying traefik config..."
kubectl apply -f "$DIR/traefik-config.yaml"

# --- 6. local-path가 살아있으면 default 해제 (hcloud-volumes만 default로) ---
echo "[6/6] Ensuring hcloud-volumes is the only default StorageClass..."
if kubectl get storageclass local-path >/dev/null 2>&1; then
  kubectl patch storageclass local-path \
    -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
fi

# --- Verify ---
echo ""
echo "=== Verify ==="
kubectl get nodes -o wide
kubectl get storageclass
helm list -A

echo ""
echo "=== Done ==="
echo "  kubectl get svc traefik -n kube-system    # EXTERNAL-IP 확인"
echo "  kubectl get pods -n cert-manager          # 3개 Running 확인"
