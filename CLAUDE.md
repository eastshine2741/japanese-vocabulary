# CLAUDE.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song → lyric-based study → vocabulary capture → flashcard review → better understanding

## Quick Reference

### Build & Run

`gradlew`는 `backend/` 디렉토리에 위치. 반드시 `backend/`에서 실행할 것.

배포는 k3s 클러스터로 운영. 백엔드/DB는 `./deploy.sh`로 띄우고, 프론트엔드는 로컬에서 실행:

```bash
./deploy.sh                                   # k3s에 backend(api+batch) + mysql + redis 배포
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

### K8s Deploy (k3s)

```bash
./deploy.sh              # 현재 브랜치명으로 namespace 결정, 빌드+배포
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
│   ├── song/                — Song/Lyric entity + iTunes/YouTube/VocaDB/LRCLIB clients + LyricProcessingService (동기 단계). 저장 모델(AnalyzedLine/Token/PartOfSpeech)도 여기 (LyricEntity JSON + api study view가 사용)
│   ├── translation/         — 가사 분석+번역 파이프라인: KoreanLyricTranslationService + GeminiClient + JishoClient. **batch만 의존** (가사 번역 스케줄러만 사용). 형태소 분석은 LLM이 직접 수행(Kuromoji 폐기 2026-06) — analyzer/사전 의존성 없음. jisho 조회는 Redis 캐시(`JishoClient`)
│   ├── flashcard/           — word + flashcard packages merged (word ↔ flashcard cycle): WordEntity, FlashcardEntity, repositories, services, events
│   ├── deck/                — DeckEntity, DeckService, DeckEventListener
│   ├── studystats/          — DailyStudySummary, StreakCalculator (Spring Batch 잡 본체는 batch 모듈로 분리됨 — 도메인 모듈은 Job/Scheduler를 갖지 않음. 그래야 api가 studystats를 의존해도 spring-batch가 classpath에 안 올라와 startup 잡 자동실행이 안 생김)
│   └── notification/        — FCM 전송 + FirebaseConfig + NotificationLogEntity 만. Scheduler/조회 로직은 없음. 외부 데이터 접근은 `PushNotificationDataPort` 인터페이스로 추상화 (구현체는 `batch`)
├── api/                     — REST bootstrap (@SpringBootApplication). translation을 제외한 모든 도메인 모듈 의존. controller/ + per-domain dto/ (HTTP 입출력). @Scheduled 없음.
└── batch/                   — 스케줄 잡 bootstrap (@SpringBootApplication, @EnableScheduling). 필요한 도메인만 의존 (현재 song, translation, studystats, notification, user, flashcard). 모든 @Scheduled는 여기. KoreanLyricTranslationScheduler, FreezeConsumeScheduler 등.
```

### 모듈 의존성 원칙

- **batch가 의존하는 도메인은 최소화**. 필요한 도메인만 추가. JPA 엔티티 로드 비용 절감.
- **api는 모든 도메인 의존**. REST 표면이 전체 도메인을 노출하므로. **예외: translation** — 가사 번역 스케줄러(batch)만 사용하므로 batch 전용 유지. (Kuromoji 폐기 후 힙 비용 사유는 사라졌지만 api가 의존할 이유도 없음.)
- **Spring Batch Job/Step config·Scheduler·잡 워커 서비스는 batch bootstrap 모듈에만 둔다. 도메인 모듈에 두지 말 것** — 도메인 모듈에 `spring-boot-starter-batch`가 들어가면 그 모듈을 의존하는 api에도 spring-batch가 classpath에 올라와 `JobLauncherApplicationRunner`가 startup에 잡을 자동 실행한다 (`runDate parameter required` 류 에러). 잡은 batch가 스케줄러로만 트리거.
- **외부 API 클라이언트(`@Value`로 필수 키 주입)가 도메인 모듈에 있고 그 도메인을 batch가 의존하면, batch yml에도 해당 키를 (안 쓰면 빈 기본값 `${KEY:}`으로) 넣어야** placeholder 미해석 크래시를 피한다 (e.g. song의 `YoutubeClient` → batch에 `youtube.api-key`).
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

## Lyric Analysis Flow

동기 저장 + 비동기 배치 2단계.

1. **동기** (`LyricProcessingService`, song 도메인): LRCLIB/VocaDB에서 가사 fetch → songs + lyrics 저장 (status=PENDING) → 원본 가사 응답
2. **비동기 배치**: `KoreanLyricTranslationService.runPipeline()` (translation 도메인, suspend) — 확정 word-meaning 하네스(L3 + translation-grounded correction, Kuromoji 폐기) → analyzed_content 저장, status=COMPLETED. `KoreanLyricTranslationScheduler` (batch 모듈, `@Scheduled fixedRate=30s`)가 호출 트리거.

### word-meaning 파이프라인 (2026-06 확정, 전 단계 gemini-3.1-flash-lite)

번역(pro)과 병렬로 `seg→ground+meaning` 체인을 돌린 뒤, 번역 완료 후 correction을 1회 실행한다 (`(translation ∥ [seg→ground+meaning]) → correction`):

1. **segment+lemmatize** (`GeminiClient.segmentAndLemmatize`): 원문 한 줄 → `[{surface, dictionaryForm, reading}]`. LLM이 분절 + 사전형 환원(가능/사역/수동 파생 제거 → criterion #1 내재 해결). Kuromoji 대체.
2. **jisho grounding + meaning** (`JishoClient.lookupAll` + `GeminiClient.translateMeanings`): 고유 dictionaryForm을 jisho 조회(EN senses/POS/JLPT, exact-match, Redis 캐시 + 전역 Semaphore(3) + 429 백오프 + 실패 미캐시) → LLM이 품사 일관 한국어 뜻 생성.
3. **correction** (`GeminiClient.correctMeanings`): 완성된 번역(pro `koreanLyrics`)을 source-of-truth로 문맥 틀린 뜻 + 분절 오류 교정.
4. **assemble**: 교정 결과 → `Token`. charStart/charEnd는 surface 순차 indexOf로 재계산, POS는 jisho POS → `PartOfSpeech` enum 매핑(미스 시 OTHER), `Token.jlpt`는 jisho jlpt.

실패 시 retry (최대 3회), 초과 시 `FAILED`. retry/배치 정책은 `KoreanLyricTranslationScheduler`. 실험 코드: `gemini-playground/word-meaning-harness/`. 비용 ≈ $0.031/곡.

## Push Notification

- FCM 전송: `PushNotificationService` (notification 도메인). FirebaseAdmin SDK로 메시지 전송 + 실패 토큰 정리.
- 후보 조회: `PushNotificationQueryService` (batch 모듈). 여러 도메인 JPA repository (UserRepository, UserSettingsRepository, DeviceTokenRepository, FlashcardRepository, NotificationLogRepository)를 조합해 `PushNotificationDataPort.findCandidates()` 구현.
- 스케줄링: `PushNotificationScheduler` (batch 모듈, cron 09:00 / 18:00 KST). 후보 조회 → FCM 전송 → 로그 기록.

## Key Architecture Decisions

- **Song search**: iTunes API (Japan region) → YouTube API for MV URL
- **Decks**: per-song decks in DB; "all" deck is virtual
- **Auth**: stateless JWT, 30-day expiry, no refresh token

## Current State

**Implemented:** Song search → lyric fetch → async batch (LLM segment+lemmatize + jisho grounding + Gemini translation + correction) → study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review (FSRS), decks, recent songs, user settings, push notifications (FCM admin SDK, batch cron 09:00·18:00 KST, deep-link to flashcard review from notification tap)

**Backend modularization:** Multi-module Gradle split (`common` + `domains/*` + `api` + `batch`) 완료. dto/ 규칙 (Request/Response/Dto, 1-class-per-file) 적용. @Scheduled는 batch에만. notification 모듈은 FCM 전송 책임만, DB 조회는 batch가 담당하고 `PushNotificationDataPort`로 추상화.

**Partial coverage:** Backend integration tests for new domains; broader e2e tests still pending

## Conventions

- Backend: 도메인 기반 멀티모듈 (위 [Backend Module Structure](#backend-module-structure) 참고). 패키지는 `com.japanese.vocabulary.<domain>` (e.g. `auth`, `song`, `word`, `flashcard`, `deck`, `user`, `studystats`, `notification`). WebClient for external APIs.
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
