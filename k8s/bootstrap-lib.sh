#!/bin/bash
# bootstrap-lib.sh - dev/prod bootstrap 이 공유하는 부분.
#
# RabbitMQ 오퍼레이터는 CRD 스키마를 dev 와 prod 가 같이 써야 하므로 버전을 여기 한 곳에서 핀한다.
# 각 환경의 apply.sh 가 source 해서 쓴다.

# --- 오퍼레이터 버전 (업그레이드 시 여기서 핀) ---
# https://github.com/rabbitmq/cluster-operator/releases
RABBITMQ_CLUSTER_OPERATOR_VERSION="v2.23.0"
# https://github.com/rabbitmq/messaging-topology-operator/releases
RABBITMQ_TOPOLOGY_OPERATOR_VERSION="v1.20.3"

# helm upgrade 는 CRD 를 갱신하지 않고, 오퍼레이터는 raw manifest 로 배포된다.
# kubectl apply 는 CRD 까지 함께 갱신하므로 여기서는 manifest 를 그대로 쓴다.
install_rabbitmq_operators() {
  local cluster_url topology_url
  cluster_url="https://github.com/rabbitmq/cluster-operator/releases/download/${RABBITMQ_CLUSTER_OPERATOR_VERSION}/cluster-operator.yml"
  topology_url="https://github.com/rabbitmq/messaging-topology-operator/releases/download/${RABBITMQ_TOPOLOGY_OPERATOR_VERSION}/messaging-topology-operator-with-certmanager.yaml"

  echo "  - cluster-operator ${RABBITMQ_CLUSTER_OPERATOR_VERSION}"
  kubectl apply --server-side --force-conflicts -f "$cluster_url"
  kubectl -n rabbitmq-system rollout status deployment/rabbitmq-cluster-operator --timeout=180s

  # topology-operator 는 webhook 인증서를 cert-manager 로 발급받는다. 배포 전에 cert-manager 가 있어야 한다.
  echo "  - messaging-topology-operator ${RABBITMQ_TOPOLOGY_OPERATOR_VERSION}"
  kubectl apply --server-side --force-conflicts -f "$topology_url"
  kubectl -n rabbitmq-system rollout status deployment/messaging-topology-operator --timeout=180s
}
