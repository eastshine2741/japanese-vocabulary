#!/bin/bash
# apply.sh - 로컬 k3s 부트스트랩
# Usage: ./apply.sh
#   - kubeconfig 이 로컬 k3s(default context)를 가리켜야 함
#   - helm CLI 설치 필요
#
# prod 와 달리 CCM/CSI/Traefik LB 설정은 없다. 로컬 k3s 는 local-path 와 내장 traefik 을 그대로 쓴다.
# 여기서 까는 건 RabbitMQ 오퍼레이터와 그 전제인 cert-manager 뿐이고, 둘 다 클러스터당 1회로 끝난다.
# 네임스페이스를 새로 파는 워크트리 배포(deploy.sh)는 이 스크립트를 다시 돌릴 필요가 없다.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# RabbitMQ 오퍼레이터 버전과 설치 함수는 prod bootstrap 과 공유한다.
source "$DIR/../../bootstrap-lib.sh"

# prod 와 같은 버전을 쓴다. webhook 인증서 발급 용도라 기능 요구는 없다.
CERT_MANAGER_VERSION="v1.20.2"

CONTEXT="$(kubectl config current-context)"
echo "=== context: $CONTEXT ==="
if [[ "$CONTEXT" == kotonoha-prod ]]; then
  echo "Error: this is the dev bootstrap but the context is kotonoha-prod." >&2
  echo "       Use k8s/prod/bootstrap/apply.sh for prod." >&2
  exit 1
fi

# --- 1. cert-manager (messaging-topology-operator 의 webhook 인증서 발급에 필요) ---
echo "[1/2] Installing cert-manager (chart $CERT_MANAGER_VERSION)..."
helm repo add jetstack https://charts.jetstack.io --force-update >/dev/null
helm repo update jetstack >/dev/null
helm upgrade --install cert-manager jetstack/cert-manager \
  --version "$CERT_MANAGER_VERSION" \
  -n cert-manager --create-namespace \
  -f "$DIR/values/cert-manager.yaml"
kubectl -n cert-manager rollout status deployment/cert-manager --timeout=180s
kubectl -n cert-manager rollout status deployment/cert-manager-webhook --timeout=180s
kubectl -n cert-manager rollout status deployment/cert-manager-cainjector --timeout=180s

# --- 2. RabbitMQ operators ---
echo "[2/2] Installing RabbitMQ operators..."
install_rabbitmq_operators

# --- Verify ---
echo ""
echo "=== Verify ==="
kubectl get pods -n cert-manager
kubectl get pods -n rabbitmq-system
kubectl get crd | grep rabbitmq.com

echo ""
echo "=== Done ==="
echo "  ./deploy.sh <namespace>    # 이제 네임스페이스별 RabbitmqCluster 를 띄울 수 있다"
