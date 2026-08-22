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

### 수명주기

`domains:word` 의 주인은 word 다. flashcard 와 deck 은 부수 개념이고, `WordService` 가 셋을 **한 트랜잭션 안에서** 관리한다.

| 대상 | word 와의 관계 | 규칙 |
|---|---|---|
| flashcard | 수명주기 동일 | word 저장 시 생성, 삭제 시 삭제. flashcard 없는 word 는 존재할 수 없다 |
| deck | word 보다 오래 산다 | 담을 때 없으면 생성. 안이 비어도 안 지우고, deck 을 지워도 안의 word 는 안 지운다 |
| 전체 단어장 | 모든 word 가 연결 | 유저당 1개, 삭제 불가 |

### 뜻 쪼개기

곡 분석이 내려주는 뜻은 "사랑, 애정" 처럼 쉼표로 이어붙인 문자열 **하나**다. 단어는 뜻 단위이므로 담기 직전에 조각마다 별개의 sense 로 쪼갠다 (`splitMeaningText`). 조각은 원래 sense 의 품사·JLPT 를 물려받는다. 괄호 안 쉼표는 자르지 않는다 — "(사람, 물건이) 있다" 가 반토막 나면 안 된다.

**예문은 첫 조각만 갖는다.** 그 가사 줄이 "사랑" 으로 쓰인 건지 "애정" 으로 쓰인 건지 우리는 모른다. 모르는 채 양쪽에 복제하면 예문 목록에 같은 줄이 조각 수만큼 반복되고(단어 시트·플래시카드는 `senses` 를 펼쳐서 보여준다) sense 당 5개 상한도 그 중복이 먹는다. 의미로 갈라 넣으려면 뜻 판별이 필요해서 값이 비용을 못 넘는다. 뒷 조각은 예문 없이 시작해서, 나중에 그 뜻으로 담길 때 자기 예문을 갖는다.

쪼개는 지점은 둘이다.

- **저장 경로** (`WordService.forSave`): `POST /api/words`, `POST /api/words/batch` 로 들어온 sense 를 쪼갠 뒤 merge 한다. 쪼갠 조각 중 이미 담긴 뜻에는 예문만 붙고, 처음 보는 조각만 새 sense 가 된다. `PUT /api/words/{id}` 는 쪼개지 않는다 — 사용자가 직접 입력한 뜻을 서버가 나누면 안 된다.
- **SongDetail 응답** (`SongDetailQueryService`): `senses` 와 `addRequest.senses` 를 쪼개서 내려보내므로 담김 판정도 조각 단위가 된다. 같은 뜻이 여러 candidate 에서 나오면 예문을 합쳐 하나로 만든다 — 쪼개진 쪽의 빈 조각이 자기 예문을 가진 candidate 를 덮으면 안 된다. 요약 표시용 `koreanText` 만 쪼개기 전 문자열을 유지한다.

앱도 같은 규칙의 `splitMeaningText` 를 갖는다 (`app-rn/src/types/word.ts`). 가사 탭으로 담는 경로의 요청 조립, '다른 뜻 담기 / 예문 담기' 판정, 편집 화면의 뜻 줄 프리필이 여기에 걸린다.

### 단어 담기

한 트랜잭션에서 순서대로 처리한다.

1. `words` 에 `(user_id, japanese_text)` upsert — 기존 레코드면 **누락된 sense 만 append**. 같은 뜻이면 예문만 5개까지 덧붙인다.
2. `flashcards` 1:1 생성 (이미 있으면 재사용해 FSRS 진행 상태를 보존).
3. 전체 단어장에 연결. `songId` 가 있으면 곡 단어장을 upsert 해서 거기에도 연결.

**커밋 뒤에 도는 이벤트로 3번을 미루지 않는 이유가 있다.** `song_words` 가 사라지면서 `deck_word` 는 단어장 구성의 유일한 기록이 됐다 — 예전엔 `deck_flashcards` 가 `song_words` 에서 재구성 가능한 파생 인덱스였지만(V10 이 실제로 그렇게 백필했다) 이제 재구성 경로가 없다. 그래서 단어만 커밋되고 연결이 유실되면 단어가 **어느 단어장에도 없는 상태로 영구히** 남고, 사용자가 다시 담아 고칠 수도 없다 — 이미 저장된 단어라 SongDetail 이 '담기'가 아니라 '상세로 이동'을 띄우기 때문이다. 한 트랜잭션이면 실패가 전부 롤백돼서 그 상태 자체가 생기지 않는다.

대신 단어장 생성이 트랜잭션 안으로 들어오면서, 같은 유저가 동시에 담을 때의 deck UNIQUE 충돌이 단어 저장까지 롤백시킬 수 있게 됐다. 이건 트랜잭션 **밖에서** 저장을 통째로 재시도해 흡수한다 (`WordService.retryingSave`). 저장 경로가 전부 upsert 라 재실행이 안전하다.

회귀 테스트는 `WordLifecycleTest`. `WordControllerTest` 의 저장 테스트는 같은 트랜잭션 안에서 단어장 연결을 확인하므로, 3번을 다시 `AFTER_COMMIT` 으로 미루면 실패한다.

### 단어장 삭제

