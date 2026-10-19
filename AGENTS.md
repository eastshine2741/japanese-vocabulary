# AGENTS.md

## Project Overview

Japanese learning app based on songs. Home is a flashcard stack; users review
due cards from songs they like. Lyrics (`SongDetail`) are the source view, and
tapping a word there starts a review from it. There is no explicit "save word"
action — rating a card saves its song as a deck.

**Core loop:** open home -> review flashcards -> come back tomorrow

## Quick Reference

### Build & Run

`gradlew`는 `backend/` 디렉토리에 위치. 반드시 `backend/`에서 실행할 것.

```bash
./deploy.sh                                   # k3s에 backend(api+worker+batch cronjob+admin-api+admin-web+landing-web) + mysql + redis + rabbitmq 배포
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
- 곡 상세 완곡까지 3단계·이해도(`GET /api/songs/{id}/word-tiers`, `/coverage`), 학습 세션 카드는 담지 않고 rating 때 한 장씩 담기(`words/review`): `docs/architecture/song-word-tiers.md`
- 아티스트 상세(`GET /api/artists/{id}`)·곡↔Apple Music 아티스트 잇기(`artist` 테이블, batch `artist-link`): `docs/architecture/artist-detail.md`
- 곡 상세 이해도·word tier 3단계 개편 기획 배경: `docs/product-intents/260925-song-detail-study-status-api.md`
- 오늘의 복습 스케줄(H6) `GET /api/study-schedule` — 1년 기억 단어 수 예보(매일 GOOD 복습 vs 쉼, FSRS 기억 확률 합): `docs/product-intents/261004-study-schedule-api.md`
- 보상 카드: 곡 카드는 등급마다 새로 발급·등급별 순번, 아티스트 카드는 한 장 강화·BRONZE 부터 팬 번호, 레벨·마스터·낡음(복습할 때가 된 단어 비율)·아티스트 등급 규칙과 프로필 카드|학습 탭, rating 때 달성·서명 때 발급(`domains:rewardcard`), 카드 공유 링크(서명 토큰 `/c/{token}`, share-web 카드 웹 화면, 앱 링크 검증 파일): `docs/product-intents/261010-reward-cards.md`
- 서비스 소개 랜딩(`kotonoha.eastshine.dev/`, 정적 HTML·SEO·스토어 링크, `landing-web/`): `docs/landing-web.md`
- Translation pipeline guardrails: `docs/translation-pipeline.md`
- Feature flag(시작·종료 시각 구간으로 켜짐, 롤아웃 없이 30초 내 반영): `docs/architecture/feature-flag.md`
- Push notification architecture: `docs/architecture/push-notification.md`
- Admin service: `docs/admin-service.md`
- KPI 와 측정 방법 (GA4/BigQuery): `docs/analytics.md`
- Recommended songs: `docs/recommended-songs.md`
- 노래방(TJ·금영) 일본 신곡 원장·연결·알림: `docs/karaoke-new-songs.md`
- k3s deploy and environment variables: `docs/runbooks/k3s-deploy.md`
- Prod infra as code (Hetzner servers/network, Cloudflare DNS; CSI/CCM-owned resources excluded): `infra/terraform/README.md`
- Analysis defect log and auto-fix runner: `.github/scripts/analysis-feedback/README.md`
- Mobile release (release/X.Y.Z 브랜치, OTA 가드, 스토어 심사 자동 제출): `docs/runbooks/mobile-ota-release.md`
- Bottom sheet nested scroll: `docs/runbooks/bottom-sheet-nested-scroll.md`
- iOS native Animated pitfalls: `docs/runbooks/ios-native-animated-pitfalls.md`
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
- 곡 분석 작업은 메시지 큐로 즉시 실행된다. 단계 하나가 메시지 하나(`workId`, `stage`)이고 원장
  `song_analysis_work` / `song_analysis_work_stage` 가 진실 원천이다 — 단계 산출물·실패 원인이 원장에
  남고, 중복 배달은 claim 이, 유실은 sweeper 가, 죽은 worker 는 재배달이 흡수한다. 오류로 메시지를
  다시 넣지 않는다(5분 예산 안의 HTTP 호출 단위 재시도만). 관리자는 실패한 단계부터 다시 돌릴 수 있다.
  곡·가사 행은 마지막 단계(`COMPLETE`)가 분석 결과와 함께 만들므로, 실패한 작업은 곡을 남기지 않는다.
  한 곡에 활성 작업 하나는 `(raw_title, raw_artist)` 갭 락이 지키므로 REPEATABLE READ 가 전제다.
- RabbitMQ 큐 토폴로지는 브로커가 부팅 때 읽는 `definitions.json` 이 소유한다
  (`k8s/{dev,prod}/rabbitmq/`). 앱은 이름만 참조하고 `spring.rabbitmq.dynamic` 은 false 다.
  고치면 브로커가 재시작해야 반영되고, 기존 큐의 arguments 변경은 조용히 무시된다.

For full module boundaries, naming rules, cache placement, and Spring event
rules, see `docs/architecture/backend-modules.md`.

## Domain Invariants

- `domains:word` owns word, flashcard, and deck lifecycle in one transaction.
- A word save creates/reuses its 1:1 flashcard and links the word to the default
  deck and, when applicable, the song deck.
- Deck membership is `deck_word`; deck deletion also deletes words that belong
  to no other non-default deck.
- Word to song has only one physical FK: `decks.song_id`. Word examples keep
  `songId` / `lineIndex` only as logical references inside `words.senses`.

For the V29 schema and sense-level word behavior, see
`docs/architecture/word-schema.md`.

## Current State

**Implemented:** Song search -> lyric fetch -> async batch word-meaning analysis -> study view, YouTube MV playback with synced lyrics, flashcard-first home stack, song auto-save via study bootstrap, flashcard review, decks, recent songs, user settings, push notifications, admin inspection surface.

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
katakana and line readings are assembled by clients. Sense-select runs on
TypeSafe Jev (`TYPESAFE_API_KEY`), the other LLM stages on Gemini. Details live in
`docs/translation-pipeline.md`.

**VOC (개발자 괴롭히기):** 설정 탭 `문의` 섹션 -> `Voc` 화면. `POST /api/voc`
(`content` <= 1000자 + 편집 가능한 `email` + 앱이 채우는 os/osVersion/device/nativeVersion/jsVersion)가
`integrations:github`로 `type:voc` GitHub issue를 만든다. 유저 id/username은 서버가 DB에서 채우고,
이메일은 요청 값이 비면 DB 이메일로 대체하며, 제목은 첫 줄 80자, 환경은 Spring profile(`prod`면 prod, 아니면 dev). 토큰은
`GITHUB_VOC_TOKEN`; 비면 503. `GET /api/users/me`가 username/name/email을 돌려준다.
앱은 `expo-device`/`expo-application`을 쓰므로 새 네이티브 빌드가 필요하다.

**Profile image:** 앱이 `POST /api/users/me/profile-image/upload-url` 로 받은 presigned URL 에 R2 로 직접 PUT 하고
`PUT /api/users/me/profile-image {key}` 로 확정한다. key 는 `avatars/{userId}/{uuid}.{ext}`, 확정 때 HEAD 로 5MB·타입을 검사하고
이전 객체는 지운다. 버킷은 `kotonoha-prod`/`kotonoha-dev`(dev 네임스페이스 공유) 이고 `infra/terraform` 이 만든다.
`OBJECT_STORAGE_*` 가 하나라도 비면 업로드 API 가 503.

**Streak commitment (260918):** `GET /api/study-stats/home`이 `studiedToday`/`hasStudiedBefore`를 내려주고,
`batch`의 `StreakReminderTask`가 20:00/23:00 KST CronJob 으로 `streak_reminder` 알림을 보낸다 (단어 회상 알림은 폐기). 두 슬롯 모두 Android data-only라 앱이 로컬 모듈 `modules/streak-notification`으로 제목·본문을 강조색으로 그리고, 23:00은 `expiresAt`까지 카운트다운을 붙인다(새 네이티브 빌드 필요). 제목은 `users.name`(NOT NULL, 기본 `사용자`)으로 부른다.
freeze 행은 연속을 잇기만 하고 streak/총 학습일 카운트에는 들어가지 않는다.
스펙은 `docs/product-intents/260918-streak-commitment-api.md`.
홈 헤더 연속 학습 칩 -> `Streak` 화면(히어로·통계·학습 달력). 달력은 `GET /api/study-stats/calendar`(달 단위 커서 페이지)로 첫 기록 달까지 넘긴다 (`/heatmap` 은 구클라·마이페이지용으로 유지):
`docs/product-intents/261004-streak-detail-screen.md`.
오늘 첫 rating 직후의 플로팅 배너는 폐기되고 전체 화면 축하로 바뀌었다:
`docs/product-intents/261004-streak-celebration-screen.md`.

**Karaoke new songs:** batch `karaoke-collect`(15:00 KST)가 TJ·금영 일본 신곡을 `karaoke_song`에 쌓고 → 분석을 요청하고 → 구독자에게 알린다. 분석 결과와 무관하게 보여주고, 분석된 곡만 `songId`가 있다. `GET /api/karaoke-songs/daily|monthly`. 앱은 검색 탭 디스커버리 섹션에서 `KaraokeNewSongs` 화면(날짜별·월별)으로 들어간다.

**Song report (분석 제보):** 유형 목록은 서버 enum `SongReportType` 이 소유한다(`GET /api/song-reports/types`).
`POST /api/songs/{id}/reports` 가 `song_reports` PENDING 행을 만들고, 관리자가 승인하면 같은 트랜잭션에서 곡·active 가사를
고치고 바꾼 내용을 `review_changes` 에만 남긴다(곡·가사 버전 없음). 승인 커밋 뒤 admin-api 가 제보자에게 `song_report_approved` 푸시를 보낸다(반려는 알림 없음). `GET /api/songs/{id}/contributors` 는 APPROVED 제보자.
앱 진입점은 가사 시트의 포커스 줄 깃발(줄·토큰)과 MV 바 깃발(영상) 둘이고, 기여자는 곡 상세 홈 탭 맨 아래 섹션이다.
기여자를 누르면 그 유저 프로필(`UserProfile`)이 뜬다 — 카드·학습 탭을 읽기 전용으로 `GET /api/users/{id}`·`/reward-cards`(서명한 카드만)·`/flashcard-stats`·`/decks`·`/study-stats/heatmap` 에서 받고, 나 자신이면 편집되는 내 프로필을 스택에 올린다.
어드민 흐름은 `docs/admin-service.md`.

**Admin surface:** `backend/admin-api` exposes `/admin/api/auth/login`, `/admin/api/songs`, `/admin/api/lyrics`, `/admin/api/song-analysis-works`, `/admin/api/users`, `/admin/api/users/{id}/words` (per-user decks/words/review state, read-only), `/admin/api/song-reports` (분석 제보 승인·반려), `/admin/api/feature-flags`, and `/admin/api/push/send` (운영자 수동 푸시; 구 batch `/dev/push/send` 대체). `admin-web` is a Vite React TypeScript shadcn-style SPA. Dev 는 `/<namespace>/admin` 경로로, prod 는 `https://kotonoha.eastshine.dev/admin` (API 는 `/admin/api`) 한 호스트로 배포된다 — path 별 미들웨어가 필요해 Traefik `IngressRoute` 를 쓴다. See `docs/admin-service.md`.

**Partial coverage:** Backend integration tests for new domains; broader e2e tests still pending.

## Conventions

- Backend package root: `com.japanese.vocabulary.<domain>`. Music provider clients live in function-specific `integrations:*` modules and use `RestClient` where behavior is equivalent.
- DB migrations: `backend/migration/src/main/resources/db/migration/`. 새 테이블은 여기에 `V_숫자` SQL로 추가. 도메인 모듈의 JPA `@Entity`와 migration이 일치해야 함.
- App: Zustand stores by domain, Axios with auth interceptor, `StyleSheet.create()` co-located with components.
- 주석: 코드가 이미 말하는 내용은 쓰지 않는다. 왜/제약/함정만 1줄(최대 2줄), 이슈 번호·경위·단계 설명 금지. 상세 규칙은 `.claude/skills/antislop-code/SKILL.md`.

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
