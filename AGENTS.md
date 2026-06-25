# AGENTS.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song -> lyric-based study -> vocabulary capture -> flashcard review -> better understanding

## Quick Reference

### Build & Run

`gradlew`는 `backend/` 디렉토리에 위치. 반드시 `backend/`에서 실행할 것.

```bash
./deploy.sh                                   # k3s에 backend(api+batch+admin-api+admin-web) + mysql + redis 배포
cd backend && ./gradlew :admin-api:test       # Admin API tests
cd admin-web && npm run dev                   # Admin Web (local, http://localhost:5174)
cd app-rn && npx expo run:android             # App - Android
cd app-rn && npx expo start --web             # App - Web (dev)
```

### Detailed Docs

- Backend module boundaries: `docs/architecture/backend-modules.md`
- Song analysis and word-meaning pipeline: `docs/architecture/song-analysis.md`
- Push notification architecture: `docs/architecture/push-notification.md`
- Admin service: `docs/admin-service.md`
- Recommended songs: `docs/recommended-songs.md`
- k3s deploy and environment variables: `docs/runbooks/k3s-deploy.md`
- Pencil editing: `docs/runbooks/pencil-editing.md`

Directory-specific instructions live in nested `AGENTS.md` files. Each has a sibling `CLAUDE.md` that links to it with `@AGENTS.md`.

## Backend Module Structure

Multi-module Gradle (Kotlin DSL) at `backend/`. 항상 `backend/`에서 `./gradlew` 실행.

```text
backend/
├── common/                  — cross-cutting infra and test fixtures
├── migration/               — Flyway migrations
├── domains/                 — domain modules, no @SpringBootApplication
├── integrations/            — external music provider clients
├── api/                     — user REST bootstrap
├── admin-api/               — internal admin REST bootstrap
└── batch/                   — scheduled/background job bootstrap
```

### Core Rules

- **batch가 의존하는 도메인은 최소화**. 필요한 도메인만 추가한다.
- **api는 사용자 API에 필요한 도메인 의존**. translation은 batch 전용 유지.
- **admin-api는 public api와 분리된 bootstrap**. v1은 inspection 중심이며 music integration module을 의존하지 않는다.
- **active module은 자기 Spring surface를 AutoConfiguration으로 선언한다**. `AutoConfiguration.imports` + `com.japanese.autoconfigure.*`를 사용하고, module bean은 module package `@ComponentScan`, JPA는 `@EntityScan`/`@EnableJpaRepositories`로 등록한다.
- **도메인 모듈은 persistence-aware domain core로 수렴**. entity/model/enum, domain method/service, invariant/state transition 중심으로 유지한다.
- **외부 API client는 domain core가 아니다**. iTunes/YouTube/LRCLIB/VocaDB client는 function-specific `integrations:*` 모듈에 둔다.
- **cache 위치는 의미로 결정한다**. product/read-model cache는 behavior owner application module에 둔다.
- **Admin write는 raw field update 금지**. 향후 mutation은 entity별 domain method/service를 통해서만 수행한다.
- **Spring Batch Job/Step config, Scheduler, job worker service는 batch bootstrap 모듈에만 둔다**.
- **통합테스트는 bootstrap 모듈(api/batch/admin-api)에 둔다**. 도메인 모듈에 테스트용 `@SpringBootApplication`을 만들지 않는다.

## Naming Rules

- **`entity/`**: JPA `@Entity`. 도메인 모듈 내부 전용. cross-module로 넘기지 말 것.
- **`dto/`**: 모든 클래스가 `Request | Response | Dto` 셋 중 하나로 끝나야 함. 한 파일에 하나의 클래스.
- **`model/`**: 도메인 내부 common value type. dto도 entity도 아닌 것.
- Entity -> Dto 변환은 `fun XxxEntity.toDto(): XxxDto` extension.

## Domain Layer Boundaries

```text
Inner:  Song, Lyric              — 콘텐츠 원본
Middle: Word, SongWord, Flashcard — 사용자 학습 데이터
Outer:  Deck, DeckFlashcard       — 조직화 레이어
```

- 같은 계층 내: 서비스 간 직접 호출.
- 계층 경계를 넘을 때만 Spring Event 사용.
- 안쪽 계층이 바깥쪽 계층을 참조하면 안 됨.

### Spring Event Listeners

- `@TransactionalEventListener(phase = AFTER_COMMIT)` 안에서 DB 쓰기를 하려면 `@Transactional(propagation = REQUIRES_NEW)`를 같이 붙일 것.
- listener 직접 호출 테스트는 `AfterCommitListenerTest` 상속, setup은 `inTx { ... }`로 감쌀 것.
- 이벤트 발행 검증은 기존 base + `@RecordApplicationEvents`.

## Current State

**Implemented:** Song search -> lyric fetch -> async batch word-meaning analysis -> study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review, decks, recent songs, user settings, push notifications, admin inspection surface.

**Backend modularization:** Multi-module Gradle split 완료. dto 규칙 적용. `@Scheduled`는 batch에만. notification 모듈은 FCM 전송 책임만, DB 조회는 batch가 담당하고 `PushNotificationDataPort`로 추상화.

**Admin surface:** `backend/admin-api` exposes `/admin/api/auth/login`, `/admin/api/songs`, `/admin/api/lyrics`, `/admin/api/song-analysis-works`, and `/admin/api/users`. `admin-web` is a Vite React TypeScript shadcn-style SPA. See `docs/admin-service.md`.

**Partial coverage:** Backend integration tests for new domains; broader e2e tests still pending.

## Conventions

- Backend package root: `com.japanese.vocabulary.<domain>`. Music provider clients live in function-specific `integrations:*` modules and use `RestClient` where behavior is equivalent.
- DB migrations: `backend/migration/src/main/resources/db/migration/`. 새 테이블은 여기에 `V_숫자` SQL로 추가. 도메인 모듈의 JPA `@Entity`와 migration이 일치해야 함.
- App: Zustand stores by domain, Axios with auth interceptor, `StyleSheet.create()` co-located with components.

### Frontend Performance Rules

- **Zustand 셀렉터 필수**: `useStore()` 금지. 반드시 `useShallow` 또는 개별 셀렉터 사용.
- **React.memo**: 리스트 아이템, 반복 렌더링되는 컴포넌트에 적용.
- **useCallback**: 자식 컴포넌트에 전달하는 이벤트 핸들러에 적용.
- **인라인 함수 금지**: `renderItem` 안에서 인라인 콜백 대신, 자식 컴포넌트가 prop으로 받아 내부에서 호출.
- **useMemo**: 비용이 있는 렌더 경로 계산에 적용.

## Execution Rules

- Treat the sprint request as the source of truth for current priorities.
- Do not expand scope unless explicitly requested.
- Prefer simple end-to-end value over partial systems.
- Surface missing decisions early.
- When making changes that affect project structure, API contracts, DB schema, tech stack, or architecture decisions, update `AGENTS.md` or the relevant linked doc.
