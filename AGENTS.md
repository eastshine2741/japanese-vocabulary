# AGENTS.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song → lyric-based study → vocabulary capture → flashcard review → better understanding

## Quick Reference

### Build & Run

`gradlew`는 `backend/` 디렉토리에 위치. 반드시 `backend/`에서 실행할 것.

배포는 k3s 클러스터로 운영. 백엔드/DB는 `./deploy.sh`로 띄우고, 프론트엔드는 로컬에서 실행:

```bash
./deploy.sh                                   # k3s에 backend(api+batch) + mysql + redis 배포
cd backend && ./gradlew :admin-api:test       # Admin API tests
cd admin-web && npm run dev                   # Admin Web (local, http://localhost:5174)
cd app-rn && npx expo run:android             # App - Android
cd app-rn && npx expo start --web             # App - Web (dev)
```

### Multi-worktree Frontend

`DEPLOY_NS` 환경변수로 Android 패키지명을 분리하여 같은 디바이스에 여러 브랜치 앱 공존 가능.

```bash
cd app-rn
DEPLOY_NS=issue-21 npx expo run:android      # dev.eastshine.kotonoha.issue21 로 설치
```

- `DEPLOY_NS` 미설정 시 기본값 `main` → `dev.eastshine.kotonoha.main`
- 패키지 이름이 바뀌면(예: 구 `com.anonymous.apprn.*`) `npx expo prebuild --clean` 으로 `android/` 재생성 필요. 기존 설치된 구 패키지 앱은 수동 삭제.
- Google OAuth 흐름은 namespace마다 별개 client_id 필요 (Google Cloud Console에서 1~2분 등록)
- `app-rn/.env`의 `EXPO_PUBLIC_BACKEND_URL`도 해당 namespace 서버에 맞출 것
- `android/`는 gitignored — 각 워크트리에서 첫 빌드 시 자동 생성 (`expo prebuild`)
- 이미 `android/`가 있는 상태에서 `DEPLOY_NS`를 바꿨으면 `npx expo prebuild --clean`으로 재생성 필요

- 워크트리 패키지는 `google-services.json`에 client가 없어 빌드 실패 → `EXPO_PUBLIC_FIREBASE_DISABLED=1`로 Firebase 끄고 빌드 (푸시만 비활성). 플러그인 셋 바뀌므로 최초 1회 `prebuild --clean`. 반복 피하려면 `app-rn/.env`에 추가.

### K8s Deploy (k3s)

```bash
./deploy.sh              # 현재 브랜치명으로 namespace 결정, 빌드+배포 (dev: api+batch+admin-api+admin-web)
./deploy.sh foo           # namespace 직접 지정
./teardown.sh             # 현재 브랜치 namespace 삭제 (main은 거부)
./teardown.sh foo         # namespace 직접 지정하여 삭제
```

- 이미지 태그는 git commit SHA 사용 — 커밋 안 한 변경사항은 배포 불가
- secret은 `.env`에서 관리 (gitignored), `envsubst`로 템플릿에 주입
- kubectl context가 `default`가 아니면 실행 거부

### Environment Variables

`.env` (gitignored, repo 루트). `deploy.sh` 가 `envsubst`로 secret 템플릿에 주입:

| Variable | Purpose |
|---|---|
| `MYSQL_USER` / `MYSQL_PASSWORD` | MySQL credentials |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `JWT_SECRET` | JWT signing key (defaults to dev key) |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Web OAuth Client ID — audience for ID token verification (same value as `EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID` in `app-rn/.env`) |
| `PENCIL_CLI_KEY` | Pencil CLI auth for headless .pen file editing |
| `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` | Base64-encoded Firebase service account JSON. Mounted into the batch pod at `/var/secrets/firebase/service-account.json`; FCM admin sender uses it. Generate via Firebase console → Service accounts → Generate new private key. See `.omc/runbooks/push-notification-setup.md`. |
| `ADMIN_PASSWORD` / `ADMIN_PASSWORD_SHA256` | Admin API password source. For local dev, `ADMIN_PASSWORD` defaults to `admin` in `deploy.sh` if unset. Prefer `ADMIN_PASSWORD_SHA256` for shared environments. |
| `ADMIN_TOKEN_SECRET` | Admin-only bearer token signing key. Separate from public `JWT_SECRET`; defaults only for local dev. |

## Backend Module Structure