`DELETE /api/decks/{id}` 는 `deck_word` 행과 `decks` 행만 지운다. 안의 단어와 flashcard 는 그대로 남고 전체 단어장 연결도 유지된다. 전체 단어장은 "모든 단어는 전체 단어장에 속한다"는 불변식의 담지자라 `DEFAULT_DECK_NOT_DELETABLE` 로 거부한다.

### 담김 판정 (SongDetailScreen)

```
saved = SELECT * FROM words WHERE user_id = ? AND japanese_text IN (...)
isSaved(candidate) = candidate 의 뜻 전부가 saved[japanese].senses[].meaning 에 존재
```

sense 동일성 기준은 **뜻 텍스트 문자열 일치**다. 비교 대상인 candidate 의 뜻은 쉼표로 쪼갠 뒤의 조각이다. 부분 저장은 미저장으로 본다(ALL 판정).

### 단어 수정

`PUT /api/words/{id}` 는 `senses` 배열 **전체 replace**. 뜻 추가·삭제·순서변경·예문 삭제가 전부 이 경로 하나로 처리된다. JSON 원소에 DB id 가 없으므로 `deleteExampleIds` 같은 부분 삭제 계약은 성립하지 않는다.

### 단어 삭제

`flashcards.word_id` 와 `deck_word.word_id` 가 `words` 를 FK 로 참조하므로 그 둘을 먼저 지우고 word 를 지운다. 셋 다 같은 트랜잭션이다. 단어장 자체는 비어도 남는다.

## 결정과 감수한 비용

| 쟁점 | 결정 | 감수한 비용 |
|---|---|---|
| sense 동일성 기준 | 뜻 텍스트 문자열 일치 | 번역 표현이 달라지면 미매칭. 사전 sense id 로 가는 길은 닫음 |
| 곡 deck 생성 시점 | 담을 때 자동 생성. 단어는 곡 deck + 전체 단어장 양쪽에 연결 | — |
| deck 3종 구분 | `song_id` + `is_default` nullable 마커 | 종류의 의미가 컬럼 조합에 암묵적으로 담김 |
| sense/예문 정규화 | 전부 `words.senses` JSON 비정규화 | **곡→단어 역방향 조회 영구 상실.** 예문이 `song_id` 를 갖는 정규화 테이블을 만드는 순간 그건 `song_words` 의 부활이라 성공 기준 2를 못 지킨다 |
| 부분 저장 판정 | ALL | 이미 담은 단어가 빈 북마크로 보이는 경우 잔존 |
| 예문 상한 기준 | sense 당 5개 | word 하나의 예문 총량은 늘 수 있음 |
| 쪼갠 뜻의 예문 | 첫 조각만 | 대표 뜻이 "첫 조각"이라는 건 분석기가 준 순서에 기댄 것. 뒷 조각은 예문 없이 남을 수 있다 |
| `UpdateWord` API | `senses` 전체 replace | **lost update 가능** — 상세화면을 열어둔 채 SongDetail 에서 같은 단어를 담으면 상세화면 저장이 그 사이 추가된 sense 를 덮어쓴다. 낙관적 잠금·원소 UUID 는 범위 밖 |
| 기존 데이터 | V29 전체 백필 | 예문을 어느 sense 에 붙일지 알 수 없어 첫 sense 에 몰아넣음 |

## 미해결 — 동음이의어가 한 행으로 합쳐진다

`words` 의 유일성 제약은 `UNIQUE(user_id, japanese_text)`
(`V8__word_unique_constraints.sql:1`) 이고 `reading` 은 word 당 하나다. 곡 분석
파이프라인은 사전 entry 를 `(headword, reading)` 페어로 구분하지만
(`docs/translation-pipeline.md` 의 "Jisho Entry Select"), **저장 계층은 headword
만으로 유일하다.** 그래서 前[マエ] 와 前[ゼン] 은 한 행으로 합쳐지고, `reading`
은 먼저 담은 쪽이 이긴다. 나중에 담긴 뜻은 같은 행의 sense 로 붙어, 읽는 법이
다른 두 단어의 뜻이 한 카드에 섞인다.

해소하려면 유일성을 `(user_id, japanese_text, reading)` 로 확장하는 마이그레이션과
앱의 조회·저장 경로 변경이 함께 필요하다. **이번 파이프라인 리팩토링 범위 밖이다.**

관련해서, `words.reading` 은 담은 시점의 `token.baseFormReading` 사본이다.
파이프라인이 카타카나로 바뀌었으므로 그 이전에 담긴 단어는 히라가나로 남아 있다.
앱이 `convertReading` 으로 항상 변환해 보여주므로 화면은 일관되지만, 카타카나
모드에서 구 단어만 히라가나로 보인다. 백필은 별도 작업이다.

## 범위 밖

- 사전 sense id 기반 식별
- 부분 저장의 3-state UI
- 곡 → 단어 역방향 조회 복원 (admin 통계가 필요해지면 재설계 필요)
- flashcard 를 sense 단위로 쪼개기
- 담기 취소 / 뜻 개별 삭제를 SongDetailScreen 에 노출하기
- `senses` replace 의 lost update 방지
- 곡 삭제 시 `decks.song_id` 처리 정책
- `words` 유일성을 `(user_id, japanese_text, reading)` 로 확장해 동음이의어 분리 저장
- `words.reading` 히라가나 → 카타카나 백필
