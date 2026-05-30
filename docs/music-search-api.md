# 음악 검색 API 선정

## 배경

곡 검색 → 메타데이터(제목/아티스트/아트워크/ISRC) 확보 → YouTube로 MV URL 매핑이 현재 흐름. 검색은 **iTunes Search API (Japan region)** 를 사용 중인데, 한도가 매우 낮아 사용자 증가 시 즉시 병목이 된다.

## 문제 — iTunes Search API의 한도

- Apple 공식: **"approximately 20 calls per minute"**, 초과 시 `429 Too Many Requests`
- IP 단위 제한 → 백엔드 한 대로 받으면 사용자가 늘수록 즉시 막힘
- Apple은 heavy 사용 시 Enterprise Partner Feed (EPF) 안내 — 단 EPF는 어필리에이트 파트너용 카탈로그 덤프라 검색 API 대체 부적합
- **Scalability 한계 명확**: 캐시 미스 트래픽이 분당 20건만 넘으면 기능 장애

## 후보 비교 (탈락 옵션 제외)

| API | 인증 | 한도 | 비용 | J-music 커버리지 | 비고 |
|---|---|---|---|---|---|
| **Apple Music API** | JWT (MusicKit) | 비공개, "high" | Apple Developer **$99/년** | 매우 풍부 (iTunes와 동일 카탈로그) | iTunes Search의 정식 업그레이드 경로. 가사 미리보기, ISRC, region 필터 지원 |
| **Deezer Public API** | 없음 | 50 req/5초 (≈600/min) 보고됨 | 무료 (단, 상업 사용은 컨택 필요) | 중간 (J-pop 메이저 OK, 인디·보컬로이드 약함) | 인증 없이 즉시 사용 가능 |
| **MusicBrainz** | User-Agent만 필수 | 1 req/sec/IP (60/min), 50 req/sec/UA | 무료, 오픈 | 사용자 기여 기반 — 메이저 OK, 누락 있음 | 메타데이터만 (오디오/아트워크 X). [Cover Art Archive](https://coverartarchive.org/)와 결합 가능 |

### 탈락 옵션

- **Spotify Web API** — 2025-05부터 extended quota는 **MAU 250K + 법인** 요구. dev mode는 25 users 한도. 신규 앱은 사실상 닫힘
- **YouTube Data API v3** — search=100 units, 일일 10K → **100 검색/일**. 검색 단가가 비싸 주력 부적합. 이미 MV 매핑 용도로만 사용 중
- **iTunes Enterprise Partner Feed** — 카탈로그 덤프, 검색 API 대체 아님

### 보강 소스 (이미 사용 중)

- **VocaDB** — Vocaloid/UTAU/동인 특화. 검색 fallback에도 활용 가능 (현재는 가사 fetch만)

## 채택 전략 — 단계별

### 1단계: 캐시 레이어 (즉시, 비용 0)

검색 패턴이 long-tail (인기곡 반복 조회)이라 **캐싱이 가장 큰 레버리지**.

- 검색어 정규화 + 결과 캐시 (Redis, TTL 7~30일)
- 곡 메타데이터(제목/아티스트/아트워크/iTunes ID/ISRC) 영구 캐시 — 곡 정보는 거의 변하지 않음
- 실질 외부 호출 1/10~1/100 감소 → 현재 규모에서 가장 가성비 좋음
- iTunes Search 한도(20/min)에 부딪히는 시점을 충분히 늦춤

### 2단계: Apple Music API 전환 (검색량 증가 시 또는 iOS 출시 시)

- iTunes Search와 **동일 카탈로그**라 마이그레이션 비용 낮음
- `$99/년` (Apple Developer Program) — iOS 앱 App Store 출시 비용과 **공유**
- 현재는 Google Play 타겟이라 Apple Music API만을 위해 $99/년을 내는지는 검색량 기준으로 판단
- JWT 서명 추가 필요 (MusicKit)
- `/v1/catalog/jp/search` 가 iTunes Search보다 풍부 (가사 미리보기, ISRC, region 필터)

### 3단계: Deezer / MusicBrainz 폴백·보강

- **Deezer**: iTunes/Apple Music 미스 시 fallback. 인증 불필요로 도입 비용 낮음. 단, 광고 붙은 상업 앱 운영 시 약관상 Deezer for Business 컨택 필요 가능성 있음 — 출시 전 약관 재확인
- **MusicBrainz**: 검색용보다는 **ISRC/MBID로 VocaDB·LRCLIB과 가사 매칭** 시 보강 메타데이터로 활용. User-Agent 헤더에 앱 버전 포함 필수

## 의사결정 기준

| 트리거 | 액션 |
|---|---|
| 캐시 미스로 iTunes 429 발생 빈도가 사용자 불만 수준 | 2단계(Apple Music API) 진행 |
| iOS 앱 출시 결정 | 2단계 자동 진행 (어차피 $99/년 발생) |
| 인디/보컬로이드/동인 곡 검색 누락 보고 누적 | VocaDB 검색 통합 우선, 이후 MusicBrainz |
| 메이저 J-pop 검색 누락 | Deezer fallback 도입 |

## 구현 시 주의사항

- **iTunes/Apple Music 응답에 attribution 필수** — Apple 약관: "promotional purpose only", "Available on iTunes" 등 표시 권장
- **MusicBrainz는 User-Agent에 앱 이름 + 버전 + 연락처** 포함 필수. 누락 시 IP 차단 가능
- **Deezer의 무료 사용은 사실상 비공식 영역** — 상업 사용·광고 모델은 약관 회색지대. 출시 전 [Deezer for Developers](https://developers.deezer.com/guidelines) 가이드 재검토
- **캐시 키 설계**: 정규화(NFKC, 공백/대소문자/괄호 처리) 충분히 해야 hit rate 확보. 일본어는 카타카나/히라가나/한자 변형 고려

## Sources

- [iTunes Search API - Apple Performance Partners](https://performance-partners.apple.com/search-api)
- [iTunes Search API: Searching docs](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html)
- [Apple Music API - MusicKit](https://developer.apple.com/documentation/applemusicapi)
- [Apple Developer Program](https://developer.apple.com/programs/) — $99/년, App Store 출시 비용과 동일
- [Spotify Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [Spotify Quota Modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Spotify Extended Access Criteria Update (2025-04)](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- [Deezer Developer Guidelines](https://developers.deezer.com/guidelines)
- [Deezer FAQ for Developers](https://support.deezer.com/hc/en-gb/articles/360011538897-Deezer-FAQs-For-Developers)
- [MusicBrainz API Rate Limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
- [Cover Art Archive](https://coverartarchive.org/)