Multi-module Gradle (Kotlin DSL) at `backend/`. 항상 `backend/`에서 `./gradlew` 실행.

```
backend/
├── common/                  — cross-cutting infra (RedisCache, BusinessException, ErrorCode, JsonListConverter, base test fixtures, AfterCommitListenerTest base)
├── migration/               — Flyway migrations
├── domains/                 — pure domain modules (no @SpringBootApplication)
│   ├── auth/                — Google OIDC + JWT, AuthService
│   ├── user/                — UserEntity + Settings + DeviceToken
│   ├── userinventory/       — freeze inventory etc.
│   ├── song/                — Song/Lyric entity + repository + lyric 저장 모델(AnalyzedLine/Token/PartOfSpeech/LyricLineData) + LRC parser. Redis/external music client/use case 없음
│   ├── song-analysis/       — song_analysis_work 상태머신 + trigger/polling DTO. song 모듈을 의존하지 않으며 song_id/lyric_id는 Long projection으로만 보관
│   ├── translation/         — 가사 분석+번역 파이프라인: KoreanLyricTranslationService + GeminiClient + JishoService(cache-aside+동시성) + JishoClient(API만) + JishoCache(RedisCache 자식). **batch만 의존** (가사 번역 스케줄러만 사용). 형태소 분석은 LLM이 직접 수행(Kuromoji 폐기 2026-06) — analyzer/사전 의존성 없음. jisho 조회는 Redis 캐시(`JishoCache`)
│   ├── flashcard/           — word + flashcard packages merged (word ↔ flashcard cycle): WordEntity, FlashcardEntity, repositories, services, events
│   ├── deck/                — DeckEntity, DeckService, DeckEventListener
│   ├── studystats/          — DailyStudySummary, StreakCalculator (Spring Batch 잡 본체는 batch 모듈로 분리됨 — 도메인 모듈은 Job/Scheduler를 갖지 않음. 그래야 api가 studystats를 의존해도 spring-batch가 classpath에 안 올라와 startup 잡 자동실행이 안 생김)
│   └── notification/        — FCM 전송 + FirebaseConfig + NotificationLogEntity 만. Scheduler/조회 로직은 없음. 외부 데이터 접근은 `PushNotificationDataPort` 인터페이스로 추상화 (구현체는 `batch`)
├── integrations/            — external music provider clients. `song-search`(iTunes, package `songsearch`), `lyric-search`(LRCLIB/VocaDB, package `lyricsearch`), `mv-search`(YouTube, package `mvsearch`). Active integration modules provide AutoConfiguration; no hexagonal port layer.
├── api/                     — REST bootstrap (@SpringBootApplication). translation을 제외한 사용자 API 도메인 모듈 의존(song-analysis 포함). controller/ + per-domain dto/ (HTTP 입출력). @Scheduled 없음. Component scan은 app-local package로 좁히고, `ApiLocalConfiguration`이 api-local controllers/services/config를 @Import한다.
├── admin-api/               — internal admin REST bootstrap. v1 is read-only for song/lyric/user inspection, password-only admin auth, admin-specific stateless bearer token. It depends on song/user/song-analysis core only and must not depend on music integration modules. Cross-module JPA wiring comes from depended modules' AutoConfiguration; admin-api registers only its own repositories.
└── batch/                   — 스케줄 잡 bootstrap (@SpringBootApplication, @EnableScheduling). 필요한 도메인만 의존 (현재 song, song-analysis, translation, studystats, notification, user, flashcard) plus lyric-search/mv-search integrations. 모든 @Scheduled는 여기. SongAnalysisWorkScheduler, FreezeConsumeScheduler 등. Component scan은 app-local package로 좁히고, `BatchLocalConfiguration`이 batch-local scheduler/job/service/config를 @Import한다.
```

### 모듈 의존성 원칙

