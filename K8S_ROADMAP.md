# K8s 도입 로드맵

## 목표 (우선순위순)

1. 집 밖에서도 빠르게 서버를 띄워서 프론트 앱으로 테스트하기
2. git worktree별 독립 환경에서 백엔드 + 프론트 동시 테스트
3. k3s 클러스터를 이용한 K8s 학습
4. dev/prod 환경 구축

## 기술 스택

| 카테고리 | 선택 | 비고 |
|---|---|---|
| 배포판 | k3s | 경량, 단일노드 최적 |
| 런타임 | containerd | k3s 기본 내장 |
| CNI | Flannel | k3s 기본 내장 |
| Ingress | Traefik | k3s 기본 내장 |
| Storage | local-path-provisioner | k3s 기본 내장 |
| 패키지 관리 | Helm | 환경별 설정 분리, 모니터링 스택 설치 용이 |

## 배포 파이프라인

```
개발 (Goal 1, 2):
  worktree에서 코드 수정
  → 로컬 docker build -t app:{branch}
  → k3s에 이미지 주입
  → namespace별 독립 배포
  → {namespace}.localhost로 프론트 연결

릴리즈 (Goal 4, 나중에):
  main 머지
  → GitHub Actions → ghcr.io push
  → ArgoCD → prod namespace 자동 배포
```

## 프론트엔드 테스트 방식

- 백엔드만 K8s에 배포. Metro dev server는 로컬에서 워크트리마다 다른 포트로 실행
- 앱에 디버깅 화면 추가하여 base URL 전환 (e.g. foo.localhost, bar.localhost)
- 프론트 변경이 있는 worktree는 해당 Metro dev server에 연결

## Phase 1: 기반 구축

- [x] k3s 설치
- [x] Dockerfile 작성 (Spring Boot 백엔드)
- [ ] K8s 매니페스트 작성 (backend, MySQL, Redis)
- [ ] 단일 namespace에서 앱 동작 확인

## Phase 2: 멀티 환경

- [ ] namespace별 배포 스크립트 (worktree명 기반)
- [ ] Ingress 설정 ({namespace}.localhost 라우팅)
- [ ] 프론트 앱에 base URL 전환 디버깅 화면 추가

## Phase 3: 모니터링

- [ ] kube-prometheus-stack 설치 (Helm)
- [ ] Loki 설치 (Helm)
- [ ] Grafana 대시보드 구성

## Phase 4: 자동화 배포

- [ ] GitHub Actions 워크플로우 (이미지 빌드 → ghcr.io push)
- [ ] ArgoCD 설치 및 연결
- [ ] dev/prod namespace 분리
