#!/bin/bash
# teardown.sh - namespace 삭제 스크립트
# Usage: ./teardown.sh [namespace]
#   namespace 생략 시 현재 브랜치명에서 자동 추출

set -euo pipefail

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
  NS="${BRANCH##*/}"
  NS="$(echo "$NS" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')"
fi

if [[ ! "$NS" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo "Error: invalid namespace '$NS'" >&2
  exit 1
fi

# main은 실수 방지
if [[ "$NS" == "main" ]]; then
  echo "Error: refusing to delete namespace 'main'" >&2
  exit 1
fi

echo "This will delete namespace '$NS' and ALL resources in it."
read -p "Continue? (y/N) " confirm
if [[ "$confirm" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

kubectl delete namespace "$NS"
echo "Namespace '$NS' deleted."