- **batch가 의존하는 도메인은 최소화**. 필요한 도메인만 추가. JPA 엔티티 로드 비용 절감.
- **api는 사용자 API에 필요한 도메인 의존**. 현재 REST 표면은 대부분의 사용자 도메인을 노출하고 song 조회/분석 polling 때문에 `song`과 `song-analysis`를 둘 다 의존한다. **예외: translation** — 가사 번역 스케줄러(batch)만 사용하므로 batch 전용 유지. (Kuromoji 폐기 후 힙 비용 사유는 사라졌지만 api가 의존할 이유도 없음.)
- **admin-api는 public api와 분리된 bootstrap**. v1은 `song`, `lyric`, `user` 조회만 제공하고 mutation route를 만들지 않는다. admin-api는 `domains:song` core를 의존하되 music integration module을 의존하지 않는다. 타 모듈 entity/repository scan 지식은 application bootstrap에 두지 않고, 각 active module의 AutoConfiguration이 제공한다. admin-api는 자기 repository만 app-local config로 등록한다.
- **active module은 자기 Spring surface를 AutoConfiguration으로 선언한다**. Spring bean을 제공하는 domain/integration module은 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`와 `com.japanese.autoconfigure.*` 설정 클래스를 둔다. AutoConfiguration은 해당 모듈의 `com.japanese.vocabulary.<module>` package를 `@ComponentScan`으로 열고, entity/repository는 `@EntityScan`/`@EnableJpaRepositories`로 등록한다. Application module은 Gradle dependency로 기능 조합을 선택하고, module 내부 wiring은 해당 module이 소유한다. `api`/`batch` bootstrap은 broad root component scan을 쓰지 않고 app-local class만 `@Import`한다.
- **도메인 모듈은 persistence-aware domain core로 수렴**. 목표 구조는 entity/model/enum, domain method/service, invariant/state transition 중심이다. `SongRepository`, `LyricRepository` 같은 JPA repository는 이번 모듈화 pass에서 외부 노출을 유지한다. Page/search/projection/read-model repository와 application별 read/write workflow는 장기적으로 `api`, `admin-api`, `batch`가 각자 소유하되 이번 pass에서 repository 전면 분리는 하지 않는다.
- **외부 API client는 domain core가 아니다**. iTunes/YouTube/LRCLIB/VocaDB 같은 HTTP client와 provider DTO는 application별로 중복하지 않고 기능별 integration 모듈에 둔다. 목표 모듈은 `integrations:song-search`(iTunes), `integrations:lyric-search`(LRCLIB/VocaDB), `integrations:mv-search`(YouTube)다. 이 프로젝트에서는 불필요한 port/adapter 복잡도를 피하고, 필요한 application module이 client class를 직접 사용한다. integration client는 `RestClient` 중심으로 통일하고, 해당 integration module의 AutoConfiguration이 client bean surface를 제공한다.
- **integration package는 domain package와 분리한다**. integration 모듈의 Kotlin package는 `com.japanese.vocabulary.songsearch`, `com.japanese.vocabulary.lyricsearch`, `com.japanese.vocabulary.mvsearch`처럼 소유 모듈을 드러내야 한다. `com.japanese.vocabulary.song.client.*` 아래에 새 외부 client를 추가하지 않는다.
- **외부 client 설정은 integration client + application별 properties override로 처리한다**. timeout, connection, retry 같은 차이가 필요하면 client class를 복제하지 말고 해당 integration module을 사용하는 `api`, `batch` 등의 yml/env에서 같은 property namespace를 다르게 설정한다.
- **cache 위치는 의미로 결정한다**. 이번 pass에서는 Redis cache를 integration module에 넣지 않고 현재 behavior owner application에 둔다. `SongSearchCache`는 `api`, `ArtistChannelCache`는 `batch`, `RecentSongService`/`SearchHistoryService`는 `api`가 소유한다.
- **Admin write는 raw field update 금지**. 향후 admin mutation은 entity별로 허용된 domain method/service를 통해서만 수행한다. DTO 바인딩이나 generic table editor로 엔티티 필드를 직접 여는 방식은 금지하며, 필요한 경우 audit logging을 붙인다.
- **Spring Batch Job/Step config·Scheduler·잡 워커 서비스는 batch bootstrap 모듈에만 둔다. 도메인 모듈에 두지 말 것** — 도메인 모듈에 `spring-boot-starter-batch`가 들어가면 그 모듈을 의존하는 api에도 spring-batch가 classpath에 올라와 `JobLauncherApplicationRunner`가 startup에 잡을 자동 실행한다 (`runDate parameter required` 류 에러). 잡은 batch가 스케줄러로만 트리거.
- **외부 API 클라이언트(`@Value`로 필수 키 주입)가 integration 모듈에 있고 그 integration을 application이 의존하면, 해당 application yml에도 해당 키를 넣어야** placeholder 미해석 크래시를 피한다 (e.g. `integrations:mv-search`의 `YoutubeClient` → batch에 `youtube.api-key`).
- **통합테스트는 bootstrap 모듈(api/batch)에만 둔다. 도메인 모듈에 테스트용 @SpringBootApplication(TestBoot)을 만들지 말 것** — 부트클래스가 도메인 패키지에 있으면 repo/entity 스캔 범위가 그 패키지로 좁아져 cross-domain 빈이 unresolved 된다 (`scanBasePackages`는 컴포넌트 스캔만 넓힐 뿐). 리스너 직접 호출 테스트는 api의 `ApiAfterCommitListenerTest` 상속.
- 도메인 모듈끼리는 필요할 때 의존 (e.g. `flashcard` → `song` repository 사용). 단 한쪽이 너무 많은 cross-domain repo를 import하면 service 메서드 도입 고려.

### dto / model / entity 명명 규칙

- **`entity/`** — JPA `@Entity`. 도메인 모듈 내부 전용. cross-module로 넘기지 말 것.
- **`dto/`** — 모든 클래스가 `Request | Response | Dto` 셋 중 하나로 끝나야 함. **한 파일에 하나의 클래스**.
  - 도메인 모듈 `dto/`: 모듈 간 통신용 (e.g. `UserDto`, `DeckDto`, `AnalyzedSongDto`, `FlashcardDto`)
  - api 모듈 `dto/`: HTTP 입출력용 (e.g. `AuthResponse`, `SongDto`, `AnalyzeSongRequest`). 도메인 dto와 형상이 같으면 도메인 것을 그대로 노출해도 됨.
- **`model/`** — 도메인 내부 common value type. dto도 entity도 아닌 것 (e.g. `WordMeaning`, `Token`, `PartOfSpeech`, `UserSettingsData`, `LyricLineData`). cross-module dto 용도로 쓰지 말 것.
- Entity → Dto 변환은 `fun XxxEntity.toDto(): XxxDto` extension.

## Backend Domain Layer Boundaries

```
Inner:  Song, Lyric             — 콘텐츠 원본
Middle: Word, SongWord, Flashcard — 사용자 학습 데이터
Outer:  Deck, DeckFlashcard      — 조직화 레이어
```

**규칙:**
- 같은 계층 내: 서비스 간 직접 호출 (e.g. WordService → FlashcardService)
- 계층 경계를 넘을 때만 Spring Event 사용 (e.g. FlashcardCreatedEvent/FlashcardDeletedEvent → DeckEventListener)
- 안쪽 계층이 바깥쪽 계층을 참조하면 안 됨

### Spring Event Listeners — AFTER_COMMIT 규칙

- **`@TransactionalEventListener(phase = AFTER_COMMIT)` 안에서 DB 쓰기를 하려면 `@Transactional(propagation = REQUIRES_NEW)`를 같이 붙일 것.** 안 붙이면 좀비 EntityManager 재사용으로 `TransactionRequiredException` 발생
- **listener 직접 호출 테스트는 `AfterCommitListenerTest` 상속, setup은 `inTx { ... }`로 감쌀 것.** 기본 rollback base는 AFTER_COMMIT을 발화시키지 않고 REQUIRES_NEW와 row lock 충돌함
- 이벤트 발행 검증은 기존 base + `@RecordApplicationEvents` (변경 없음)

## Song Analysis Flow

비동기 work pipeline. 검색 결과 선택 시 유저앱은 먼저 `GET /api/songs?title=...&artistName=...`로 기존 song+lyric을 exact match 조회한다. 200이면 즉시 player 데이터를 사용하고, 204이면 `/api/songs/analyze`로 `song_analysis_work`를 생성 또는 재사용한다. `/api/songs/analyze`는 더 이상 가사/Youtube/provider 조회를 동기 실행하지 않고 즉시 work 상태를 반환한다. 유저앱은 `/api/songs/analysis-work/{workId}`를 polling하고, `song_id + lyric_id + player_ready_at` milestone이 생기면 `GET /api/songs/{id}`로 player 데이터를 읽는다.

1. **Trigger** (`api` + `song-analysis`): analyze 요청 → `SongAnalysisWorkService.createOrReuse()` → active raw `title|artist` work가 있으면 기존 `workId` 반환, 없으면 `song_analysis_work(PENDING)` 생성. 기존 song+lyric 조회는 `GET /api/songs?title&artistName` 사전 조회의 책임이며, analyze trigger는 provider/song 조회를 하지 않는다.
2. **Batch claim** (`batch`, `SongAnalysisWorkScheduler`, `@Scheduled fixedRate=30s`): `PENDING` work를 claim해 `RUNNING`으로 바꾸고 lock owner/until을 기록한다.
3. **Pre-analysis pipeline** (`batch` + `song`): stage를 `FETCH_LYRICS` → `FETCH_YOUTUBE` → `CREATE_SONG_AND_LYRIC`로 갱신하며 LRCLIB/VocaDB 가사 조회, Youtube MV 조회, songs+lyrics 생성을 수행한다.
4. **Player-ready milestone**: song과 lyric이 생성되면 `song_id`, `lyric_id`, `player_ready_at`을 설정한다. `PLAYER_READY`는 status가 아니다.
5. **Lyric analysis** (`batch` + `translation`): stage `ANALYZE_LYRICS`에서 `KoreanLyricTranslationService.runPipeline()` 실행 → batch-local completion service가 `lyrics.analyzed_content` 저장과 work `COMPLETED`를 같은 트랜잭션에서 처리.

Work status는 `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`만 사용한다. 첫 pass에는 request table, attempt table, automatic retry, MQ, FCM completion path가 없다. 실패 시 work는 `FAILED`가 되고 `active_dedup_key`를 `NULL`로 비워서 같은 곡을 다시 요청하면 새 work를 만들 수 있다. `lyrics`는 원문/분석 결과 저장만 맡고, 상태머신은 `song_analysis_work`가 소유한다.

### word-meaning 파이프라인 (2026-06 재설계, 뜻 생성 단계 gemini-3.1-flash-lite)

흐름: `(번역 ∥ [segment → jisho]) → sense-select → translate → assemble`. 번역(pro)과 `segment→jisho` 체인을 병렬로 돌리고, 둘을 join해 sense-select·translate를 순차 실행한 뒤 코드가 토큰으로 조립한다.

1. **segment** (LLM): 원문 줄 → 의미 단위 분절 + 사전형 환원(가능/사역/수동 파생 제거). Kuromoji 대체.
2. **jisho** (코드): 분절된 표제어를 jisho 조회 → 후보 뜻(sense) 목록. 동음이의·이형은 모든 후보를 펼치고, 캐시(`JishoCache`)·동시성 제한·재시도는 `JishoService`가 담당.
3. **sense-select** (LLM): 번역문을 문맥 단서로 각 단어의 알맞은 sense 하나를 고른다(뜻을 직접 만들지 않음 → 과교정 차단). 이전 correction 패스를 이 단계가 대체.
4. **translate** (LLM): 선택된 sense의 영어 뜻을 한국어로(품사 일관). 조사는 대응 한국어 조사로.
5. **assemble** (코드): 선택 sense에서 reading/품사/JLPT/뜻을 채운다. sense 없으면 비움(no-fallback). 비(非)일본어(문장부호·영어·숫자)는 `SYMBOL`로 표시해 학습 대상에서 제외.

실패 시 첫 pass에서는 자동 retry 없이 `song_analysis_work.status=FAILED`로 종료한다. 사용자가 같은 곡을 다시 요청하면 새 work가 생성되어 다시 처리된다. 실험·검증 코드: `gemini-playground/word-meaning-harness/`(Python 프로토타입이 Kotlin과 동치). 비용 ≈ $0.031/곡.

> **주의**: jisho 캐시 등 Redis에 저장하는 DTO 스키마를 바꾸면 **옛 `jisho:*` 캐시를 반드시 비울 것**. unknown 필드 무시로 옛 값이 빈 결과로 역직렬화되면 전 토큰이 무음(뜻/품사 없음)이 되며 에러 로그도 안 남는다.

## Push Notification

- FCM 전송: `PushNotificationService` (notification 도메인). FirebaseAdmin SDK로 메시지 전송 + 실패 토큰 정리.
- 후보 조회: `PushNotificationQueryService` (batch 모듈). 여러 도메인 JPA repository (UserRepository, UserSettingsRepository, DeviceTokenRepository, FlashcardRepository, NotificationLogRepository)를 조합해 `PushNotificationDataPort.findCandidates()` 구현.
- 스케줄링: `PushNotificationScheduler` (batch 모듈, cron 09:00 / 18:00 KST). 후보 조회 → FCM 전송 → 로그 기록.

## Key Architecture Decisions

- **Song search**: iTunes API (Japan region) → YouTube API for MV URL
- **Decks**: per-song decks in DB; "all" deck is virtual
- **Auth**: stateless JWT, 30-day expiry, no refresh token
- **Admin v1**: separate `admin-api` + `admin-web`; password-only admin login; short-lived admin bearer token stored in `sessionStorage`; read-only, entity-specific inspection pages only. Future writes must be invariant-preserving per-entity workflows with audit logging.

## Current State

**Implemented:** Song search → lyric fetch → async batch (LLM segment+lemmatize + jisho options + sense-select + Gemini translation) → study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review (FSRS), decks, recent songs, user settings, push notifications (FCM admin SDK, batch cron 09:00·18:00 KST, deep-link to flashcard review from notification tap)

**Backend modularization:** Multi-module Gradle split (`common` + `domains/*` + `api` + `admin-api` + `batch`) 완료. dto/ 규칙 (Request/Response/Dto, 1-class-per-file) 적용. @Scheduled는 batch에만. notification 모듈은 FCM 전송 책임만, DB 조회는 batch가 담당하고 `PushNotificationDataPort`로 추상화.

**Admin surface:** `backend/admin-api` exposes `/admin/api/auth/login`, `/admin/api/songs`, `/admin/api/lyrics`, `/admin/api/song-analysis-works`, and `/admin/api/users`. `admin-web` is a Vite React TypeScript shadcn-style SPA. Lyrics pages do not expose work status; status/timing inspection lives under Song Analysis Work. Local dev: `cd admin-web && npm run dev`; local k3s: `./deploy.sh <namespace>` then use `http://localhost/<namespace>/admin` through the dev ingress. Port-forward `svc/admin-api 8081:8081` only for direct API checks. See `docs/admin-service.md`.

**Partial coverage:** Backend integration tests for new domains; broader e2e tests still pending

## Conventions

- Backend: 도메인 기반 멀티모듈 (위 [Backend Module Structure](#backend-module-structure) 참고). 패키지는 `com.japanese.vocabulary.<domain>` (e.g. `auth`, `song`, `word`, `flashcard`, `deck`, `user`, `studystats`, `notification`). Music provider clients live in function-specific `integrations:*` modules and use `RestClient` where behavior is equivalent.
- DB migrations: `backend/migration/src/main/resources/db/migration/`. 새 테이블은 여기에 V_숫자 SQL로 추가. 도메인 모듈의 JPA `@Entity`와 migration이 일치해야 함.
- App: Zustand stores (도메인별), Axios with auth interceptor, `StyleSheet.create()` co-located with components

### Frontend Performance Rules

- **Zustand 셀렉터 필수**: `useStore()` 금지. 반드시 `useShallow` 또는 개별 셀렉터 사용
- **React.memo**: 리스트 아이템, 반복 렌더링되는 컴포넌트에 적용
- **useCallback**: 자식 컴포넌트에 전달하는 이벤트 핸들러에 적용
- **인라인 함수 금지**: `renderItem` 안에서 인라인 콜백 대신, 자식 컴포넌트가 prop으로 받아 내부에서 호출
- **useMemo**: 비용이 있는 렌더 경로 계산에 적용

## Pencil (.pen) 파일 편집 규칙

- **워크트리 경로 확인 필수**: `get_editor_state` 반환 경로가 현재 작업 디렉토리와 다를 수 있음. 작업 전 `open_document`로 현재 워크트리의 .pen 파일을 명시적으로 열 것.
- **대화형 작업 (MCP)**: `batch_design` 변경은 에디터 메모리에만 반영됨. 작업 완료 후 유저에게 에디터에서 저장(Ctrl+S)하라고 안내할 것.
- **자동화 (CLI)**: Pencil CLI `pencil interactive -i FILE -o FILE`로 headless 편집 + `save()`로 디스크 저장 가능. issue-resolver 등 GUI 없는 환경에서는 CLI를 사용할 것. `PENCIL_CLI_KEY` 환경변수 필요.

## Execution Rules

- Treat the sprint request as the source of truth for current priorities
- Do not expand scope unless explicitly requested
- Prefer simple end-to-end value over partial systems
- Surface missing decisions early
- When making changes that affect project structure, API contracts, DB schema, tech stack, or architecture decisions, update this CLAUDE.md
