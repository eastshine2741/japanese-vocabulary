# AGENTS.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song -> lyric-based study -> vocabulary capture -> flashcard review -> better understanding

## Quick Reference

### Build & Run

`gradlew`는 `backend/` 디렉토리에 위치. 반드시 `backend/`에서 실행할 것.

```bash
k8s/dev/bootstrap/apply.sh                    # 클러스터당 1회: cert-manager + RabbitMQ operator
./deploy.sh                                   # k3s에 backend(api+worker+batch cronjob+admin-api+admin-web) + mysql + redis + rabbitmq 배포
cd backend && ./gradlew :admin-api:test       # Admin API tests
cd backend && ./gradlew :worker:test          # 곡 분석 파이프라인 tests
cd admin-web && npm run dev                   # Admin Web (local, http://localhost:5174)
cd app-rn && npm test                         # App unit tests (vitest)
cd app-rn && npx expo run:android             # App - Android
cd app-rn && npx expo start --web             # App - Web (dev)
```

### Detailed Docs

- Feature development workflow (기획 -> 디자인 -> 개발 -> QA): `docs/workflow/feature-development.md`
- Backend module boundaries: `docs/architecture/backend-modules.md`
- Word 스키마와 song 결합 해제: `docs/architecture/word-schema.md`
- Song analysis and word-meaning pipeline: `docs/architecture/song-analysis.md`
- Translation pipeline guardrails: `docs/translation-pipeline.md`
- Push notification architecture: `docs/architecture/push-notification.md`
- Admin service: `docs/admin-service.md`
- Recommended songs: `docs/recommended-songs.md`
- k3s deploy and environment variables: `docs/runbooks/k3s-deploy.md`
- Analysis defect log and auto-fix runner: `.github/scripts/analysis-feedback/README.md`
- Mobile OTA release flow: `docs/runbooks/mobile-ota-release.md`
- Bottom sheet nested scroll: `docs/runbooks/bottom-sheet-nested-scroll.md`
- Pencil editing: `docs/runbooks/pencil-editing.md`

Directory-specific instructions live in nested `AGENTS.md` files. Each has a sibling `CLAUDE.md` that links to it with `@AGENTS.md`.

## Backend Rules

Multi-module Gradle (Kotlin DSL) lives at `backend/`. Always run `./gradlew`
from `backend/`.

- Application bootstraps stay split: `api` for user REST, `admin-api` for admin
  REST, `worker` for queue-driven work, `batch` for time-based CronJobs.
- `worker` 는 상주하며 RabbitMQ 를 듣는다. `batch` 는 상주하지 않고 `--task=<name>`
  하나를 실행하고 종료하며, 스케줄은 k8s CronJob 이 소유한다 (`@Scheduled` 금지).
- Domain and integration modules that provide beans own their AutoConfiguration.
- Put external provider clients in `integrations/*`; keep domain modules focused on
  persistence-aware domain state and invariants.
- `translation` is worker-only.
- DB migrations live in `backend/migration/src/main/resources/db/migration/`.
- Integration tests belong in bootstrap modules, not in domain modules with test
  `@SpringBootApplication` classes.
- 곡 분석 작업은 메시지 큐로 즉시 실행된다. 메시지는 `workId` 만 싣고 원장
  `song_analysis_work` 행이 진실 원천이다 — 중복 배달은 claim 이, 유실은 sweeper 가 흡수한다.
  한 곡에 활성 작업 하나는 `(raw_title, raw_artist)` 갭 락이 지키므로 REPEATABLE READ 가 전제다.
- RabbitMQ 브로커와 큐 토폴로지는 RabbitMQ 오퍼레이터의 CR 이 소유한다 (`k8s/{dev,prod}/rabbitmq/`).
  앱은 이름만 참조하고 `spring.rabbitmq.dynamic` 은 false 다.

For full module boundaries, naming rules, cache placement, and Spring event
rules, see `docs/architecture/backend-modules.md`.

