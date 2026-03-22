# CLAUDE.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song → lyric-based study → vocabulary capture → flashcard review → better understanding

## Quick Reference

### Build & Run

```bash
# Database (required first)
docker-compose up -d

# Backend (port 8080)
cd backend && ./gradlew bootRun

# App - Android
cd app-rn && npx expo run:android

# App - iOS
cd app-rn && npx expo run:ios

# App - Web (dev)
cd app-rn && npx expo start --web
```

### Environment Variables

Set in `.env` (loaded by docker-compose) and as shell env vars for backend:

| Variable | Purpose |
|---|---|
| `DB_USERNAME` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `JWT_SECRET` | JWT signing key (defaults to dev key) |
| `SUDACHI_DICT_PATH` | Path to Sudachi `system_core.dic` (defaults to classpath `sudachi/`) |

App backend URL: configured in `app-rn/src/api/client.ts`.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Kotlin 1.9.22, Spring Boot 3.4.3, JVM 17 |
| App | React Native 0.83, Expo 55, TypeScript 5.9 |
| State (app) | Zustand 5 |
| Animation (app) | react-native-reanimated 4, react-native-gesture-handler 2 |
| HTTP (app) | Axios |
| Database | MySQL 8.4, Flyway migrations |
| Auth | JWT (JJWT 0.12.3), Spring Security, BCrypt |
| NLP | Sudachi 0.7.5 (primary), Kuromoji/Lucene 9.12.0 (fallback) for Japanese morphological analysis |

## Project Structure

### Backend — `com.japanese.vocabulary.<domain>/`

도메인 기반 패키지: `auth / song / word / flashcard / deck / user`
- 각 도메인: `controller`, `service`, `repository`, `entity`, `dto`, `client` 서브패키지
- `song/client/` — 외부 API 클라이언트 (lrclib, vocadb, itunes, youtube)
- `word/client/jisho/` — Jisho API 클라이언트

### App — `app-rn/src/`

```
screens/          화면 컴포넌트 (PlayerScreen, SearchScreen, ReviewScreen, ...)
screens/tabs/     탭 화면 (HomeTab, WordTab, MyPageTab)
components/       재사용 컴포넌트 (LyricLine, SeekBar, YouTubePlayer, WordAnalysisSheet, ...)
stores/           Zustand 상태 관리 (도메인별 분리: searchStore, vocabularyStore, ...)
api/              Axios HTTP 클라이언트 (도메인별: songApi, wordApi, flashcardApi, ...)
types/            TypeScript 인터페이스 (도메인별: song.ts, word.ts, flashcard.ts, ...)
navigation/       React Navigation 설정 (Stack + Bottom Tabs)
theme/            Colors, Dimens 상수
utils/            유틸리티
```

## Database Schema

Migrations in `backend/src/main/resources/db/migration/`. Flyway manages versioning.

```sql
songs     (id, title, artist, duration_seconds, lyric_type ENUM('SYNCED','PLAIN'),
           lyric_content JSON, vocabulary_content JSON, lrclib_id, youtube_url, artwork_url, created_at)
           UNIQUE(artist, title)

users     (id, name UNIQUE, password, created_at)

user_settings (id, user_id FK→users UNIQUE, show_intervals BOOLEAN)

words     (id, user_id FK→users, japanese_text, reading, korean_text, created_at)

song_words (id, word_id FK→words, song_id FK→songs, lyric_line)

flashcards (id, word_id FK→words UNIQUE, due DATE, stability DOUBLE, difficulty DOUBLE,
            elapsed_days INT, scheduled_days INT, reps INT, lapses INT,
            state ENUM('NEW','LEARNING','REVIEW','RELEARNING'), last_review DATE)

decks     (id, user_id FK→users, song_id FK→songs, created_at)
           UNIQUE(user_id, song_id)

deck_flashcards (id, deck_id FK→decks, flashcard_id FK→flashcards)
                 UNIQUE(deck_id, flashcard_id)
```

## API Contracts

