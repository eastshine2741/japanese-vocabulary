# cluster-bootstrap

Prod 클러스터(Hetzner k3s)의 인프라 컴포넌트 매니페스트. 1회성 부트스트랩 용도.

외부 OSS 컴포넌트(CCM/CSI/cert-manager)는 **Helm**으로 설치하고, 차트 values만 git에 둠.
나머지(traefik HelmChartConfig, hcloud Secret)는 raw YAML.

## 구성

| 파일 | 용도 |
|---|---|
| `values/ccm.yaml` | Hetzner CCM (chart 1.31.0) — Service type=LoadBalancer 구현, 노드 초기화. `HCLOUD_NETWORK` 주입 + route controller 비활성 |
| `values/csi.yaml` | Hetzner CSI Driver (chart 2.21.0) — PVC ↔ Hetzner Volume 자동 연동 |
| `values/cert-manager.yaml` | cert-manager (chart v1.20.2) — Let's Encrypt TLS 자동 발급/갱신, CRD 포함 |
| `traefik-config.yaml` | k3s 내장 traefik Service에 Hetzner LB annotation 주입 (HelmChartConfig) |
| `hcloud-secret.template.yaml` | kube-system/hcloud Secret 템플릿 (token + network) |
| `apply.sh` | 위 항목들을 순서대로 적용 (helm + kubectl 혼용) |
| `k3s/*-config.yaml`, `k3s/apply.sh` | 노드 `/etc/rancher/k3s/config.yaml` — kubelet reserved 메모리 + memory eviction. SSH로 배포 후 한 대씩 재시작 |

## 사용법

```bash
# 사전 준비
# - helm CLI 설치 (pacman -S helm 등)
# - kubeconfig을 prod 클러스터로
export KUBECONFIG=~/.kube/config
kubectl config use-context kotonoha-prod

# .env에 다음이 있어야 함:
#   HCLOUD_TOKEN=...      (Read & Write 권한)
#   HCLOUD_NETWORK=kotonoha-net

./apply.sh
```

`apply.sh`는 idempotent — `helm upgrade --install` 사용. 여러 번 돌려도 안전.

## 업그레이드

새 버전 release 확인:
- CCM: https://github.com/hetznercloud/hcloud-cloud-controller-manager/releases
- CSI: https://github.com/hetznercloud/csi-driver/releases
- cert-manager: https://github.com/cert-manager/cert-manager/releases

`apply.sh` 상단의 버전 변수를 수정한 후 재실행:

```bash
CCM_VERSION="1.31.0"
CSI_VERSION="2.21.0"
CERT_MANAGER_VERSION="v1.20.2"
```

## k3s install 시 권장 옵션

다음 클러스터 재구축 시 master install 명령에 추가:

- `--disable=servicelb` (Hetzner LB로 대체)
- `--disable=local-storage` (Hetzner CSI로 대체. 빼놓으면 local-path StorageClass가 함께 default로 잡혀 PVC 라우팅이 비결정적)
- `--disable-cloud-controller` (Hetzner CCM으로 대체)
- `--kubelet-arg=cloud-provider=external`

apply.sh는 `local-path`가 남아있더라도 default flag만 제거하는 안전망을 가짐 (idempotent).

## kubelet 메모리 예약과 eviction

4GB 노드에서 파드 밖(OS, k3s, containerd)이 ~600MB(control-plane은 k3s-server만 ~1.2GB)를 쓴다.
k3s 기본값은 `system-reserved`/`kube-reserved`가 비어 allocatable = RAM 전체이고,
`eviction-hard`를 disk 항목만으로 덮어써 `memory.available` eviction이 꺼져 있다.
그 결과 스케줄러가 노드를 꽉 채우면 page cache thrashing으로 probe가 실패했다 (2026-09-27 hel1-3).

`k3s/apply.sh [node...]`로 적용한다. kubelet 인자(`cloud-provider=external` 포함)는 전부 `config.yaml`에 둔다 —
systemd 유닛의 명령줄 `--kubelet-arg`가 있으면 config.yaml의 `kubelet-arg` 목록을 통째로 덮어쓰므로 `apply.sh`가 유닛에서 지운다. 값을 바꾸면 노드별 allocatable 합이 워커 파드 request 합(+ rolling update surge)을 넘는지 확인할 것.

## 노드 추가

1. `infra/terraform`에서 `node_count`와 `private_ips`를 늘리고 apply. private IP는 CCM LoadBalancer가 쓰는 IP(현재 10.0.0.5)를 피한다.
2. 새 노드에 config.yaml을 먼저 넣고 k3s agent 설치 (`--kubelet-arg`는 명령줄에 넣지 않는다):
   ```bash
   TOKEN=$(ssh root@37.27.220.52 cat /var/lib/rancher/k3s/server/node-token)
   ssh root@<public-ip> "mkdir -p /etc/rancher/k3s && cat > /etc/rancher/k3s/config.yaml" < k3s/agent-config.yaml
   ssh root@<public-ip> "curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.35.4+k3s1 \
     K3S_URL=https://10.0.0.2:6443 K3S_TOKEN=$TOKEN sh -s - agent --node-ip=<private-ip> --flannel-iface=enp7s0"
   ```
3. `providerID`가 `hcloud://...`이고 uninitialized taint가 없어졌는지 확인, `k3s/apply.sh`의 `NODES`에 추가.

## 왜 CCM에 networking + route 비활성을 켜는가

Hetzner CCM의 route controller는 노드 간 통신을 위해 Hetzner private network에 라우트를 자동 등록함.
하지만 k3s는 기본적으로 **flannel VXLAN**으로 라우팅 — Hetzner 라우트와 충돌·중복.

따라서:
- `networking.enabled: true` → `HCLOUD_NETWORK` env 주입해서 노드 private IP 인식만 받음
- `HCLOUD_NETWORK_ROUTES_ENABLED=false` → 라우트 컨트롤러 비활성, flannel에 맡김

## 왜 helm + raw YAML 혼용인가

- **외부 컴포넌트 (CCM/CSI/cert-manager)**: 업스트림이 Helm chart로 배포·유지. 차트 사용이 정공법.
- **traefik-config**: k3s 내장 traefik의 values를 덮어쓰는 `HelmChartConfig` — k3s 네이티브 CRD라 raw YAML 그대로.
- **hcloud Secret**: 단순 Secret + envsubst 템플릿. 차트화할 가치 없음.
