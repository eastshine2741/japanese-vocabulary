# AGENTS.md

## Project Overview

Japanese learning app based on songs. Lyrics (`SongDetail`) are the source view, and
tapping a word there starts a review from it. There is no explicit "save word"
action — rating a card saves its song as a deck.

**Core loop:** open home -> review flashcards -> come back tomorrow

제품 원칙 (코드에서 안 보이는 것):
- 홈은 기능 진입점 모음이 아니라 학습 카드 스택이다. 앱을 열면 첫 화면엔 늘 카드 한 장이 있다.
- 한 곡의 복습을 끝내면 완료 카드가 다음 곡을, 복습할 게 없으면 그 곡의 안 배운 단어를, 그것도 없으면 추천곡·새 곡 검색을 제안한다.
- 오늘 학습이 기록되는 단위는 카드 1장이다. 세션 길이·완료 여부와 무관하다.
- 보상 카드는 학습의 결과라 학습 데이터보다 앞세우지 않는다.
- 제품 결정의 이유는 그 결정을 구현한 코드 옆 주석에 둔다. 별도 기획·기능 문서는 두지 않는다.

## Build & Run

`gradlew`는 `backend/` 에 있다. 반드시 `backend/`에서 실행할 것.

```bash
./deploy.sh                                   # k3s에 backend(api+worker+batch cronjob+admin-api+admin-web+landing-web) + mysql + redis + rabbitmq 배포
cd backend && ./gradlew :admin-api:test       # Admin API tests
cd backend && ./gradlew :worker:test          # 곡 분석 파이프라인 tests
cd admin-web && npm run dev                   # Admin Web (local, http://localhost:5174)
cd app-rn && npm test                         # App unit tests (vitest)
cd app-rn && npx expo run:android             # App - Android
cd app-rn && npx expo start --web             # App - Web (dev)
```

## Where Things Are Documented

디렉토리별 규칙은 nested `AGENTS.md`(`backend/`, `backend/{api,admin-api,worker,batch,domains,integrations}/`, `app-rn/`, `admin-web/`)에 있고, 각각 옆의 `CLAUDE.md` 가 `@AGENTS.md` 로 잇는다.

- Backend 모듈 경계·bootstrap 분리(api/admin-api/worker/batch): `docs/architecture/backend-modules.md`
- Backend 테스트 작성법: `backend/TESTING.md`
- Word·flashcard·deck 수명주기와 스키마: `docs/architecture/word-schema.md`
- 곡 분석 작업 큐(원장·claim·sweeper·재시도 예산)·JLPT 출처: `docs/architecture/song-analysis.md`
- 단어 뜻 파이프라인 guardrails: `docs/translation-pipeline.md`
- 주요 단어 점수(`importanceScore`): `docs/architecture/major-word-scoring.md`
- 곡 상세 단어 tier·이해도, 학습 세션 카드: `docs/architecture/song-word-tiers.md`
- 가사 줄 시각을 MV 에 맞추기(로컬 PC 실행기 `lyric-sync-agent/`): `docs/architecture/lyric-mv-sync.md`
- 가사 MV 싱크로 드러난 곡 데이터 결함(MV·가사 오연결) 기록: `docs/lyric-mv-sync-defects.md`
- 아티스트 상세·Apple Music 아티스트 연결: `docs/architecture/artist-detail.md`
- Feature flag(시각 구간): `docs/architecture/feature-flag.md`
- 푸시 알림(연속 학습 알림 포함): `docs/architecture/push-notification.md`
- Admin 서비스(API 목록·분석 제보 승인·배포 경로): `docs/admin-service.md`
- 추천곡 / 노래방 신곡: `docs/recommended-songs.md`, `docs/karaoke-new-songs.md`
- 랜딩 페이지: `docs/landing-web.md`
- KPI·측정(GA4/BigQuery): `docs/analytics.md`
- k3s 배포·환경 변수·RabbitMQ 토폴로지: `docs/runbooks/k3s-deploy.md`
- Prod infra as code: `infra/terraform/README.md`
- 모바일 릴리스·OTA: `docs/runbooks/mobile-ota-release.md`
- 앱 UI 함정: `docs/runbooks/bottom-sheet-nested-scroll.md`, `docs/runbooks/ios-native-animated-pitfalls.md`
- Pen(.pen 디자인 파일) 편집: `docs/runbooks/pencil-editing.md`
- 분석 결함 로그·자동 수정 러너: `.github/scripts/analysis-feedback/README.md`
- 매일 아침 Discord 데일리 피드 러너(지표·골든패스·신기능·인프라·문의·러너 상태): `.github/scripts/daily-digest/README.md`

`docs/archive/` 는 끝난 계획·조사라 근거로 쓰지 않는다.

## Conventions

- 주석: 코드가 이미 말하는 내용은 쓰지 않는다. 왜/제약/함정만 1줄(최대 2줄), 이슈 번호·경위·단계 설명 금지. 상세 규칙은 `.claude/skills/antislop-code/SKILL.md`.
- 문서에는 코드에서 읽히는 내용(엔드포인트 목록, 필드 이름, 화면 흐름)을 옮겨 적지 않는다. 왜 그렇게 했는지와 바꾸면 깨지는 제약만 쓴다.

## Execution Rules

- Treat the sprint request as the source of truth for current priorities.
- Do not expand scope unless explicitly requested.
- Prefer simple end-to-end value over partial systems.
- Surface missing decisions early.
- 프로젝트 구조, API 계약, DB 스키마, 기술 스택, 아키텍처 결정을 바꾸면 관련 문서(위 목록 또는 nested `AGENTS.md`)를 함께 고친다. 이 파일에는 새 문서의 한 줄 링크만 더한다.
