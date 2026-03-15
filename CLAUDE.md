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
cd app && ./gradlew :app:installDebug

# App - iOS
cd app && ./gradlew :app:iosSimulatorArm64Binaries
```

### Environment Variables

Set in `.env` (loaded by docker-compose) and as shell env vars for backend:

| Variable | Purpose |
|---|---|
| `DB_USERNAME` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `JWT_SECRET` | JWT signing key (defaults to dev key) |

App backend URL: set `backend.baseUrl` in `app/local.properties` (default: `http://192.168.0.7:8080`).

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Kotlin 1.9.22, Spring Boot 3.4.3, JVM 17 |
| App | Kotlin 2.1.0, KMP, Compose Multiplatform 1.7.3 |
| Database | MySQL 8.4, Flyway migrations |
| HTTP client (app) | Ktor 3.0.3 (OkHttp on Android, Darwin on iOS) |
| Auth | JWT (JJWT 0.12.3), Spring Security, BCrypt |
| NLP | Kuromoji (Lucene 9.12.0) for Japanese morphological analysis |

## Project Structure

도메인 기반 패키지 구조. 백엔드와 앱 모두 `auth / song / word / flashcard / deck / user` 도메인으로 구성.

**Backend** `com.japanese.vocabulary.<domain>/`
- 각 도메인: `controller`, `service`, `repository`, `entity`, `dto`, `client` 서브패키지
- `song/client/` 하위에 외부 API 클라이언트 벤더별 분리 (lrclib, vocadb, itunes, youtube)
- `word/client/jisho/` — Jisho API 클라이언트

**App** `com.japanese.vocabulary.app.<domain>/`
- 각 도메인: `ui`, `viewmodel`, `repository`, `dto` 서브패키지
- `platform/` — `expect`/`actual` 구현체 (TokenStorage, BackendUrl, YouTubePlayer, BackHandler)
- `App.kt` — 네비게이션 (sealed class `Screen`, 수동 back stack)

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
| POST | `/api/songs/analyze` | `{title, artist, durationSeconds?}` | SongDTO (studyUnits + vocabularyCandidates) |
| GET | `/api/songs/recent` | - | `[RecentSongItem]` (최근 16개, Redis SortedSet) |
| GET | `/api/songs/{id}` | - | SongDTO |
| GET | `/api/words/lookup?word=` | - | `{japanese, reading, meanings[], pos[], jlptLevel}` |
| POST | `/api/words` | `{japanese, reading, koreanText, songId, lyricLine}` | `{id}` |
| GET | `/api/words?cursor=` | - | `{words[], nextCursor}` (page size 20) |
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

- **Lyrics pipeline**: LRCLIB (primary, has synced timestamps) → VocaDB (fallback, plain text only)
- **Song search**: iTunes API (Japan region) for metadata, YouTube API for MV URLs
- **Morphological analysis**: Kuromoji tokenizes Japanese text, filters to nouns/verbs/adjectives only
- **Pagination**: cursor-based for words, offset-based for song search
- **Song data**: lyrics and vocabulary stored as JSON columns, analyzed once on first request, deduplicated by (artist, title)
- **Auth**: stateless JWT with 30-day expiry, no refresh token
- **Recent songs**: Redis SortedSet으로 유저별 최근 청취 곡 최대 16개 관리 (score = timestamp)
- **Package structure**: domain-based (auth/song/word/flashcard/deck/user), both backend and app
- **Domain events**: word → `WordAddedEvent` → flashcard (creates card) → `FlashcardCreatedEvent` → deck (creates deck + mapping). Synchronous `@EventListener` within same transaction.
- **Decks**: Song-based grouping of flashcards. Per-song decks stored in DB; "all" deck is virtual (no DB row). Retrievability calculated via FSRS formula.

## Current State

**Implemented:**
- Song search (iTunes) → lyric analysis (LRCLIB/VocaDB + Kuromoji) → study view
- YouTube MV playback with synced lyric highlighting
- Word tap → Jisho lookup → save to vocabulary
- User auth (signup/login with JWT)
- Vocabulary list with cursor pagination
- Flashcard review with FSRS spaced repetition (ReviewScreen, SettingsScreen)
- Recent songs (Redis listen history, HomeScreen 썸네일 목록)
- User settings (show_intervals toggle)
- Decks: song-based flashcard grouping (DeckListScreen, DeckDetailScreen, DeckWordListScreen)
- Spring Event-driven domain decoupling (word → flashcard → deck)

**Not yet implemented:**
- Tests (no test files exist)
- iOS YouTube player (stub)

## Conventions

- Backend package: `com.japanese.vocabulary`
- App namespace: `com.japanese.vocabulary.app`
- Backend uses WebClient (Spring WebFlux) for external API calls
- App uses Ktor with Kotlinx Serialization for networking
- Navigation: sealed class `Screen` with manual back stack in `App.kt`
- Platform abstractions: `expect`/`actual` in `platform/` for TokenStorage, BackendUrl, YouTubePlayer, BackHandler
- DTOs: 도메인별 개별 파일 (구 `model/Models.kt` 제거)

## Working Model

This project uses Claude Code agent teams.

| Role | Responsibility |
|---|---|
| Lead Agent | Coordination and synthesis |
| Backend Agent | Server-side logic and interfaces |
| App Client Agent | User-facing flow and interaction |
| QA Agent | Validation and failure detection |

Agent prompts define roles only. Current work is defined by the sprint request. This file provides shared project context.

## Execution Rules

- Treat the sprint request as the source of truth for current priorities
- Do not expand scope unless explicitly requested
- Prefer simple end-to-end value over partial systems
- Prefer clear contracts over clever abstractions
- Surface missing decisions early
- When making changes that affect project structure, API contracts, DB schema, tech stack, or architecture decisions, update this CLAUDE.md to reflect the new state
