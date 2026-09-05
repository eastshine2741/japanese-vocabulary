# Mobile Renewal API Gap Notes

Source of truth for UI/interaction: `app-rn/japanese-vocabulary.pen`.
Frames inspected on 2026-09-05: Home `H0-H4`, Search `R3/R3a/R3b/R3c`, Profile `P2/P2a/P2c`, SongDetail `17/17a`, Study Session `shKUp/uQLfI/rSRxY/W9VzAD`.

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
| SongDetail | `GET /api/songs/{id}/words` | Candidate words, word summary, line word indexes (곡 등장순), save state. |
| SongDetail/Profile/Home | `GET /api/decks/by-song/{songId}` | Song deck existence, due count, mastered/studying/new counts for one song. |
| Profile/Home | `GET /api/decks?cursor=` | Song deck summaries with word/due/mastered counts, created-at order only. |
| Profile/Home | `GET /api/flashcards/stats` | Global total/due/new/learning/review counts. |
| Study session | `GET /api/flashcards/due?deckId=` | Due/new cards for all decks (`deckId` omitted) or one deck. **Card order is unspecified — see gap #2.** |
| Study session | `POST /api/flashcards/{id}/review` | FSRS rating persistence. |
| Profile/Home | `GET /api/study-stats/home`, `GET /api/study-stats/profile`, `GET /api/study-stats/heatmap` | Streak, freeze, activity, daily goal. |

## Missing Or Incomplete APIs

### 1. Study Session — 홈 전용이 아니라 진입점이 둘인 하나의 리소스

Pencil frames: `shKUp`(S1 앞면), `uQLfI`(S2 뒷면·rating), `rSRxY`(S3 이 곡 완주), `W9VzAD`(S0 규칙). S0 원문:

> SongDetail 단어 탭 → 곡 진입 복습. 카드·전환·rating은 홈 카드 스택과 완전히 같고, 홈의 흰 크롬 대신 카드 위에 얹는 오버레이만 다르다. 카드: component/homeWordFront · homeWordBack 그대로 재사용.

이전 초안은 이 세션을 "홈 스터디 스택"으로만 이름 붙였다(`GET /api/home/study-stack`, `POST /api/home/recommended-learning`) 하지만 실제로는 **홈의 "알아서 골라줘"와 SongDetail의 "이 곡 학습하기"가 같은 카드·전환·rating 세션을 여는 두 진입점**이다. SongDetail 쪽 세션 시작은 기존 초안에서 별도로 `POST /api/songs/{songId}/learning-session`이라는 세 번째 API로 잘못 쪼개져 있었다 — 하나로 합친다.

Backend gap — 세션 열기/생성 하나로 통합:

```http
GET  /api/study/session?source=auto|deck&deckId=&startWordId=&limit=
POST /api/study/session
Body: ({ source: 'deck', deckId: number }
    | { source: 'song', songId: number }
    | { source: 'recommendation', recommendationId: number })
    & { addWord?: AddWordRequest, startWordId?: number }
```

- `GET`은 **이미 존재하는 덱**의 세션을 연다.
  - `source=auto`: 홈의 "알아서 골라줘" — due 많은 덱 우선으로 서버가 고른다.
  - `source=deck&deckId=`: 곡 진입(SongDetail, DeckDetail) — 특정 덱을 연다.
  - `startWordId`: 특정 단어를 큐 맨 앞에 놓는다(§2 참고). 값은 word id — 클라이언트는 flashcard id를 모르므로(아래 이유) word id 또는 japanese text로 요청하고 서버가 매핑한다.
- `POST`는 **덱이 아직 없는 진입**을 처리한다 — 추천곡 학습 시작, SongDetail "이 곡 학습하기". 덱을 만들거나(곡 덱이 이미 있으면 재사용) 그 위에서 `GET`과 같은 응답 모양을 준다. 이게 있어야 클라이언트가 SongDetail 후보를 `AddWordRequest[]`로 조립해 `POST /api/words/batch`를 먼저 부르고 응답의 개수만으로 flashcard id를 못 찾아 헤매는 절차를 안 밟는다(기존 초안의 `startFlashcardId` 근거는 여기로 이전 — 계속 유효하다).

Rough response (두 엔드포인트 공용, 타입 이름에서 `Home` 접두를 뺀다 — `HomeStudyCard`→`StudyCard`, `HomeStudyStackResponse`→`StudySessionResponse`):

