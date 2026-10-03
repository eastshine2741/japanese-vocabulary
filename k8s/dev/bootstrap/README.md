# dev/bootstrap

로컬 k3s의 1회성 부트스트랩. `deploy.sh`가 네임스페이스를 만들기 전에 클러스터에 한 번만 돌린다.

prod와 달리 CCM/CSI/Traefik LB 설정은 없다 — 로컬 k3s는 `local-path`와 내장 traefik을 그대로 쓴다.
여기서 까는 건 **RabbitMQ 오퍼레이터 둘과 그 전제인 cert-manager**뿐이다.

## 구성

| 파일 | 용도 |
|---|---|
| `values/cert-manager.yaml` | cert-manager (chart v1.20.2). dev에서는 TLS 발급이 아니라 messaging-topology-operator의 webhook 인증서 때문에 깐다. `ClusterIssuer`는 두지 않는다 |
| `apply.sh` | cert-manager → RabbitMQ 오퍼레이터 순서로 적용 |

RabbitMQ 오퍼레이터 버전은 prod와 같아야 CRD 스키마가 어긋나지 않으므로 `k8s/bootstrap-lib.sh`
한 곳에서 핀하고 양쪽 `apply.sh`가 source 한다.

## 사용법

```bash
kubectl config use-context default     # 로컬 k3s
./apply.sh
```

`apply.sh`는 idempotent하고, context가 `kotonoha-prod`면 거부한다.

## 언제 다시 돌리나

- 클러스터를 새로 만들었을 때
- `k8s/bootstrap-lib.sh`의 오퍼레이터 버전을 올렸을 때

워크트리마다 네임스페이스를 새로 파는 배포(`./deploy.sh <ns>`)에는 다시 돌릴 필요가 없다.
오퍼레이터는 클러스터당 하나이고 모든 네임스페이스를 감시한다. `deploy.sh`는 CRD가 없으면
이 스크립트를 돌리라는 메시지와 함께 멈춘다.

## 자원

오퍼레이터는 네임스페이스 수와 무관하게 고정 비용이다.

| | requests |
|---|---|
| cluster-operator | 200m / 500Mi |
| messaging-topology-operator | 300m / 128Mi |
| cert-manager 3종 | 30m / 160Mi (values에서 축소) |

네임스페이스마다 생기는 것은 `RabbitmqCluster`가 만드는 브로커 파드 하나(100m / 256Mi)다.
`spec.resources`를 비우면 CRD 기본값 1000m / 2Gi가 들어가므로 `cluster.yaml`에서 반드시 명시한다.
