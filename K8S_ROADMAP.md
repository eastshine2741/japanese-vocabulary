# K8s 도입 로드맵

## 목표 (우선순위순)

1. 집 밖에서도 빠르게 서버를 띄워서 프론트 앱으로 테스트하기
2. git worktree별 독립 환경에서 백엔드 + 프론트 동시 테스트
3. k3s 클러스터를 이용한 K8s 학습

## 기술 스택

| 카테고리 | 선택 | 비고 |
|---|---|---|
| 배포판 | k3s | 경량, 단일노드 최적 |
| 런타임 | containerd | k3s 기본 내장 |
| CNI | Flannel | k3s 기본 내장 |
| Ingress | Traefik | k3s 기본 내장 |
| Storage | local-path-provisioner | k3s 기본 내장 |
| 패키지 관리 | Helm | 모니터링 스택 등 서드파티 설치용 |

## 배포 파이프라인

```
홈서버에서 직접 빌드 + 배포 (deploy.sh):
  git pull (또는 worktree 생성)
  → docker build -t japanese-vocabulary:{namespace}
  → k3s ctr images import (로컬 주입, 레지스트리 불필요)
  → kubectl apply -n {namespace}

집 밖에서 작업 시:
  노트북에서 git push
  → ssh homeserver
  → git pull && ./deploy.sh
```

## 프론트엔드 테스트 방식

- 백엔드만 K8s에 배포. Metro dev server는 로컬에서 워크트리마다 다른 포트로 실행
- 앱에 디버깅 화면 추가하여 base URL 전환 (e.g. foo.localhost, bar.localhost)
- 프론트 변경이 있는 worktree는 해당 Metro dev server에 연결

## Phase 1: 기반 구축

- [x] k3s 설치
- [x] Dockerfile 작성 (Spring Boot 백엔드)
- [x] K8s 매니페스트 작성 (backend, MySQL, Redis)
- [x] 단일 namespace에서 앱 동작 확인

## Phase 2: 멀티 환경

- [ ] namespace별 배포 스크립트 (`deploy.sh`)
- [ ] Ingress 설정 ({namespace}.localhost 라우팅)
- [ ] 프론트 앱에 base URL 전환 디버깅 화면 추가

## Phase 3: 모니터링 (optional)

- [ ] kube-prometheus-stack 설치 (Helm)
- [ ] Loki 설치 (Helm)
- [ ] Grafana 대시보드 구성

## Phase 4: 자동화 배포 (필요해지면)

현재는 `deploy.sh`로 충분. 배포 빈도가 높아지거나 팀 협업이 생기면 도입 검토.

- [ ] GitHub Actions 워크플로우 (이미지 빌드 → ghcr.io push)
- [ ] ArgoCD 설치 및 연결
