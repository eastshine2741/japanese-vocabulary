# CLAUDE.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song → lyric-based study → vocabulary capture → flashcard review → better understanding

## Quick Reference

### Build & Run

```bash
docker-compose up -d                          # Database (required first)
cd backend && ./gradlew bootRun               # Backend (port 8080)
cd app-rn && npx expo run:android             # App - Android
cd app-rn && npx expo start --web             # App - Web (dev)
```

### Environment Variables

Set in `.env` (loaded by docker-compose) and as shell env vars for backend:

| Variable | Purpose |
|---|---|
| `DB_USERNAME` / `DB_PASSWORD` | MySQL credentials |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `JWT_SECRET` | JWT signing key (defaults to dev key) |
| `SUDACHI_DICT_PATH` | Path to Sudachi `system_core.dic` (defaults to classpath `sudachi/`) |

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Kotlin 1.9.22, Spring Boot 3.4.3, JVM 17 |
| App | React Native 0.83, Expo 55, TypeScript 5.9, Zustand 5 |
| Database | MySQL 8.4, Flyway migrations, Redis (recent songs) |
| NLP | Sudachi 0.7.5 (primary), Kuromoji 9.12.0 (fallback) |
| Auth | JWT (JJWT 0.12.3), Spring Security |

## Database Schema

Migrations in `backend/src/main/resources/db/migration/`.

```sql
songs     (id, title, artist, duration_seconds, youtube_url, artwork_url, created_at)
           UNIQUE(artist, title)

lyrics    (id, song_id FK→songs UNIQUE, lyric_type ENUM('SYNCED','PLAIN'),
           raw_content JSON, analyzed_content JSON,
           status ENUM('PENDING','PROCESSING','COMPLETED','FAILED'),
           retry_count, lrclib_id, vocadb_id, created_at, updated_at)

users     (id, name UNIQUE, password, created_at)
user_settings (id, user_id FK→users UNIQUE, show_intervals BOOLEAN)

words     (id, user_id FK→users, japanese_text, reading, meanings JSON, created_at)
song_words (id, word_id FK→words, song_id FK→songs, lyric_line)

flashcards (id, word_id FK→words UNIQUE, due, stability, difficulty,
            state ENUM('NEW','LEARNING','REVIEW','RELEARNING'), last_review, ...)

decks     (id, user_id FK→users, song_id FK→songs, created_at) UNIQUE(user_id, song_id)
deck_flashcards (id, deck_id FK→decks, flashcard_id FK→flashcards) UNIQUE(deck_id, flashcard_id)
```

## Lyric Analysis Flow

동기 저장 + 비동기 배치 2단계.

### 1단계: `POST /api/songs/analyze` (동기, `LyricProcessingService`)

```
LRCLIB 가사 fetch (실패 시 VocaDB fallback) → LrcParser 파싱 →
songs에 메타데이터 저장 → lyrics에 raw_content + status=PENDING 저장 →
응답: studyUnits(원본 가사만, tokens 빈 리스트)
```

이미 DB에 있는 곡 → `lyrics.status`에 따라 분기:
- `COMPLETED` → `analyzed_content`에서 토큰 + 한국어 번역 포함 응답
- 그 외 → 원본 가사만 응답

### 2단계: 배치 (`KoreanLyricTranslationService`, 30초 폴링)

```
PENDING/PROCESSING 엔트리 조회 (최대 5개) → 병렬 처리:
  1. raw_content에서 가사 라인 읽기
  2. Sudachi 형태소 분석 → 토큰(surface, baseForm, reading, POS, charStart, charEnd)
  3. Gemini 호출: 라인별 {text, words[{baseForm, pos}]} → 한국어 번역 + 발음 + 단어별 뜻
  4. Sudachi 토큰 + Gemini koreanText 병합 → AnalyzedLine[]
  5. lyrics.analyzed_content에 저장, status=COMPLETED
```

실패 시 retry (최대 3회), 초과 시 `FAILED`.

## Key Architecture Decisions

- **Song search**: iTunes API (Japan region) → YouTube API for MV URLs
- **Song data**: `songs`는 메타데이터만, 가사는 `lyrics` 테이블. (artist, title) 중복 방지
- **Word meanings**: `words.meanings` JSON 배열 `[{text, partOfSpeech}]`. 같은 단어 재저장 시 뜻 append (exact text match dedup)
- **JSON columns**: `LyricEntity`/`WordEntity`의 JSON 컬럼은 JPA `AttributeConverter`(`JsonListConverter`)로 자동 변환
- **Domain events**: word → `WordAddedEvent` → flashcard → `FlashcardCreatedEvent` → deck (동기 `@EventListener`)
- **Decks**: song-based flashcard grouping. Per-song decks in DB; "all" deck is virtual
- **Recent songs**: Redis SortedSet per user (max 16)
- **Auth**: stateless JWT, 30-day expiry, no refresh token

## Current State

**Implemented:** Song search → lyric fetch → async batch (Sudachi+Gemini) → study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review (FSRS), decks, recent songs, user settings

**Not yet implemented:** Tests

## Conventions

- Backend: 도메인 기반 패키지 (`auth / song / word / flashcard / deck / user`), WebClient for external APIs
- App: Zustand stores (도메인별), Axios with auth interceptor, `StyleSheet.create()` co-located with components

## Execution Rules

- Treat the sprint request as the source of truth for current priorities
- Do not expand scope unless explicitly requested
- Prefer simple end-to-end value over partial systems
- Surface missing decisions early
- When making changes that affect project structure, API contracts, DB schema, tech stack, or architecture decisions, update this CLAUDE.md
