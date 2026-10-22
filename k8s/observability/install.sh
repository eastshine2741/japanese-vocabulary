#!/bin/bash
# install.sh - kube-prometheus-stack + ServiceMonitor 설치
# Usage: ./k8s/observability/install.sh
#
# 전제:
#   - kubectl context = kotonoha-prod
#   - .env.prod 에 GRAFANA_ADMIN_USER, GRAFANA_ADMIN_PASSWORD, GRAFANA_BIGQUERY_SA_KEY_BASE64 설정
#   - jq 설치
#   - prod 클러스터에 hcloud-volumes StorageClass 존재 (cluster-bootstrap 단계에서 설치됨)

set -euo pipefail

OBS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$OBS_DIR/../.." && pwd)"

EXPECTED_CONTEXT="kotonoha-prod"
NS="monitoring"
RELEASE="kube-prometheus-stack"
ENV_FILE="$PROJECT_ROOT/.env.prod"

CURRENT_CONTEXT="$(kubectl config current-context)"
if [[ "$CURRENT_CONTEXT" != "$EXPECTED_CONTEXT" ]]; then
  echo "Error: expected kubectl context '$EXPECTED_CONTEXT', got '$CURRENT_CONTEXT'" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi
set -a
source "$ENV_FILE"
set +a

if [[ -z "${GRAFANA_ADMIN_USER:-}" || "$GRAFANA_ADMIN_USER" == "admin" ]]; then
  echo "Error: GRAFANA_ADMIN_USER not set (or still 'admin') in $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]]; then
  echo "Error: GRAFANA_ADMIN_PASSWORD not set in $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${DISCORD_ALERT_WEBHOOK_URL:-}" ]]; then
  echo "Error: DISCORD_ALERT_WEBHOOK_URL not set in $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${GRAFANA_BIGQUERY_SA_KEY_BASE64:-}" ]]; then
  echo "Error: GRAFANA_BIGQUERY_SA_KEY_BASE64 not set in $ENV_FILE" >&2
  exit 1
fi

echo "[helm] adding prometheus-community repo..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update prometheus-community >/dev/null

kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

# alertmanager.yaml의 ${DISCORD_ALERT_WEBHOOK_URL}만 치환한다 (알림 템플릿의 다른 $는 유지).
echo "[apply] alertmanager-config Secret..."
envsubst '${DISCORD_ALERT_WEBHOOK_URL}' < "$OBS_DIR/alertmanager.yaml" \
  | kubectl create secret generic alertmanager-config \
      --namespace "$NS" \
      --from-file=alertmanager.yaml=/dev/stdin \
      --dry-run=client -o yaml \
  | kubectl apply -f -

# Grafana 의 envFromSecret 이 읽는다. 없으면 Grafana 파드가 뜨지 않으므로 helm 보다 먼저 만든다.
echo "[apply] grafana-bigquery Secret..."
BQ_KEY_JSON="$(printf '%s' "$GRAFANA_BIGQUERY_SA_KEY_BASE64" | base64 -d)"
if ! jq -e '.client_email and .private_key' >/dev/null <<<"$BQ_KEY_JSON"; then
  echo "Error: GRAFANA_BIGQUERY_SA_KEY_BASE64 is not a service account JSON key" >&2
  exit 1
fi
kubectl create secret generic grafana-bigquery \
  --namespace "$NS" \
  --from-literal=BIGQUERY_CLIENT_EMAIL="$(jq -er .client_email <<<"$BQ_KEY_JSON")" \
  --from-file=BIGQUERY_PRIVATE_KEY=<(jq -er .private_key <<<"$BQ_KEY_JSON") \
  --dry-run=client -o yaml \
  | kubectl apply -f -
unset BQ_KEY_JSON

echo "[helm] upgrade/install kube-prometheus-stack..."
helm upgrade --install "$RELEASE" prometheus-community/kube-prometheus-stack \
  --namespace "$NS" \
  --version 86.1.0 \
  --values "$OBS_DIR/values.yaml" \
  --set-string grafana.adminUser="$GRAFANA_ADMIN_USER" \
  --set-string grafana.adminPassword="$GRAFANA_ADMIN_PASSWORD" \
  --wait --timeout 10m

echo "[apply] grafana IngressRoute + Certificate..."
kubectl apply -n "$NS" -f "$OBS_DIR/grafana-ingress.yaml"

# 치환된 dashboards는 grafana_dashboard=1 라벨 ConfigMap으로 sidecar가 집어 간다.
# client-side apply 는 본문을 last-applied 어노테이션(256KiB 상한)에 한 벌 더 담아 대시보드가 늘면 깨진다.
echo "[apply] dashboards ConfigMap..."
kubectl create configmap kotonoha-dashboards \
  --namespace "$NS" \
  --from-file="$OBS_DIR/dashboards/" \
  --dry-run=client -o yaml \
  | kubectl apply --server-side --force-conflicts -f -
kubectl -n "$NS" label configmap kotonoha-dashboards grafana_dashboard=1 --overwrite >/dev/null

echo ""
echo "=== Done ==="
echo "  Next: run ./deploy.sh (DEPLOY_ENV=prod) to apply ServiceMonitors alongside api/batch."
echo "  kubectl -n $NS get pods"
echo "  Grafana: https://grafana.kotonoha.eastshine.dev   # \$GRAFANA_ADMIN_USER / \$GRAFANA_ADMIN_PASSWORD"
echo "  kubectl -n $NS port-forward svc/${RELEASE}-grafana 3000:80"
echo "  kubectl -n $NS port-forward svc/kps-prometheus 9090:9090"
