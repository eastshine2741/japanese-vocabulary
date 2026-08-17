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
- Word 스키마와 song 결합 해제: `docs/architecture/word-schema.md`
- Song analysis and word-meaning pipeline: `docs/architecture/song-analysis.md`
- Translation pipeline guardrails: `docs/translation-pipeline.md`
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
│   └── word/                — word + flashcard + deck. 학습 데이터 일체
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
Inner:  Song, Lyric              — 콘텐츠 원본 (domains:song)
Outer:  Word, Flashcard, Deck    — 사용자 학습 데이터 (domains:word)
```

- 같은 모듈 내: 서비스 간 직접 호출.
- 모듈 경계를 넘을 때만 Spring Event 사용.
- 안쪽 계층이 바깥쪽 계층을 참조하면 안 됨.
- **word 도메인 → song 도메인의 물리적 FK는 `decks.song_id` 하나뿐**. 곡과 단어를 매핑하는 테이블은 만들지 않는다. 예문의 `songId`/`lineIndex`는 `words.senses` JSON 안의 논리 참조다.

### word / flashcard / deck 수명주기

`domains:word` 의 주인은 word 다. 세 수명주기를 `WordService` 가 **한 트랜잭션 안에서** 소유한다.

- **flashcard 는 word 와 수명주기가 같다.** word 저장 시 만들고 삭제 시 지운다. flashcard 없는 word 는 존재할 수 없다.
- **deck 은 word 보다 오래 산다.** 담을 때 없으면 만들지만, 안의 word 가 모두 지워져도 deck 은 남고 deck 을 지워도 안의 word 는 남는다.
- **모든 word 는 전체 단어장(`is_default = 1`)에 연결된다.** 전체 단어장은 유저당 1개이고 삭제할 수 없다.

### Spring Event Listeners

- 모듈 경계를 넘는 부수효과에만 쓴다. 같은 모듈이면 서비스를 직접 부른다 — 이벤트로 감싸면 불변식을 커밋 단위로 지킬 수 없다.
- `@TransactionalEventListener(phase = AFTER_COMMIT)` 안에서 DB 쓰기를 하려면 `@Transactional(propagation = REQUIRES_NEW)`를 같이 붙일 것.
- FK 선행 정리처럼 publisher 커밋 전에 끝나야 하는 listener는 `AFTER_COMMIT`을 쓰지 말고 같은 트랜잭션의 `@EventListener` + `@Transactional(propagation = MANDATORY)`로 처리할 것.
- 진짜 커밋 경계가 필요한 테스트(AFTER_COMMIT 리스너, 롤백, 동시성)는 `AfterCommitListenerTest` 상속, setup은 `inTx { ... }`로 감쌀 것.
- 이벤트 발행 검증은 기존 base + `@RecordApplicationEvents`.

## Current State

**Implemented:** Song search -> lyric fetch -> async batch word-meaning analysis -> study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review, decks, recent songs, user settings, push notifications, admin inspection surface.

**Backend modularization:** Multi-module Gradle split 완료. dto 규칙 적용. `@Scheduled`는 batch에만. notification 모듈은 FCM 전송 책임만, DB 조회는 batch가 담당하고 `PushNotificationDataPort`로 추상화. 학습 데이터는 `domains:word` 한 모듈로 통합됐다 — `word`/`flashcard`/`deck` package 가 같은 모듈에 있고 `WordService` 가 셋의 수명주기를 한 트랜잭션에서 소유한다. word↔deck 사이 Spring Event 는 제거됐다.

**Word 스키마 (V29):** 단어는 뜻(sense) 단위다. `words.senses` JSON 이 `{meaning, partOfSpeech, jlpt, examples[]}` 배열을 들고 있고, 예문은 sense 당 최대 5개다. `song_words`·`deck_flashcards` 는 제거됐고 deck 멤버십은 `deck_word(deck_id, word_id)` 가 갖는다. SongDetail 담김 판정은 `words` 를 `UNIQUE(user_id, japanese_text)` 로 한 번 조회한 뒤 곡이 제시한 뜻이 **전부** 저장돼 있는지 메모리에서 비교한다(ALL 판정). `PUT /api/words/{id}` 는 `senses` 전체 replace 다. 곡 분석이 주는 뜻은 "사랑, 애정" 같은 쉼표 문자열 하나라서 담기 직전에 조각마다 sense 로 쪼갠다 — 이미 담긴 조각엔 예문만 붙고 처음 보는 조각만 새 sense 가 된다(`splitMeaningText`, 앱에도 같은 규칙이 있다). 설계 근거는 `docs/architecture/word-schema.md`.

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
