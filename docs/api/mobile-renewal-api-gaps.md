# Mobile Renewal API Gap Notes

Source of truth for UI/interaction: `app-rn/japanese-vocabulary.pen`.
Frames inspected on 2026-09-05: Home `H0-H4`, Search `R3/R3a/R3b/R3c`, Profile `P2/P2a/P2c`, SongDetail `17/17a`.

This document is a planning note only. Backend endpoint design and implementation are out of scope for the current frontend session. Frontend work should mock missing APIs behind local adapters.

## Existing APIs That Can Be Reused

| Area | API | Use |
|---|---|---|
| Search | `GET /api/songs/search?q=` | Search result list. |
| Search | `POST /api/songs/analyze` and `GET /api/songs/analysis-work/{workId}` | Existing analyze/loading flow before opening SongDetail. |
| Search/Home | `GET /api/songs/recommendations` | Recommended song cards, but only basic song metadata. |
| Search/Home | `GET /api/songs/recent` | Recent listened/opened songs. |
| SongDetail | `GET /api/songs/{id}` | Song metadata and artwork. |
| SongDetail | `GET /api/songs/{id}/lyrics` | Lyrics, synced line data, token readings. |
| SongDetail | `GET /api/songs/{id}/words` | Candidate words, word summary, line word indexes, save state. |
| SongDetail/Profile/Home | `GET /api/decks/by-song/{songId}` | Song deck existence, due count, mastered/studying/new counts for one song. |
| Profile/Home | `GET /api/decks?cursor=` | Song deck summaries with word/due/mastered counts, current order only. |
| Profile/Home | `GET /api/flashcards/stats` | Global total/due/new/learning/review counts. |
| Home/Review | `GET /api/flashcards/due?deckId=` | Due/new cards for all decks or one deck. |
| Home/Review | `POST /api/flashcards/{id}/review` | FSRS rating persistence. |
| Profile/Home | `GET /api/study-stats/home`, `GET /api/study-stats/profile`, `GET /api/study-stats/heatmap` | Streak, freeze, activity, daily goal. |

## Missing Or Incomplete APIs

### 1. Home Study Stack

Pencil frames: `KDj82`, `l4G1UA`, `kZ5IP`, `u1yGW`, `XBg2O`, `cWe1s`.

Current APIs can approximate the first version by combining `GET /api/decks`, `GET /api/flashcards/due?deckId=`, `GET /api/flashcards/stats`, `GET /api/study-stats/home`, and `GET /api/songs/recommendations`. This is enough for a frontend mock.

Backend gap:

```http
GET /api/home/study-stack
```

Rough response:

```ts
type HomeStudyStackResponse = {
  streak: { currentStreak: number; freezeCount: number; freezeMax: number };
  source: null | {
    kind: 'deck';
    deckId: number;
    songId: number | null;
    title: string;
    artist: string | null;
    artworkUrl: string | null;
    reviewedInSession: number;
    totalInDeck: number;
    dueCount: number;
  };
  cards: HomeStudyCard[];
  completion: {
    completedSourceTitle: string | null;
    nextDue: null | HomeStudyStackResponse['source'];
    recommended: null | {
      recommendationId: number;
      songId: number;
      title: string;
      artist: string;
      artworkUrl: string | null;
      learnableWordCount: number;
    };
  };
};
```

`HomeStudyCard` should include flashcard id, word id, Japanese text, reading, sense meanings, POS/JLPT, interval labels, and one displayable lyric example with song/source metadata. Current `FlashcardDTO` has most word fields but not source/deck progress metadata.

Backend gap:

```http
POST /api/home/recommended-learning
Body: { recommendationId: number } or { songId: number }
```

Rough response: creates or reuses the song deck and returns a `HomeStudyStackResponse` for that deck. This avoids making the client batch-add raw `AddWordRequest[]` from SongDetail candidates.

