# Mobile Renewal API Gap Notes

Source of truth for UI/interaction: `app-rn/japanese-vocabulary.pen`.
Frames inspected on 2026-09-05: Home `H0-H4`, Search `R3/R3a/R3b/R3c`, Profile `P2/P2a/P2c`, SongDetail `17/17a`, Study Session `shKUp/uQLfI/rSRxY/W9VzAD`.

This document records the original renewal API requirements. Integration status (2026-09-05):

- The renewed Home/SongReview card stack now uses `GET /api/flashcards/due?deckId=&limit=20`, preserves server order, and reads `totalCount`/`nextDueAt`. It refetches after each successful review, at future due times, and on app/screen resume; active screens also check periodically.
- SongDetail now persists analysis notification subscriptions through `POST /api/songs/{songId}/analysis-notifications`; failed requests do not change the subscription display.
- Deck progress and search discovery already use real resource APIs.
- `GET /api/users/me` was intentionally dropped. Keep displaying the username/name from the existing auth profile storage. No new profile read endpoint is required.

The gap descriptions below preserve the original planning context; the integration status above supersedes their mock instructions.

## Direction

- API는 화면 단위로 만들지 않는다. `deck`, `flashcard`, `word`, `song`, `study-stats`, `recommendation` 같은 리소스 단위 API를 유지하고, 프론트가 독립 리소스를 병렬 요청해서 조합한다.
- 홈, 검색 discovery, 프로필 요약, song progress 같은 화면 이름을 API 이름으로 올리지 않는다. 필요한 데이터가 여러 리소스에 흩어져 있으면 프론트 composition으로 처리한다.
- 쓰기 흐름은 의존성이 있으면 순차 실행한다. 예: 단어 저장이 먼저 필요하면 `POST /api/words` 또는 `POST /api/words/batch` 후 deck/flashcard 리소스를 다시 조회한다.
- 이 문서는 “현재 API로 부족한 리소스 필드/정렬/페이지네이션”만 gap으로 기록한다.

## Existing APIs That Can Be Reused

| Resource | API | Use |
|---|---|---|
| Song | `GET /api/songs/search?q=` | Search result list. |
| Song | `POST /api/songs/analyze`, `GET /api/songs/analysis-work/{workId}` | Existing analyze/loading flow before opening SongDetail. |
| Recommendation | `GET /api/songs/recommendations` | Recommended song cards. |
| Song | `GET /api/songs/recent` | Recent listened/opened songs. |
| Song | `GET /api/songs/{id}` | Song metadata and artwork. |
| Song | `GET /api/songs/{id}/lyrics` | Lyrics, synced line data, token readings. |
| Song | `GET /api/songs/{id}/words` | Candidate words, word summary, line word indexes in song occurrence order, save state. |
| Deck | `GET /api/decks` | Song deck summaries with word/due/mastered counts. Current order is created-at cursor pagination only. |
| Deck | `GET /api/decks/by-song/{songId}` | Song deck existence and deck-level counts for one song. |
| Deck | `GET /api/decks/{deckId}` | Deck detail with word/due/mastered/studying/new counts. |
| Deck | `GET /api/decks/{deckId}/words` | Words in one deck. |
| Word | `POST /api/words`, `POST /api/words/batch` | Save words. WordService creates/reuses the flashcard and links default/song decks in the same transaction. |
| Flashcard | `GET /api/flashcards/due?deckId=` | Current due-card query. Needs ordering and page size changes; see gap #1. |
| Flashcard | `POST /api/flashcards/{id}/review` | FSRS rating persistence. Response returns updated `due`, `state`, `stability`, and `difficulty`. |
| Flashcard | `GET /api/flashcards/stats` | Global total/due/new/learning/review counts. |
| Study stats | `GET /api/study-stats/home`, `GET /api/study-stats/profile`, `GET /api/study-stats/heatmap` | Streak, freeze, activity, daily goal data. |
| Search history | `GET /api/search-history` | Server-side recent search terms. |

## Missing Or Incomplete Resource APIs

### 1. Deck-Scoped Due Flashcards

Current API:

```http
GET /api/flashcards/due?deckId=
```

Current implementation loads every due card for the selected scope and shuffles the result in `FlashcardService.assembleDueFlashcards`. That shape is not enough for the renewed study flow.

Required change:

```http
GET /api/flashcards/due?deckId={deckId}&limit={n}
```

Contract requirements:

- `deckId` is the selected deck. Omitting `deckId` may keep the current virtual “all vocabulary” behavior, but song/deck study must use a concrete deck id.
- Return only cards whose `due <= server now`.
- Order by earliest due first. Use a deterministic tie-breaker such as `(due, id)`.
- Return at most `limit` cards, not every due card in the deck.
- Return `totalCount` for currently due cards if needed by UI counters.
- Optionally return `nextDueAt` for the earliest future card in the same deck when no due cards remain.

