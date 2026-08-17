# Word 스키마와 song 도메인 결합 해제

`song_words` 를 없애고 단어를 뜻(sense) 단위로 승격한 재설계의 근거 기록. 구현은 `V29__word_senses_and_deck_word.sql`.

## 목표

word 도메인이 song 도메인에 갖는 물리적 의존을 `decks.song_id` 하나로 줄이고, 곡과 단어를 매핑하는 테이블을 없앤다.

성공 기준 두 개가 설계를 강제했다.

1. 임의 곡의 N개 단어가 담겼는지를 인덱스를 타는 **단일 쿼리**로 판정한다.
2. 곡과 단어를 매핑하는 테이블이 존재하지 않는다.

## 스키마

### words

```sql
words(id, user_id, japanese_text VARCHAR(255), reading VARCHAR(255) NULL, senses JSON NOT NULL, created_at)
UNIQUE (user_id, japanese_text)
```

```json
[{ "meaning": "흐르다", "partOfSpeech": "동사", "jlpt": "N4",
   "examples": [{ "text": "川が流れる", "translation": "강이 흐른다", "songId": 12, "lineIndex": 7 }] }]
```

`jlpt`, `translation`, `songId`, `lineIndex` 는 nullable. `songId` + `lineIndex` 가 있으면 앱이 해당 곡의 그 가사 줄로 이동한다. 유저가 직접 넣은 예문은 둘 다 null.

**예문 상한은 sense 당 5개** (`WordService.MAX_EXAMPLES_PER_SENSE`). word 전체 기준이 아니라 sense 별로 센다 — word 기준으로 두면 먼저 담긴 sense 가 상한을 다 먹어 나중 sense 의 예문이 0개가 되고, 그건 "뜻마다 예문을 갖는다"는 목적과 정면으로 충돌한다.

### decks

```sql
decks(id, user_id, song_id BIGINT NULL, is_default BOOLEAN NULL, title, description, created_at)
UNIQUE (user_id, song_id)      -- 곡 deck 중복 방지
UNIQUE (user_id, is_default)   -- 전체 단어장 유저당 1개
FOREIGN KEY (song_id) REFERENCES songs(id)
```

| 조건 | 종류 |
|---|---|
| `is_default = 1` | 전체 단어장 |
| `song_id IS NOT NULL` | 곡 단어장 |
| 둘 다 아님 | 일반 단어장 |

`kind` enum 대신 두 컬럼 조합으로 도출한다. MySQL UNIQUE 가 NULL 중복을 허용한다는 점을 이용해, 전체 단어장이 유저당 하나임을 DB 가 강제하면서 일반 단어장은 여러 개 만들 수 있다.

### deck_word

```sql
deck_word(id, deck_id, word_id, UNIQUE(deck_id, word_id), INDEX(word_id), FK deck_id, FK word_id)
```

deck 멤버십의 유일한 소유자. `deck_flashcards` 를 대체한다.

### flashcards

스키마 변경 없음. `word_id UNIQUE` 유지. FSRS 상태(`stability`, `difficulty`, `state`, `due`, `fsrs_card_json`)만 기록하는 word 의 1:1 보조 테이블로 역할이 축소됐고, deck 멤버십과 완전히 분리됐다.

## 동작 규칙

### 단어 담기

1. `words` 에 `(user_id, japanese_text)` upsert — 기존 레코드면 **누락된 sense 만 append**. 같은 뜻이면 예문만 5개까지 덧붙인다.
2. `flashcards` 1:1 생성.
3. `WordSavedEvent(userId, wordId, songId?)` 발행 → deck 계층이 전체 단어장에 연결하고, `songId` 가 있으면 곡 deck 을 upsert 해서 거기에도 연결한다.

