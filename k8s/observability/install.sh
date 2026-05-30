#!/bin/bash
# install.sh - kube-prometheus-stack + ServiceMonitor 설치
# Usage: ./k8s/observability/install.sh
#
# 전제:
#   - kubectl context = kotonoha-prod
#   - .env.prod 에 GRAFANA_ADMIN_PASSWORD 설정
#   - prod 클러스터에 hcloud-volumes StorageClass 존재 (cluster-bootstrap 단계에서 설치됨)

set -euo pipefail

OBS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$OBS_DIR/../.." && pwd)"

EXPECTED_CONTEXT="kotonoha-prod"
NS="monitoring"
RELEASE="kube-prometheus-stack"
ENV_FILE="$PROJECT_ROOT/.env.prod"

# --- context guard ---
CURRENT_CONTEXT="$(kubectl config current-context)"
if [[ "$CURRENT_CONTEXT" != "$EXPECTED_CONTEXT" ]]; then
  echo "Error: expected kubectl context '$EXPECTED_CONTEXT', got '$CURRENT_CONTEXT'" >&2
  exit 1
fi

# --- env load ---
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi
set -a
source "$ENV_FILE"
set +a

if [[ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]]; then
  echo "Error: GRAFANA_ADMIN_PASSWORD not set in $ENV_FILE" >&2
  exit 1
fi

# --- helm repo ---
echo "[helm] adding prometheus-community repo..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update prometheus-community >/dev/null

# --- namespace ---
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

# --- stack install/upgrade ---
echo "[helm] upgrade/install kube-prometheus-stack..."
helm upgrade --install "$RELEASE" prometheus-community/kube-prometheus-stack \
  --namespace "$NS" \
  --version 86.1.0 \
  --values "$OBS_DIR/values.yaml" \
  --set-string grafana.adminPassword="$GRAFANA_ADMIN_PASSWORD" \
  --wait --timeout 10m

echo ""
echo "=== Done ==="
echo "  Next: run ./deploy.sh (DEPLOY_ENV=prod) to apply ServiceMonitors alongside api/batch."
echo "  kubectl -n $NS get pods"
echo "  kubectl -n $NS port-forward svc/${RELEASE}-grafana 3000:80   # admin / \$GRAFANA_ADMIN_PASSWORD"
echo "  kubectl -n $NS port-forward svc/${RELEASE}-prometheus 9090:9090"