## Domain Invariants

- `domains:word` owns word, flashcard, and deck lifecycle in one transaction.
- A word save creates/reuses its 1:1 flashcard and links the word to the default
  deck and, when applicable, the song deck.
- Deck membership is `deck_word`; deck deletion does not delete words.
- Word to song has only one physical FK: `decks.song_id`. Word examples keep
  `songId` / `lineIndex` only as logical references inside `words.senses`.

For the V29 schema and sense-level word behavior, see
`docs/architecture/word-schema.md`.

## Current State

**Implemented:** Song search -> lyric fetch -> async batch word-meaning analysis -> study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review, decks, recent songs, user settings, push notifications, admin inspection surface.

**Backend:** Multi-module Gradle split is complete. 곡 분석은 `worker` 가 RabbitMQ 메시지를
받아 즉시 처리하고, 시간 기반 정기 작업은 `batch` 이미지를 도는 k8s CronJob 이 맡는다. public API,
admin API, domain modules, integrations 는 분리 유지.
Module details live in `docs/architecture/backend-modules.md`.

**Word schema:** Words are stored as sense-level data in `words.senses`; deck
membership is `deck_word`; word/flashcard/deck lifecycle is owned by
`WordService` in one transaction. Details live in
`docs/architecture/word-schema.md`.

**Song detail words:** `GET /api/songs/{id}/words` returns `words` in song
appearance order. `lineWordIndexes[line]` is line-local appearance order. Use
`importanceScore` for major-word ranking.

**Word meaning pipeline:** Dictionary entries are `(headword, reading)` pairs;
one dictionary sense maps to one song-level `senseId`; token readings are
katakana and line readings are assembled by clients. Details live in
`docs/translation-pipeline.md`.

**VOC (개발자 괴롭히기):** 설정 탭 `문의` 섹션 -> `Voc` 화면. `POST /api/voc`
(`content` <= 1000자 + 편집 가능한 `email` + 앱이 채우는 os/osVersion/device/nativeVersion/jsVersion)가
`integrations:github`로 `type:voc` GitHub issue를 만든다. 유저 id/username은 서버가 DB에서 채우고,
이메일은 요청 값이 비면 DB 이메일로 대체하며, 제목은 첫 줄 80자, 환경은 Spring profile(`prod`면 prod, 아니면 dev). 토큰은
`GITHUB_VOC_TOKEN`; 비면 503. `GET /api/users/me`가 username/name/email을 돌려준다.
앱은 `expo-device`/`expo-application`을 쓰므로 새 네이티브 빌드가 필요하다.

**Streak commitment (260918):** `GET /api/study-stats/home`이 `studiedToday`/`hasStudiedBefore`를 내려주고,
`batch`의 `StreakReminderTask`가 20:00/23:00 KST CronJob 으로 `streak_reminder` 알림을 보낸다 (단어 회상 알림은 폐기).
freeze 행은 연속을 잇기만 하고 streak/총 학습일 카운트에는 들어가지 않는다.
스펙은 `docs/product-intents/260918-streak-commitment-api.md`.

**Admin surface:** `backend/admin-api` exposes `/admin/api/auth/login`, `/admin/api/songs`, `/admin/api/lyrics`, `/admin/api/song-analysis-works`, `/admin/api/users`, `/admin/api/users/{id}/words` (per-user decks/words/review state, read-only), and `/admin/api/push/send` (운영자 수동 푸시; 구 batch `/dev/push/send` 대체). `admin-web` is a Vite React TypeScript shadcn-style SPA. Dev 는 `/<namespace>/admin` 경로로, prod 는 `https://kotonoha.eastshine.dev/admin` (API 는 `/admin/api`) 한 호스트로 배포된다 — path 별 미들웨어가 필요해 Traefik `IngressRoute` 를 쓴다. See `docs/admin-service.md`.

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