Open decision: whether "last home source" is client-local state or server state. Mock it client-side for now.

### 2. Search Discovery

Pencil frames: `B55hp`, `KCNVA`, `QqTFy`, `Bk7Ai`.

Existing APIs cover direct search, result loading, analysis, recent songs, and recommended songs. Recent search terms are currently local via `searchHistoryStore`.

Backend gap, optional but likely:

```http
GET /api/search/discovery
```

Rough response:

```ts
type SearchDiscoveryResponse = {
  recommendedSongs: RecommendedSongItem[];
  trendingTerms: string[];
  recentSongs: RecentSongItem[];
};
```

This is mostly an aggregation/performance endpoint. Frontend can mock `trendingTerms` and keep using current separate APIs.

### 3. Profile Learning Status And Song Progress

Pencil frames: `A4O85`, `TiQI1`, `t5nYdU`.

Existing APIs cover profile identity, streak/freeze totals, heatmap, global flashcard stats, and a paginated deck list with basic counts.

Backend gap:

```http
GET /api/users/me/learning-summary
```

Rough response:

```ts
type LearningSummaryResponse = {
  profile: { name: string | null; username: string | null; avatarUrl: string | null };
  totals: { totalWords: number; mastered: number; learning: number; newWords: number };
  streak: { current: number; longest: number; totalStudyDays: number; freezeCount: number; freezeMax: number };
  dailyGoal: { target: number; todayReviewCount: number; status: 'not_started' | 'in_progress' | 'met' | 'broken' };
};
```

Backend gap:

```http
GET /api/users/me/song-progress?sort=due|recent|progress|title&q=&cursor=&limit=
```

Rough response:

```ts
type SongProgressListResponse = {
  items: Array<{
    deckId: number;
    songId: number;
    title: string;
    artist: string;
    artworkUrl: string | null;
    totalWords: number;
    dueCount: number;
    masteredCount: number;
    learningCount: number;
    newCount: number;
    completionRate: number;
    lastStudiedAt: string | null;
  }>;
  nextCursor: string | null;
};
```

Frontend can mock the sorted full-list screen from `GET /api/decks` for now, but current backend ordering is created-at only and does not support search or alternate sort.

### 4. SongDetail Learning Entry

Pencil frames: `l80Sjx`, `IRFkV`, `aeV88`, `OODLA`, `PFj2i`, `vWgfB`, `tcmP1`.

Existing APIs can render the overview, word tab, lyrics sheet, and basic analysis-pending state. `GET /api/decks/by-song/{songId}` gives enough for the three visible states: start before deck, due review, preparing.

Backend gap:

```http
POST /api/songs/{songId}/learning-session
Body: { mode: 'start' | 'review'; focusWord?: { japanese: string; reading?: string | null } }
```

Rough response:

```ts
type SongLearningSessionResponse = {
  deckId: number;
  cards: HomeStudyCard[];
  startFlashcardId: number | null;
};
```

Why: Pencil asks for "learn from this song" without exposing deck creation/bulk-save as a management step, and a major-word card should be able to open a flashcard session with that word first. Current `POST /api/words/batch` only returns counts, so the client cannot reliably map a selected candidate to a new flashcard id after deck creation.

Backend gap:

```http
POST /api/songs/{songId}/analysis-notifications
Body: { enabled: true }
```

Rough response:

```ts
type SongAnalysisNotificationResponse = {
  songId: number;
  subscribed: boolean;
};
```

Why: Pencil has an "analysis complete notification" action on the pending state. Current mobile API supports device token registration, but not per-song/work completion subscription from SongDetail.

## Mocking Direction For This Session

- Put missing-contract mocks in frontend-owned files only.
- Do not change backend controllers, DTOs, services, or migrations.
- Keep mock adapters shaped like the rough contracts above so replacing them with real API calls later is mechanical.
- Prefer current real APIs where data exists; use mock fields only for source/progress/trending/session creation gaps.
