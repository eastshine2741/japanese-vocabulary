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

```
backend/src/main/kotlin/com/japanese/vocabulary/
├── controller/          # REST endpoints
│   ├── AuthController   # POST /api/auth/signup, /login
│   ├── SongController   # POST /api/songs/analyze, GET /search
│   └── WordController   # GET /api/words/lookup, POST /api/words, GET /api/words
├── service/
│   ├── LyricProcessingService  # Orchestrates: fetch lyrics → parse → tokenize → save
│   ├── WordService             # Word lookup (Jisho) + CRUD with cursor pagination
│   └── MorphologicalAnalyzer   # Kuromoji tokenizer (nouns/verbs/adjectives only)
├── entity/              # JPA entities: User, Song, Word, SongWord
├── repository/          # Spring Data JPA repos
├── client/              # External API clients
│   ├── LrclibClient     # lrclib.net - synced/plain lyrics (primary)
│   ├── VocadbClient     # vocadb.net - Japanese lyrics (fallback)
│   ├── JishoClient      # jisho.org - word definitions + JLPT levels
│   ├── ItunesClient     # itunes.apple.com - song search (Japan region)
│   └── YoutubeClient    # YouTube Data API v3 - MV URL
├── parser/LrcParser     # Parses [MM:SS.CS] LRC timestamp format
├── auth/                # JwtUtil, JwtAuthFilter, AuthService
├── config/SecurityConfig
└── model/               # DTOs: SongDTO, StudyUnit, Token, VocabularyCandidate, etc.

app/src/
├── commonMain/kotlin/
│   ├── screen/          # Compose screens
│   │   ├── LoginScreen, HomeScreen, SearchScreen
│   │   ├── StudyScreen, SongResultScreen (YouTube + synced lyrics + word tap)
│   │   ├── VocabularyScreen (saved words, infinite scroll)
│   │   └── ReviewScreen (stub - not yet implemented)
│   ├── viewmodel/       # AuthViewModel, SearchViewModel, StudyViewModel, VocabularyViewModel
│   ├── network/         # AuthRepository, SongRepository, VocabularyRepository (Ktor + Bearer auth)
│   ├── model/Models.kt  # All shared DTOs (Kotlinx Serialization)
│   ├── navigation/      # Sealed class Screen for nav routing
│   └── player/          # expect/actual YouTubePlayer composable
├── androidMain/         # MainActivity, SharedPreferences TokenStorage, BuildConfig BackendUrl
└── iosMain/             # NSUserDefaults TokenStorage, hardcoded BackendUrl
```

## Database Schema

Migrations in `backend/src/main/resources/db/migration/`. Flyway manages versioning.

```sql
songs     (id, title, artist, duration_seconds, lyric_type ENUM('SYNCED','PLAIN'),
           lyric_content JSON, vocabulary_content JSON, lrclib_id, youtube_url, created_at)
           UNIQUE(artist, title)

users     (id, name UNIQUE, password, created_at)

words     (id, user_id FK→users, japanese_text, reading, korean_text, created_at)

song_words (id, word_id FK→words, song_id FK→songs, lyric_line)
```

## API Contracts

All endpoints except `/api/auth/*` require `Authorization: Bearer {token}`.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/auth/signup` | `{name, password}` | `{token}` |
| POST | `/api/auth/login` | `{name, password}` | `{token}` |
| GET | `/api/songs/search?q=&offset=&limit=` | - | `{items[], nextOffset}` |
| POST | `/api/songs/analyze` | `{title, artist, durationSeconds?}` | SongDTO (studyUnits + vocabularyCandidates) |
| GET | `/api/words/lookup?word=` | - | `{japanese, reading, meanings[], pos[], jlptLevel}` |
| POST | `/api/words` | `{japanese, reading, koreanText, songId, lyricLine}` | `{id}` |
| GET | `/api/words?cursor=` | - | `{words[], nextCursor}` (page size 20) |

## Key Architecture Decisions

- **Lyrics pipeline**: LRCLIB (primary, has synced timestamps) → VocaDB (fallback, plain text only)
- **Song search**: iTunes API (Japan region) for metadata, YouTube API for MV URLs
- **Morphological analysis**: Kuromoji tokenizes Japanese text, filters to nouns/verbs/adjectives only
- **Pagination**: cursor-based for words, offset-based for song search
- **Song data**: lyrics and vocabulary stored as JSON columns, analyzed once on first request, deduplicated by (artist, title)
- **Auth**: stateless JWT with 30-day expiry, no refresh token

## Current State

**Implemented:**
- Song search (iTunes) → lyric analysis (LRCLIB/VocaDB + Kuromoji) → study view
- YouTube MV playback with synced lyric highlighting
- Word tap → Jisho lookup → save to vocabulary
- User auth (signup/login with JWT)
- Vocabulary list with cursor pagination

**Not yet implemented:**
- Review screen (flashcard UI + spaced repetition scheduling) - currently a stub
- Tests (no test files exist)
- iOS YouTube player (stub)

## Conventions

- Backend package: `com.japanese.vocabulary`
- App namespace: `com.japanese.vocabulary.app`
- Backend uses WebClient (Spring WebFlux) for external API calls
- App uses Ktor with Kotlinx Serialization for networking
- Navigation: sealed class `Screen` with manual back stack in `App.kt`
- Platform abstractions: `expect`/`actual` for TokenStorage, BackendUrl, YouTubePlayer, BackHandler

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
