# Post-launch Improvements

출시 직전 일정 압박으로 미뤄둔 인프라/보안 개선 항목. 출시 안정화(보통 1~2주) 본 다음 단위로 진행.

---

## 1. Cloudflare Proxy 전환 (우선순위 ⭐⭐⭐)

현재 `api.kotonoha.eastshine.dev` A 레코드는 **DNS only**(gray cloud). origin IP가 그대로 노출되어 있고, Cloudflare의 DDoS 보호·CDN·WAF 등이 작동하지 않음.

### 전환 시 얻는 것
- DDoS 흡수 (4GB 노드 3대로는 자력 방어 어려움)
- Origin IP 은닉 (직접 공격 차단, layered defense)
- 무료 WAF + Bot Fight Mode
- HTTP/3, IPv6 자동 노출
- 무료 Analytics 대시보드

### 작업 (옵션 B = Cloudflare Origin Certificate, 가장 단순)
1. **Cloudflare 대시보드 → SSL/TLS → Origin Server → Create Certificate**
   - hostname: `*.kotonoha.eastshine.dev` + `kotonoha.eastshine.dev`
   - 유효기간 15년 default
2. 발급된 PEM과 key를 K8s Secret으로 주입
   ```bash
   kubectl create secret tls api-tls \
     --cert=origin.pem --key=origin.key \
     -n kotonoha \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
3. `k8s/prod/api/ingress.yaml`에서 `cert-manager.io/cluster-issuer` annotation 제거 (cert-manager 흐름 폐기)
4. **Cloudflare SSL/TLS → Overview → Full (strict)** 모드로 변경
   - Flexible 절대 금지 (origin이 평문이 되어 평문 hop 발생)
5. DNS A 레코드의 Proxy 토글을 orange cloud로 ON
6. (선택) cert-manager 관련 manifest와 ClusterIssuer 정리

### 옵션 A — cert-manager DNS-01 challenge
Let's Encrypt를 유지하고 싶으면:
- Cloudflare API 토큰 발급 (Zone:DNS:Edit 권한, 해당 zone만)
- 새 ClusterIssuer 신규 (DNS-01 solver, Cloudflare provider)
- 기존 `letsencrypt-prod`는 HTTP-01이라 폐기 또는 별도로 유지

작업량은 옵션 B보다 큼. 옵션 B를 더 권장.

### 추가 권장 작업
- **traefik X-Forwarded-For 신뢰 설정**: trustedIPs에 Cloudflare IP 범위 추가
  - 공식 목록: https://www.cloudflare.com/ips/
  - 안 하면 모든 client IP가 Cloudflare IP로 찍힘 (로그·rate limit 무의미)
- **Hetzner firewall로 origin lockdown**: 포트 80/443을 Cloudflare IP 범위만 허용
  - 공격자가 origin IP 알아내도 Cloudflare 우회 불가
- **응답 헤더에 cache-control 명시**: API 응답은 `Cache-Control: private` 또는 `no-store`로 Cloudflare 캐싱 방지

---

## 2. 인증서/시크릿 운영 강화

- **시크릿 매니저 도입** — 현재 `.env.prod` 로컬 파일 + 클러스터 Secret 두 곳. 1Password / Doppler / Vault 등으로 단일 SoT 확보
- **시크릿 회전 정책** — JWT_SECRET / DB password 90일 회전 룰
- **PAT 만료 정책** — GHCR PAT 30~90일 회전, 만료 알림

---

## 3. 데이터 보호

- **MySQL PVC reclaimPolicy = Retain** — 현재 default(`Delete`). StatefulSet 삭제 시 볼륨도 사라짐. StorageClass 신규 생성하거나 PV 생성 후 patch
- **백업 외부 저장** — 현재 mysqldump CronJob은 in-cluster PVC. Hetzner Object Storage / S3 호환 서비스로 이전 (이중화)
- **백업 검증** — 정기적으로 백업 파일 restore 테스트
- **MySQL 모니터링** — slow query log, lock wait timeouts 추적

---

## 4. 배포 자동화 (GitOps)

현재 `./deploy.sh` 수동 실행. 출시 안정화 후:

- **GitHub Actions로 build + ghcr push 자동화** — main 브랜치 push 시 자동 빌드
- **ArgoCD 도입** — 매니페스트가 SoT, drift 자동 reconcile
- **ArgoCD Image Updater** — 새 SHA가 생기면 yaml의 `image:` 자동 commit (현재의 envsubst 패턴 폐기)
- **PR 기반 prod 배포** — 매니페스트 변경 PR 머지 = 배포

---

## 5. 관측 (W-observability 작업)

별도 worktree(`feature/observability`)에서 진행 예정:
- kube-prometheus-stack Helm 설치
- backend `/actuator/prometheus` 노출 + ServiceMonitor
- Grafana 기본 dashboard
- Alert manager (Slack/email 연동)

---

## 6. IaC 정합성 (W-terraform 작업)

별도 worktree(`feature/terraform`):
- Hetzner / Cloudflare provider
- 현 인프라를 `terraform import` → `plan` drift 0 검증

---

## 7. YouTube MV 검색 정확도 개선

`LyricProcessingService.analyze` 안에서 `YoutubeClient.searchMvUrl(title, artist)`가 곡에 따라 공식 MV가 아닌 음원(`"<artist> - Topic"` 채널) 또는 무관 영상을 반환. 현재는 `q="$title $artist"&type=video&part=id&maxResults=1&videoCategoryId=10` 한 번이 전부 — 필터링/스코어링 없음.

### 검증 끝난 알고리즘

1. **캐시 우선 (`artist_channel_cache` 신규 테이블)**: `artist → (youtube_channel_id, uploads_playlist_id)` 매핑
   - 캐시 hit 시 `playlistItems.list?playlistId=…&part=snippet&maxResults=50` (1 unit/페이지, 최대 4페이지) 페이지네이션 → `normalize(item.title) contains normalize(targetTitle)` 매칭 → 스코어 최고 선택
2. **Fallback (캐시 miss 또는 playlist 매칭 실패)**: `search.list?q="$title $artist"&type=video&part=snippet&videoCategoryId=10&maxResults=15` (100 units)
   - 필터: `channelTitle endsWith "- Topic"` 제외, `normalize(item.title) contains normalize(targetTitle)` 필수
   - 스코어:
     - +5: title에 `Music Video|Official Video|Official MV|MV`
     - −10: title에 `弾いてみた|歌ってみた|cover|covered by|ピアノ|ギター|drum|アレンジ|off vocal|ニコカラ|字幕|한글자막|lyrics`
3. **기회주의적 캐싱**: fallback에서 선택된 결과의 `channelTitle`이 artist 이름을 포함하면 `channels.list?id=…&part=contentDetails` (1 unit)로 uploads playlist 조회 후 캐시 write. 다음번 같은 아티스트 곡은 ~4 units로 처리

### 검증 케이스 (정답률 ≈ 11/13, Data API 실제 호출 결과)

- ✅ ヨルシカ/言って。, YOASOBI/夜に駆ける·群青·アイドル, 米津玄師/Lemon, Ado/うっせぇわ, 髭男dism/Pretender, 優里/ドライフラワー, DECO\*27/シンデレラ
- ⚠️ Aimer/残響散歌, DISH//猫 — `THE FIRST TAKE`(라이브)에 밀림. 스코어링으로 보정 가능
- ❌ 구조적 한계: Leo/need(プロセカ)/その音が鳴るなら 같은 **퍼블리셔 채널 업로드 곡**. iTunes `artistName`이 in-track credit인데 실제 MV는 퍼블리셔 채널(プロジェクトセカイ 등)에 있어 artist 이름 기반 매칭 불가. cover라도 음원/무관곡은 아닌 선에서 수용

### 작업 분해

- V20 마이그레이션: `artist_channel_cache(artist_name_lower PK, artist_name, channel_id, uploads_playlist_id, channel_title, created_at, updated_at)`
- `ArtistChannelEntity` + `ArtistChannelRepository` (common 모듈)
- 신규 DTO: `YoutubeChannelsResponse(contentDetails.relatedPlaylists.uploads)`, `YoutubePlaylistItemsResponse(items[].snippet.title, items[].snippet.resourceId.videoId, nextPageToken)`
- `YoutubeClient.searchMvUrl` 재작성: 위 2단계 흐름 + 스코어링 + 캐싱
- 호출부(`LyricProcessingService.analyze`)는 시그니처 동일 → 변경 없음

### Quota 영향

- 첫 곡: 기존과 동일 (100u)
- 캐시된 아티스트 두 번째 곡부터: ~4u (25배 절감)
- 퍼블리셔 채널 곡: 매번 100u + cover-priority (구조적 한계)

### 관련 파일

- `backend/api/src/main/kotlin/com/japanese/vocabulary/song/client/youtube/YoutubeClient.kt:70`
- `backend/api/src/main/kotlin/com/japanese/vocabulary/song/service/LyricProcessingService.kt:64`
- `backend/migration/src/main/resources/db/migration/` (V20 추가)

---

## 8. 네트워크 격리 (W-private-net 작업)

별도 worktree(`feature/private-subnet`), **출시 후 24h 안정화 본 다음**:
- worker 노드를 private subnet 이동
- master만 public, NAT으로 worker 외부 접근
- maintenance window 필요, downtime 동반

---

## 우선순위 가이드

| 항목 | 권장 시점 |
|---|---|
| Cloudflare Proxy 전환 | 출시 + 1주 (트래픽 패턴 본 후) |
| 시크릿 매니저 | 출시 + 1~2주 |
| MySQL PVC Retain + 백업 외부 저장 | 출시 + 1주 |
| GitOps (ArgoCD) | 출시 + 2~4주 |
| W-observability | 출시 검토 기간 (월요일~) |
| W-terraform | 출시 검토 기간 |
| YouTube MV 검색 정확도 | 출시 + 2~4주 (UX 영향, quota 압박 시 앞당김) |
| W-private-net | 출시 + 1주 (안정화 후) |
