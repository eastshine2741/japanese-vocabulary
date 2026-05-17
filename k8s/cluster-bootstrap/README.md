# cluster-bootstrap

Prod 클러스터(Hetzner k3s)의 인프라 컴포넌트 매니페스트. 1회성 부트스트랩 용도.

## 구성

| 파일 | 용도 |
|---|---|
| `ccm.yaml` | Hetzner Cloud Controller Manager v1.31.0 — Service type=LoadBalancer 구현, 노드 초기화 |
| `ccm-patch.yaml` | CCM Deployment 패치 — `HCLOUD_NETWORK` 주입 + route controller 비활성 (flannel 충돌 방지) |
| `csi-driver.yaml` | Hetzner CSI Driver v2.21.0 — PVC ↔ Hetzner Volume 자동 연동 |
| `hcloud-secret.template.yaml` | kube-system/hcloud Secret 템플릿 (token + network) |
| `apply.sh` | 위 4개를 순서대로 적용 |

## 사용법

```bash
# kubeconfig을 prod 클러스터로
export KUBECONFIG=~/.kube/kotonoha-prod.yaml

# .env에 다음이 있어야 함:
#   HCLOUD_TOKEN=...      (Read & Write 권한)
#   HCLOUD_NETWORK=kotonoha-net

./apply.sh
```

## 업그레이드

새 버전 release 확인:
- CCM: https://github.com/hetznercloud/hcloud-cloud-controller-manager/releases
- CSI: https://github.com/hetznercloud/csi-driver/releases

매니페스트 다시 받아서 덮어쓰고 `apply.sh` 재실행.

```bash
curl -sfL -o ccm.yaml \
  https://github.com/hetznercloud/hcloud-cloud-controller-manager/releases/download/vX.Y.Z/ccm.yaml

curl -sfL -o csi-driver.yaml \
  https://raw.githubusercontent.com/hetznercloud/csi-driver/vX.Y.Z/deploy/kubernetes/hcloud-csi.yml
```

## 왜 ccm.yaml + patch 구조인가

Hetzner는 두 가지 install profile을 제공:
- `ccm.yaml`: public IP만 사용하는 셋업 (HCLOUD_NETWORK env 없음)
- `ccm-networks.yaml`: private network + route controller 풀 활성화

우리는 private network는 쓰되 라우팅은 flannel VXLAN이 담당하므로 둘 다 그대로는 부적합. `ccm.yaml` + 최소 patch (network env 주입 + route 비활성)가 우리 셋업에 정확히 맞음.
