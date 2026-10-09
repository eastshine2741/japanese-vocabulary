# Terraform — Kotonoha Prod Infrastructure

Hetzner Cloud + Cloudflare 인프라를 코드로 관리.

## 구조

```
infra/terraform/
├── environments/
│   └── prod/                # root module — 여기서 apply (r2.tf: 프로필 사진 버킷)
└── modules/
    ├── cloudflare-dns/      # DNS A records (for_each)
    └── k3s-node-pool/       # k3s 노드 + private network 연결 + placement group (count)
```

## 관리 범위

| | 리소스 |
|---|---|
| ✅ Terraform | hcloud_network, hcloud_network_subnet, hcloud_server (k3s 노드), hcloud_server_network (노드 private IP), hcloud_placement_group, cloudflare DNS records, R2 버킷(`kotonoha-prod`/`kotonoha-dev`)과 커스텀 도메인 |
| ❌ 제외 | CSI driver 가 만든 volume, CCM 이 만든 load balancer, Helm/cert-manager 등 cluster controller 가 lifecycle 관리하는 리소스 |

**원칙**: 한 리소스는 한 도구만 manage. 외부 컨트롤러(CSI, CCM, Helm 등)가 동적으로 생성/삭제하는 리소스는 Terraform 에서 다루지 않는다.

## 사전 준비

`environments/prod/terraform.tfvars` 생성 (gitignored):

```hcl
cloudflare_api_token = "..."   # Zone:DNS:Edit + Zone:Zone:Read + Account:Workers R2 Storage:Edit
hcloud_token         = "..."   # Read & Write
```

토큰 발급:
- Cloudflare: https://dash.cloudflare.com/profile/api-tokens
- Hetzner: Cloud Console → Project → Security → API Tokens

## 실행

```bash
cd environments/prod
terraform init
terraform plan         # No changes 가 정상 상태
terraform apply        # 변경 사항이 있을 때만
```

## State

현재 로컬 (`environments/prod/terraform.tfstate`).

⚠️ **분실 시 모든 리소스가 unmanaged 상태로 떨어짐.** 백업 권장. 향후 원격 백엔드(Hetzner Object Storage S3 호환) 이전 검토.

## 새 리소스 추가

기존 인프라를 import 하려면:

1. resource 블록 작성 (필수 필드만)
2. `terraform import <ADDR> <ID>`
3. `terraform state show <ADDR>` 로 실제 속성 확인
4. 블록에 속성 채워 `terraform plan` → drift 0 까지 반복

Provider docs 의 "Import" 섹션에 ID 형식 명시됨.

## Worktree

`create-worktree.sh` 가 `terraform.tfvars` 도 새 워크트리로 복사함. 다른 worktree 에서 별도 토큰 발급 불필요.
