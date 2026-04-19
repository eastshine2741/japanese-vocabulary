# CLAUDE.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song → lyric-based study → vocabulary capture → flashcard review → better understanding

## Quick Reference

### Build & Run

`gradlew`는 `backend/` 디렉토리에 위치. 반드시 `backend/`에서 실행할 것.

```bash
docker-compose up -d                          # Database (required first)
cd backend && ./gradlew bootRun               # Backend (port 8080)
cd app-rn && npx expo run:android             # App - Android
cd app-rn && npx expo start --web             # App - Web (dev)
```

### Multi-worktree Frontend

`DEPLOY_NS` 환경변수로 Android 패키지명을 분리하여 같은 디바이스에 여러 브랜치 앱 공존 가능.

```bash
cd app-rn
DEPLOY_NS=issue-21 npx expo run:android      # com.anonymous.apprn.issue21 로 설치
```

- `DEPLOY_NS` 미설정 시 기본값 `main` → `com.anonymous.apprn.main`
- `app-rn/.env`의 `EXPO_PUBLIC_BACKEND_URL`도 해당 namespace 서버에 맞출 것
- `android/`는 gitignored — 각 워크트리에서 첫 빌드 시 자동 생성

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

Set in `.env` (loaded by docker-compose) and as shell env vars for backend:

| Variable | Purpose |
|---|---|
| `MYSQL_USER` / `MYSQL_PASSWORD` | MySQL credentials |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `JWT_SECRET` | JWT signing key (defaults to dev key) |

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

## Lyric Analysis Flow

동기 저장 + 비동기 배치 2단계.

1. **동기** (`LyricProcessingService`): LRCLIB/VocaDB에서 가사 fetch → songs + lyrics 저장 (status=PENDING) → 원본 가사 응답
2. **비동기 배치** (`KoreanLyricTranslationService`, 30초 폴링): PENDING 엔트리를 Kuromoji 형태소 분석 + Gemini 번역 → analyzed_content 저장, status=COMPLETED

실패 시 retry (최대 3회), 초과 시 `FAILED`.

## Key Architecture Decisions

- **Song search**: iTunes API (Japan region) → YouTube API for MV URL
- **Decks**: per-song decks in DB; "all" deck is virtual
- **Auth**: stateless JWT, 30-day expiry, no refresh token

## Current State

**Implemented:** Song search → lyric fetch → async batch (Kuromoji+Gemini) → study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review (FSRS), decks, recent songs, user settings

**Not yet implemented:** Tests

## Conventions

- Backend: 도메인 기반 패키지 (`auth / song / word / flashcard / deck / user`), WebClient for external APIs
- DB migrations: `backend/migration/src/main/resources/db/migration/`
- App: Zustand stores (도메인별), Axios with auth interceptor, `StyleSheet.create()` co-located with components

### Frontend Performance Rules

- **Zustand 셀렉터 필수**: `useStore()` 금지. 반드시 `useShallow` 또는 개별 셀렉터 사용
- **React.memo**: 리스트 아이템, 반복 렌더링되는 컴포넌트에 적용
- **useCallback**: 자식 컴포넌트에 전달하는 이벤트 핸들러에 적용
- **인라인 함수 금지**: `renderItem` 안에서 인라인 콜백 대신, 자식 컴포넌트가 prop으로 받아 내부에서 호출
- **useMemo**: 비용이 있는 렌더 경로 계산에 적용

## Execution Rules

- Treat the sprint request as the source of truth for current priorities
- Do not expand scope unless explicitly requested
- Prefer simple end-to-end value over partial systems
- Surface missing decisions early
- When making changes that affect project structure, API contracts, DB schema, tech stack, or architecture decisions, update this CLAUDE.md