```ts
type StudySessionResponse = {
  source: 'auto' | 'deck' | 'song' | 'recommendation';
  deckId: number;
  songId: number | null;
  cards: StudyCard[];
  completion: {
    completedSourceTitle: string | null;
    nextDue: null | { deckId: number; songId: number | null; title: string; artist: string | null; artworkUrl: string | null; dueCount: number };
  };
};
```

`StudyCard`는 flashcard id, word id, 일본어 텍스트, 읽기, sense별 뜻, POS/JLPT, interval 라벨, 표시용 가사 예문 한 개(곡/출처 메타 포함)를 담아야 한다. 현재 `FlashcardDto`(`backend/domains/word/src/main/kotlin/com/japanese/vocabulary/flashcard/dto/FlashcardDto.kt`)는 단어 필드는 대부분 있지만 source/deck progress 메타가 없다.

**홈 전용 데이터는 세션 응답에서 분리한다** — streak, 추천곡 넛지 등은 세션 리소스가 아니라 홈 화면 전용 집계로 남긴다:

```http
GET /api/home/overview
```

(streak/freeze, 다음 due 곡 넛지, 추천곡 — 홈 화면 전용이라 이 이름은 맞다. 현재 `GET /api/study-stats/home` + `GET /api/songs/recommendations` + `GET /api/decks`로 프론트가 근사 조합할 수 있으니 급하지 않다.)

**단어 하나를 담으면서 그 단어부터 시작하는 진입**(확정된 인터랙션): SongDetail의 단어 row/카드를 누르면 담긴 단어는 그 단어부터 복습을 시작하고, 안 담긴 단어는 **즉시 담은 뒤** 그 단어부터 시작한다. 진입점은 세 곳 — 17(주요 단어 카드), 17a(단어 탭), 재생 중 가사 바텀시트(`OODLA`). 현재 클라이언트는 이걸 `POST /api/words` → `GET /api/decks/by-song/{songId}` → `GET /api/flashcards/due?deckId=` → 클라이언트 재정렬, 네 번의 왕복으로 만든다. `POST /api/study/session`이 `addWord`(없으면 저장)와 `startWordId`(큐 첫 카드)를 함께 받으면 한 번에 끝난다. 새로 만든 flashcard는 `FlashcardEntity` 생성 시 `due = now`라 곧바로 due 큐에 들어오므로(실측 확인) 서버가 첫 카드로 세우는 데 제약이 없다.

Open decision: "last home source"(어느 덱을 이어서 보여줄지)가 client-local state인지 server state인지. 당분간 client-local로 mock.

### 2. 복습 큐 정렬 — 곡 진입 복습이 요구하는 순서를 현재 API로 못 만든다

S0 규칙 원문: "큐: 그 곡의 복습 대상 단어. **탭한 단어가 1번이고 나머지는 곡 등장순.**"

실측: `backend/domains/word/src/main/kotlin/com/japanese/vocabulary/flashcard/service/FlashcardService.kt:128`

```kotlin
return DueFlashcardsDto(items = cards.shuffled(), totalCount = cards.size)
```

`assembleDueFlashcards`가 `GET /api/flashcards/due?deckId=`와 deck-scoped 조회(`DeckService.getDueFlashcards` → `FlashcardService.getDueFlashcardsByIds`, `backend/domains/word/src/main/kotlin/com/japanese/vocabulary/deck/service/DeckService.kt:52`) 양쪽에서 공유하는 조립 함수다 — **진입 경로와 무관하게 카드는 항상 랜덤 셔플로 나간다.** 즉 현행 API로는 "탭한 단어 1번, 나머지 곡 등장순"이라는 디자인 요구를 서버가 만들어줄 방법이 없다. 이건 §1의 `GET/POST /api/study/session`이 `startWordId` + 정렬을 지원해야 하는 이유이기도 하다.

Frontend mitigation (임시): `GET /api/songs/{id}/words`의 `words`는 곡 등장순이므로, `GET /api/flashcards/due?deckId=`가 준 카드 집합을 이 순서로 클라이언트 재정렬하고 `startWordId`에 해당하는 카드를 앞으로 옮긴다. 정식 정렬은 서버 쪽 gap.

### 3. Search Discovery

Pencil frames: `B55hp`, `KCNVA`, `QqTFy`, `Bk7Ai`.