**두 연결은 서로 다른 트랜잭션이다.** `song_words` 가 사라지면서 `deck_word` 는 deck 구성의 유일한 기록이 됐다 — 예전엔 `deck_flashcards` 가 `song_words` 에서 재구성 가능한 파생 인덱스였지만(V10 이 실제로 그렇게 백필했다) 이제 재구성 경로가 없다. 그런데 이 쓰기는 커밋 이후에 도는 best-effort 리스너다. 곡 단어장 생성이 실패했다고 전체 단어장 연결까지 롤백하면 단어가 **어느 단어장에도 없는 상태로 영구히** 남고, 사용자가 다시 담아서 고칠 수도 없다 — 이미 저장된 단어라 SongDetail 이 '담기'가 아니라 '상세로 이동'을 띄워서 이벤트가 다시 발행되지 않기 때문이다.

동시에 같은 유저가 두 단어를 담으면 양쪽이 deck 을 만들려다 `UNIQUE(user_id, song_id)` / `UNIQUE(user_id, is_default)` 에 걸린다. 이건 새 트랜잭션에서 재조회하는 재시도로 흡수한다(이긴 쪽이 만든 deck 을 보고 연결만 한다). 회귀 테스트: `DeckEventListenerTest` 의 동시 저장 테스트 — 두 연결을 한 트랜잭션으로 합치면 이 테스트가 실패한다.

### 담김 판정 (SongDetailScreen)

```
saved = SELECT * FROM words WHERE user_id = ? AND japanese_text IN (...)
isSaved(candidate) = candidate 의 뜻 전부가 saved[japanese].senses[].meaning 에 존재
```

sense 동일성 기준은 **뜻 텍스트 문자열 일치**다. 부분 저장은 미저장으로 본다(ALL 판정).

### 단어 수정

`PUT /api/words/{id}` 는 `senses` 배열 **전체 replace**. 뜻 추가·삭제·순서변경·예문 삭제가 전부 이 경로 하나로 처리된다. JSON 원소에 DB id 가 없으므로 `deleteExampleIds` 같은 부분 삭제 계약은 성립하지 않는다.

### 단어 삭제

`deck_word` 는 `words` 에 FK 를 갖고 있어 publisher 커밋 전에 정리돼야 한다. 그래서 `WordDeletedEvent` 는 `AFTER_COMMIT` 이 아니라 같은 트랜잭션의 `@EventListener` + `MANDATORY` 로 처리한다.

## 결정과 감수한 비용

| 쟁점 | 결정 | 감수한 비용 |
|---|---|---|
| sense 동일성 기준 | 뜻 텍스트 문자열 일치 | 번역 표현이 달라지면 미매칭. 사전 sense id 로 가는 길은 닫음 |
| 곡 deck 생성 시점 | 담을 때 자동 생성. 단어는 곡 deck + 전체 단어장 양쪽에 연결 | — |
| deck 3종 구분 | `song_id` + `is_default` nullable 마커 | 종류의 의미가 컬럼 조합에 암묵적으로 담김 |
| sense/예문 정규화 | 전부 `words.senses` JSON 비정규화 | **곡→단어 역방향 조회 영구 상실.** 예문이 `song_id` 를 갖는 정규화 테이블을 만드는 순간 그건 `song_words` 의 부활이라 성공 기준 2를 못 지킨다 |
| 부분 저장 판정 | ALL | 이미 담은 단어가 빈 북마크로 보이는 경우 잔존 |
| 예문 상한 기준 | sense 당 5개 | word 하나의 예문 총량은 늘 수 있음 |
| `UpdateWord` API | `senses` 전체 replace | **lost update 가능** — 상세화면을 열어둔 채 SongDetail 에서 같은 단어를 담으면 상세화면 저장이 그 사이 추가된 sense 를 덮어쓴다. 낙관적 잠금·원소 UUID 는 범위 밖 |
| 기존 데이터 | V29 전체 백필 | 예문을 어느 sense 에 붙일지 알 수 없어 첫 sense 에 몰아넣음 |

## 범위 밖

- 사전 sense id 기반 식별
- 부분 저장의 3-state UI
- 곡 → 단어 역방향 조회 복원 (admin 통계가 필요해지면 재설계 필요)
- flashcard 를 sense 단위로 쪼개기
- 담기 취소 / 뜻 개별 삭제를 SongDetailScreen 에 노출하기
- `senses` replace 의 lost update 방지
- 곡 삭제 시 `decks.song_id` 처리 정책