All endpoints except `/api/auth/*` require `Authorization: Bearer {token}`.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/auth/signup` | `{name, password}` | `{token}` |
| POST | `/api/auth/login` | `{name, password}` | `{token}` |
| GET | `/api/songs/search?q=&offset=&limit=` | - | `{items[], nextOffset}` |
| POST | `/api/songs/analyze` | `{title, artist, durationSeconds?}` | SongDTO |
| GET | `/api/songs/recent` | - | `[RecentSongItem]` |
| GET | `/api/songs/{id}` | - | SongDTO |
| GET | `/api/words/lookup?word=` | - | `{japanese, reading, meanings[], pos[], jlptLevel}` |
| POST | `/api/words` | `{japanese, reading, koreanText, songId, lyricLine}` | `{id}` |
| GET | `/api/words?cursor=` | - | `{words[], nextCursor}` |
| GET | `/api/flashcards/due?songId=` | - | `{flashcards[], totalDue}` |
| POST | `/api/flashcards/{id}/review` | `{rating}` | `{nextReview, stability, difficulty}` |
| GET | `/api/flashcards/stats` | - | `{totalCards, dueToday, ...}` |
| GET | `/api/decks` | - | `{allDeck, songDecks[]}` |
| GET | `/api/decks/all` | - | DeckDetailResponse |
| GET | `/api/decks/{songId}` | - | DeckDetailResponse |
| GET | `/api/decks/all/words?cursor=` | - | `{words[], nextCursor}` |
| GET | `/api/decks/{songId}/words?cursor=` | - | `{words[], nextCursor}` |
| GET | `/api/settings` | - | UserSettingsDTO |
| PUT | `/api/settings` | UserSettingsDTO | UserSettingsDTO |

## Key Architecture Decisions

- **Lyrics pipeline**: LRCLIB (primary, synced timestamps) → VocaDB (fallback, plain text)
- **Song search**: iTunes API (Japan region) for metadata, YouTube API for MV URLs
- **Morphological analysis**: `MorphologicalAnalyzer` interface with Sudachi (`@Primary`, SplitMode.B, UniDic POS) and Kuromoji (fallback, IPADIC POS). Filters to 名詞/動詞/形容詞/形状詞. Sudachi dictionary (`system_core.dic`) configured via `SUDACHI_DICT_PATH` env var or classpath `sudachi/`
- **Pagination**: cursor-based for words, offset-based for song search
- **Song data**: lyrics and vocabulary stored as JSON columns, analyzed once, deduplicated by (artist, title)
- **Auth**: stateless JWT with 30-day expiry, no refresh token
- **Recent songs**: Redis SortedSet per user (max 16, score = timestamp)
- **Domain events**: word → `WordAddedEvent` → flashcard → `FlashcardCreatedEvent` → deck. Synchronous `@EventListener` within same transaction
- **Decks**: song-based flashcard grouping. Per-song decks in DB; "all" deck is virtual. Retrievability via FSRS formula
- **MV collapse animation**: `react-native-reanimated` + `react-native-gesture-handler` for UI-thread performance on Android

## Current State

**Implemented:**
- Song search (iTunes) → lyric analysis (LRCLIB/VocaDB + Sudachi) → study view
- YouTube MV playback with synced lyric highlighting, collapsible MV area
- Word tap → Jisho lookup → save to vocabulary (floating bottom sheet)
- User auth (signup/login with JWT)
- Vocabulary list with cursor pagination
- Flashcard review with FSRS spaced repetition
- Recent songs (Redis listen history, home grid)
- User settings (show_intervals toggle, retention slider)
- Decks: song-based flashcard grouping
- Spring Event-driven domain decoupling (word → flashcard → deck)

**Not yet implemented:**
- Tests (no test files exist)

## Conventions

- Backend package: `com.japanese.vocabulary`
- Backend uses WebClient (Spring WebFlux) for external API calls
- App navigation: React Navigation (NativeStack + BottomTabs) in `AppNavigator.tsx`
- App state: Zustand stores, one per domain (searchStore, vocabularyStore, reviewStore, ...)
- App HTTP: Axios with auth interceptor in `api/client.ts`
- App styling: `StyleSheet.create()` co-located with components, theme tokens in `theme/theme.ts`
- DTOs: domain-specific files in `types/`

## Execution Rules

- Treat the sprint request as the source of truth for current priorities
- Do not expand scope unless explicitly requested
- Prefer simple end-to-end value over partial systems
- Prefer clear contracts over clever abstractions
- Surface missing decisions early
- When making changes that affect project structure, API contracts, DB schema, tech stack, or architecture decisions, update this CLAUDE.md to reflect the new state