Existing APIs cover direct search, result loading, analysis, recent songs, and recommended songs. Recent search terms are currently local via `searchHistoryStore` (서버에도 `GET /api/search-history`가 있다, `backend/api/src/main/kotlin/com/japanese/vocabulary/song/controller/SearchHistoryController.kt`).

Backend gap, optional but likely — 집계용 endpoint, 신규 필드는 `trendingTerms` 하나뿐(백엔드 어디에도 trending 개념 없음, 실측 확인):

```http
GET /api/search/discovery
```

```ts
type SearchDiscoveryResponse = {
  recommendedSongs: RecommendedSongItem[];
  trendingTerms: string[];
  recentSongs: RecentSongItem[];
};
```

Frontend can mock `trendingTerms` and keep using current separate APIs (`GET /api/songs/recommendations`, `GET /api/songs/recent`).

### 4. Profile Learning Status And Song Progress

Pencil frames: `A4O85`, `TiQI1`, `t5nYdU`.

Existing APIs cover profile identity(`GET /api/users/me` 계열 — 실측: 별도 조회 GET은 없고 `PATCH /api/users/me`만 있다, `UserProfileController`), streak/freeze totals, heatmap, global flashcard stats, and a paginated deck list with basic counts.

Backend gap:

```http
GET /api/users/me/learning-summary
```

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

실측 확인: 현행 `GET /api/decks`(`DeckController.getDeckList`)는 생성일순 커서 페이지네이션 하나뿐 — `sort`/`q` 파라미터가 없다. 이 지적은 맞다. Frontend는 당분간 `GET /api/decks`로 전체 목록을 받아 클라이언트에서 정렬/검색하는 방식으로 mock한다.

### 5. SongDetail Learning Entry

Pencil frames: `l80Sjx`, `IRFkV`, `aeV88`, `OODLA`, `PFj2i`, `vWgfB`, `tcmP1`.

Existing APIs can render the overview, word tab, lyrics sheet, and basic analysis-pending state. `GET /api/decks/by-song/{songId}` gives enough for the three visible states: start before deck, due review, preparing. "이 곡 학습하기"/"곡 진입 복습 시작"/"단어 눌러서 그 단어부터 복습" 세 흐름 모두 §1의 `GET/POST /api/study/session`으로 통합됐다(예전 초안의 `POST /api/songs/{songId}/learning-session`는 폐기).

Backend gap (유지):

```http
POST /api/songs/{songId}/analysis-notifications
Body: { enabled: true }
```

```ts
type SongAnalysisNotificationResponse = {
  songId: number;
  subscribed: boolean;
};
```

Why: Pencil has an "analysis complete notification" action on the pending state. Current mobile API supports device token registration(`POST /api/users/me/device-tokens`), but not per-song/work completion subscription from SongDetail.

## 프론트 현황 (사실관계 정정)

- 곡 진입 복습(S1~S3)은 홈과 동일한 공용 카드 스택 컴포넌트로 구현하는 것이 목표다(§1). 큐 정렬(§2)과 focus 단어 우선은 서버 gap이 메워지기 전까지 당분간 **클라이언트 어댑터**가 처리한다.
- 구 `ReviewScreen`(`app-rn/src/screens/ReviewScreen.tsx`, `stores/reviewStore.ts` 기반)은 폐기 대상이 아니라 **DeckDetail(`DeckDetailScreen.tsx`)과 푸시 알림 진입(`services/pushNotifications.ts`)으로만 남는다.** 실측 시점 현재 `SongDetailScreen.tsx`가 여전히 `navigate('Review', { deckId })`로 구 화면에 들어가고 있다 — 이 진입을 공용 카드 스택 컴포넌트로 옮기는 작업이 이 문서 기준 아직 남아 있다. (`SpotlightHero.tsx`도 같은 호출을 갖고 있으나 이 컴포넌트는 어디에서도 import되지 않는 죽은 코드다 — `stores/spotlightStore.ts`도 마찬가지. 마이그레이션 대상이 아니라 정리 대상이다.)

## Mocking Direction For This Session

- Put missing-contract mocks in frontend-owned files only.
- Do not change backend controllers, DTOs, services, or migrations.
- Keep mock adapters shaped like the rough contracts above so replacing them with real API calls later is mechanical.
- Prefer current real APIs where data exists; use mock fields only for source/progress/trending/session-creation/queue-ordering gaps.
