#!/bin/bash
# apply.sh - k3s kubelet 설정(/etc/rancher/k3s/config.yaml)을 노드별로 배포하고 k3s를 재시작
# Usage: ./apply.sh [node-name ...]   (인자 없으면 전체 노드, 한 대씩 순서대로)
#   - root@<public-ip> SSH 접근 필요
#   - k3s 재시작은 실행 중인 파드를 죽이지 않는다 (containerd shim 유지)

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
CONTEXT="kotonoha-prod"

# node-name -> "public-ip unit config"
declare -A NODES=(
  [ubuntu-4gb-hel1-1]="37.27.220.52 k3s server-config.yaml"
  [ubuntu-4gb-hel1-2]="204.168.191.165 k3s-agent agent-config.yaml"
  [ubuntu-4gb-hel1-3]="204.168.190.22 k3s-agent agent-config.yaml"
)

TARGETS=("$@")
[[ ${#TARGETS[@]} -eq 0 ]] && TARGETS=(ubuntu-4gb-hel1-2 ubuntu-4gb-hel1-3 ubuntu-4gb-hel1-1)

for node in "${TARGETS[@]}"; do
  [[ -n "${NODES[$node]:-}" ]] || { echo "Unknown node: $node" >&2; exit 1; }
  read -r ip unit config <<<"${NODES[$node]}"

  echo "=== $node ($ip, $unit) ==="
  ssh "root@$ip" "mkdir -p /etc/rancher/k3s && cat > /etc/rancher/k3s/config.yaml" < "$DIR/$config"
  ssh "root@$ip" "systemctl restart $unit"

  echo "  waiting for Ready..."
  sleep 10
  kubectl --context "$CONTEXT" wait --for=condition=Ready "node/$node" --timeout=180s

  kubectl --context "$CONTEXT" get --raw "/api/v1/nodes/$node/proxy/configz" \
    | python3 -c 'import json,sys; c=json.load(sys.stdin)["kubeletconfig"]; print("  systemReserved:", c.get("systemReserved")); print("  kubeReserved:  ", c.get("kubeReserved")); print("  evictionHard:  ", c.get("evictionHard"))'
  kubectl --context "$CONTEXT" get node "$node" -o jsonpath='  allocatable.memory: {.status.allocatable.memory}{"\n"}'
done
