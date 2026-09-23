# Song Word Tiers (학습 로드맵)

곡 상세 홈 탭의 **학습 로드맵**은 곡의 단어를 4단계(핵심 → 입문 → 기초 → 심화)로
나눠 유저의 학습 부담을 줄이는 기획이다. 원래 "학습 시작" 이 곡 단어 100개 이상을
한 번에 담던 것을 단계 단위로 바꾼다.

서버는 `GET /api/songs/{id}/word-tiers` 로 분류와 단계별 복습 상태를 준다.
분류는 `SongWordTierClassifier`(api 모듈), 상태 집계는 `SongWordTierService`.
앱은 `songApi.getWordTiers` 로 이 API 를 호출하고 `songDetailStore.tiers` 에 둔다.

관련 Pencil 프레임: `iYaw3`(학습 시작 전), `IRFkV`(오늘 복습) — `Bundle Roadmap`.

## 앱이 직접 못 하는 이유

앱이 아는 것은 단어별 `importanceScore`·`jlpt`·`isSavedForSong` 과 곡 단어장 합계
(`masteredCount`/`studyingCount`)뿐이다. 후렴 줄 판정과 뼈대 단어 목록은 서버에만 있고,
단어별 복습 상태는 어느 API 도 노출하지 않는다.

## API

### `GET /api/songs/{id}/word-tiers`

곡의 단어를 4단계로 분류하고 단계별 학습 상태를 함께 준다.

```jsonc
{
  "songId": 123,
  "tiers": [
    {
      "key": "CORE",        // CORE | STARTER | BASIC | ADVANCED
      "order": 1,            // 1..4 로드맵 순서
      "name": "핵심",
      "description": "이 곡 후렴에서 계속 나와요",
      "wordJapanese": ["胸", "戻る", "..."], // WordInSongItemDto.japanese 와 동일 키
      "totalCount": 10,
      "knownCount": 0,       // 이 단계 단어 중 mastered
      "learningCount": 0     // 이 단계 단어 중 studying
    }
    // STARTER, BASIC, ADVANCED ...
  ]
}
```

- `tiers` 는 항상 4개, `order` 오름차순.
- `wordJapanese` 는 `GET /api/songs/{id}/words` 의 `words[].japanese` 와 같은
  키여야 한다. 앱은 칩 표시에만 쓰고, 담기는 서버가 단계 키로 한다(아래 학습 진입).
- 단어가 없는 곡도 4단계를 빈 배열로 반환한다(분석 준비 중 곡은 홈 탭 자체가
  안 뜨므로 호출되지 않아도 된다). 곡·가사가 없으면 404.
- 실패해도 곡 상세는 열려야 한다 — 앱은 이 호출을 곡 로드와 분리해
  `catch → null` 로 처리한다.

### 분류 규칙

곡 밖 데이터(코퍼스 빈도)는 쓰지 않는다. 입문은 고정 목록, 기초는 JLPT 태그만 본다.
분류 대상은 "전체 담기" 와 같은 집합 — 기본 필터(`WordFilterDefaultsDto`: 명사·동사·
형용사·형용동사·부사, JLPT 미분류 포함)를 통과한 단어다. 대명사·접속사 등은 어느
단계에도 없다.

| 단계 | key | 기준 | 정렬 |
| --- | --- | --- | --- |
| 핵심 | `CORE` | 뼈대 단어가 아니면서 후렴 줄에 나오거나 두 줄 이상에 나오는 단어, 중요도 순 상위 10 | 중요도 |
| 입문 | `STARTER` | `CommonWords` 고정 목록(する·いる·こと·もう…). `WordCandidateGenerator` 가 감점하는 목록과 같다 | 등장순 |
| 기초 | `BASIC` | JLPT N5·N4 | 등장순 |
| 심화 | `ADVANCED` | 나머지 (N3 이하·미분류) | 등장순 |

- 핵심을 먼저 뽑고 남은 것을 입문 → 기초 → 심화 순으로 나눈다. 한 단어는 정확히 한 단계.
- 후렴 줄 = 공백을 뺀 텍스트가 두 번 이상 나오는 줄. 후렴 줄이 가사의 절반을 넘으면
  "후렴에 나온다" 가 변별력이 없어 등장 줄 수 → 중요도 순으로 뽑는다.
- jisho JLPT 는 쉬운 단어를 N1·미분류로 찍는 쪽으로만 틀리고(잔여 버킷) 어려운 단어를
  N5·N4 로 찍지는 않는다. 그래서 "N5·N4 면 기초" 는 안전하고, 새는 방향은 심화뿐이다.
  난이도 출처를 바꾸면(JEV 등) `SongWordTierClassifier` 의 기초 판정 한 곳만 바꾼다.
- prod 79곡 시뮬레이션(2026-09) 곡당 중앙값: 핵심 10 / 입문 12 / 기초 21 / 심화 39.
  심화는 p90 79, 최대 98 로 크다 — 사실상 "나머지 전부" 이며 학습 단위가 아니라 탐색용에
  가깝다.

### 단계별 학습 상태

`knownCount`/`learningCount` 는 서버가 단어별 flashcard 상태를 읽어 단계별로 집계한다.
판정은 `FlashcardStudyState`(mastered = FSRS REVIEW, studying = RELEARNING 또는 리뷰 이력
있는 LEARNING)로, 단어장 통계 SQL(`DeckRepository`)과 같다.

기준은 **유저의 단어**다 — 다른 곡에서 담아 익힌 단어도 이 곡에서 아는 단어로 센다.
그래서 단계 합계가 `decks/by-song` 의 곡 단어장 합계와 다를 수 있다.

## 학습 진입: `POST /api/songs/{id}/word-tiers/{key}/study`

단계의 학습하기는 **due·복습 상태와 무관하게 그 단계 단어 전부**를 카드로 연다.
곡 덱의 due 큐를 열면 다른 단계 단어가 섞이고, 이미 익힌 단어·아직 due 가 아닌 단어가 빠져
진행 바(`knownCount / totalCount`)와 카드 수가 어긋나기 때문이다.

```jsonc
{ "deckId": 45, "cards": [ /* FlashcardDto, 단계 순서 */ ], "totalCount": 12 }
```

- 서버가 그 단계 단어를 전부 `batchAddWords` 로 다시 담는다(upsert). 다른 곡에서 이미 담은
  단어도 이 곡 단어장에 연결된다. 뜻이 없는 단어는 카드가 될 수 없어 뺀다.
- 카드 순서는 단계 순서(핵심은 중요도, 나머지는 등장순). 빈 단계는 409 `NO_ELIGIBLE_WORDS`.
- 앱은 `SongReview` 에 `source.tierKey` 를 넘기고, 복습 스택이 이 응답 목록을 세션의 전부로
  쓴다 — 페이지 추가 로드나 due 재조회를 하지 않고 끝나면 완료 화면으로 간다.
- due 가 아닌 카드도 rating 은 그대로 FSRS 에 기록된다(조기 복습).
- `knownCount`/`learningCount` 는 곡 상세 복귀 시 재요청으로 갱신된다.

hero CTA(`학습 시작` / `오늘 복습 N개`)의 상태 판정은 기존 그대로다
(`isAnalysisPending`, `decks.by-song.dueCount`). CTA 는 로드맵의 현재 단계를
그대로 시작한다.