Why this replaces `study/session`:

- A session resource would couple API shape to the current card UI. The backend resource is flashcards due within a deck.
- Some cards can be scheduled again in less than 1 minute after a rating. The client must not assume a fetched batch is a complete, stable session.
- After `POST /api/flashcards/{id}/review`, refresh `GET /api/flashcards/due?deckId=&limit=` from the beginning. The same card may become due again and must not be excluded merely because it was already reviewed.
- Also refresh when the earliest known future `due` arrives, even if buffered cards remain. Use review responses and, when available, `nextDueAt` to schedule that refresh; check again when the app resumes.
- An empty page means no cards are due at that query time, not that every word is mastered or the deck is permanently complete. If future due timing is unknown, refresh periodically while study remains active.

Dropped from previous draft:

- No `GET /api/study/session`.
- No `POST /api/study/session`.
- No server-side `source=auto|deck|song|recommendation` session contract.
- No `startWordId` queue override that violates due-first ordering.

The earlier Pencil rule, "tapped word first, remaining words in song occurrence order", conflicts with this due-first requirement. This API contract follows the newer due-first decision; the corresponding UI interaction needs adjustment. Saving a tapped word still uses the word resource API and does not guarantee that its card is first or currently due.

### 2. Deck List For Song Progress

The screen named “song progress” is a deck list from the API perspective. Do not add:

```http
GET /api/users/me/song-progress
```

Use or extend:

```http
GET /api/decks?cursor=
```

Current implementation:

- `GET /api/decks` returns `songDecks` and `nextCursor`.
- Each item has `deckId`, `songId`, `title`, `artist`, `artworkUrl`, `wordCount`, `dueCount`, `masteredCount`, `studyingCount`, and `newWordCount`.
- `studyingCount`/`newWordCount` are real flashcard-state counts (same CASE-based derivation as `GET /api/decks/{deckId}`'s `DeckDetailResponse`), not an approximation from `dueCount`. `dueCount` keeps its separate meaning — "due for review today" — and is unrelated to `newWordCount`.
- Current server order is `createdAt` descending with cursor pagination.

P2a is a simple song-status list: it has no sort, search, or filter control. Keep the collection contract in created-at descending order; there is no current UI requirement for `sort`, `q`, or `limit` parameters.

Optional item fields such as `completionRate` and `lastStudiedAt` remain separate data requirements if a later UI introduces them; they do not imply list sorting or filtering.

### 3. User Profile Read

Current `UserProfileController` exposes profile update/delete operations, but no confirmed `GET /api/users/me` profile read endpoint in this branch.

Resource gap:

```http
GET /api/users/me
```

Use this only for the user profile resource: display name, username, avatar URL, and account fields that belong to the user. Do not fold study stats or deck progress into this endpoint; compose those from `study-stats`, `flashcards/stats`, and `decks`.

Dropped from previous draft:

- No `GET /api/users/me/learning-summary`.

### 4. Search Discovery Resources

Do not add a screen aggregate endpoint:

```http
GET /api/search/discovery
```

Compose the search screen from existing resources:

- `GET /api/songs/search?q=`
- `GET /api/songs/recommendations`
- `GET /api/songs/recent`
- `GET /api/search-history`

Trending terms are not a feature in the inspected UI. Do not add `GET /api/search/trending-terms`, and do not mock trending terms in the frontend.

### 5. Song Analysis Notification Subscription

Keep this as a resource gap because it is not a screen aggregate. It represents a user subscription to completion of one song analysis work.

```http
POST /api/songs/{songId}/analysis-notifications
Body: { "enabled": true }
```

Current mobile API supports device token registration, but not a per-song analysis-complete subscription from SongDetail pending state.

## Frontend Composition Notes

- Home can request deck list, flashcard stats, study stats, recommendations, and recent songs in parallel where needed.
- Do not add `GET /api/home/overview`. Existing `study-stats/home` and `study-stats/profile` are reused legacy endpoints, not a pattern for new screen aggregates; redesigning them is outside this note's scope.
- Search can request recommendations, recent songs, and search history in parallel.
- Profile can request user profile, study stats, flashcard stats, deck list, and heatmap as separate resources.
- SongDetail can request song metadata, lyrics, words, and deck-by-song independently after the song id is known.
- Study flow should request a deck-scoped due page, review cards one by one, then refetch the due head page instead of assuming an all-cards session snapshot.

## Mocking Direction For This Session

- Put missing-contract mocks in frontend-owned files only.
- Do not change backend controllers, DTOs, services, or migrations.
- Keep mock adapters shaped like the resource contracts above so replacing them with real API calls later is mechanical.
- Prefer current real APIs where data exists; use mock fields only for due pagination/sorting, user profile read, and analysis notification subscription gaps.
