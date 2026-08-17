# Backend Modules

Multi-module Gradle (Kotlin DSL) lives at `backend/`. Always run `./gradlew` from `backend/`.

```text
backend/
├── common/                  — cross-cutting infra (RedisCache, BusinessException, ErrorCode, JsonListConverter, base test fixtures, AfterCommitListenerTest base)
├── migration/               — Flyway migrations
├── domains/                 — domain modules (no @SpringBootApplication)
│   ├── auth/                — Google OIDC + JWT, AuthService
│   ├── user/                — UserEntity + Settings + DeviceToken
│   ├── userinventory/       — freeze inventory etc.
│   ├── song/                — Song/Lyric entity + repository + lyric 저장 모델(AnalyzedLine/Token/PartOfSpeech/LyricLineData) + LRC parser. Redis/external music client/use case 없음
│   ├── song-analysis/       — song_analysis_work 상태머신 + trigger/polling DTO. song 모듈을 의존하지 않으며 song_id/lyric_id는 Long projection으로만 보관
│   ├── recommendation/      — 추천곡 후보/발행 상태. Apple RSS 원본 메타데이터, song_analysis_work 링크, PUBLISHED 추천 row를 보관
│   ├── translation/         — KoreanLyricTranslationService + GeminiClient + JishoService(cache-aside+동시성) + JishoClient + JishoCache. batch만 의존
│   ├── word/                — 사용자 학습 데이터 일체. `word`/`flashcard`/`deck` 세 package 가 한 모듈에 있다. WordService 가 세 수명주기를 한 트랜잭션에서 소유한다
│   ├── studystats/          — DailyStudySummary, StreakCalculator. Spring Batch job 본체는 batch 모듈로 분리됨
│   └── notification/        — FCM 전송 + FirebaseConfig + NotificationLogEntity. Scheduler/조회 로직 없음
├── integrations/            — external music provider clients. `song-search`, `lyric-search`, `mv-search`, `apple-music-rss`
├── api/                     — REST bootstrap. 사용자 API 도메인 모듈 의존. @Scheduled 없음
├── admin-api/               — internal admin REST bootstrap. read-only inspection 중심
└── batch/                   — scheduled/background job bootstrap. 모든 @Scheduled는 여기
```

## Dependency Principles

- **batch가 의존하는 도메인은 최소화**. 필요한 도메인만 추가한다. 단 `domains:word` 통합으로 batch 컨텍스트에 deck bean 까지 올라온다 — 복습 알림이 word/flashcard 를 읽어야 하는 이상 피할 수 없는 비용이다.
- **api는 사용자 API에 필요한 도메인 의존**. 현재 REST 표면은 대부분의 사용자 도메인을 노출하고 song 조회/분석 polling 때문에 `song`과 `song-analysis`를 둘 다 의존한다. 홈 추천곡 읽기 때문에 `recommendation`도 의존한다. **예외: translation**은 batch 전용 유지.
- **admin-api는 public api와 분리된 bootstrap**. v1은 `song`, `lyric`, `user` 조회만 제공하고 mutation route를 만들지 않는다. admin-api는 `domains:song` core를 의존하되 music integration module을 의존하지 않는다. 타 모듈 entity/repository scan 지식은 application bootstrap에 두지 않고, 각 active module의 AutoConfiguration이 제공한다.
- **active module은 자기 Spring surface를 AutoConfiguration으로 선언한다**. Spring bean을 제공하는 domain/integration module은 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`와 `com.japanese.autoconfigure.*` 설정 클래스를 둔다. AutoConfiguration은 해당 모듈의 `com.japanese.vocabulary.<module>` package를 `@ComponentScan`으로 열고, entity/repository는 `@EntityScan`/`@EnableJpaRepositories`로 등록한다.
- **도메인 모듈은 persistence-aware domain core로 수렴**. 목표 구조는 entity/model/enum, domain method/service, invariant/state transition 중심이다. `SongRepository`, `LyricRepository` 같은 JPA repository는 이번 모듈화 pass에서 외부 노출을 유지한다.
- **외부 API client는 domain core가 아니다**. iTunes/YouTube/LRCLIB/VocaDB/Apple Music RSS client와 provider DTO는 application별로 중복하지 않고 기능별 integration 모듈에 둔다. 이 프로젝트에서는 불필요한 port/adapter 복잡도를 피하고, 필요한 application module이 client class를 직접 사용한다.
- **integration package는 domain package와 분리한다**. integration 모듈의 Kotlin package는 `com.japanese.vocabulary.songsearch`, `com.japanese.vocabulary.lyricsearch`, `com.japanese.vocabulary.mvsearch`, `com.japanese.vocabulary.applemusicrss`처럼 소유 모듈을 드러낸다. `com.japanese.vocabulary.song.client.*` 아래에 새 외부 client를 추가하지 않는다.
- **외부 client 설정은 integration client + application별 properties override로 처리한다**. timeout, connection, retry 차이가 필요하면 client class를 복제하지 말고 application yml/env에서 같은 property namespace를 다르게 설정한다.
- **cache 위치는 의미로 결정한다**. Redis cache를 integration module에 넣지 않고 현재 behavior owner application에 둔다. `SongSearchCache`는 `api`, `ArtistChannelCache`는 `batch`, `RecentSongService`/`SearchHistoryService`는 `api`가 소유한다.
- **Admin write는 raw field update 금지**. 향후 admin mutation은 entity별로 허용된 domain method/service를 통해서만 수행한다. DTO 바인딩이나 generic table editor로 엔티티 필드를 직접 여는 방식은 금지하며, 필요한 경우 audit logging을 붙인다.
- **Spring Batch Job/Step config, Scheduler, job worker service는 batch bootstrap 모듈에만 둔다**. 도메인 모듈에 `spring-boot-starter-batch`가 들어가면 그 모듈을 의존하는 api에도 spring-batch가 classpath에 올라와 startup job auto-run 문제가 생긴다.
- **외부 API 클라이언트가 integration 모듈에 있고 그 integration을 application이 의존하면, 해당 application yml에도 해당 키를 넣어야** placeholder 미해석 크래시를 피한다. 예: `integrations:mv-search`의 `YoutubeClient` -> batch의 `youtube.api-key`.
- **통합테스트는 bootstrap 모듈(api/batch/admin-api)에 둔다**. 도메인 모듈에 테스트용 `@SpringBootApplication(TestBoot)`을 만들지 않는다.
- 도메인 모듈끼리는 필요할 때 의존한다. 단 한쪽이 너무 많은 cross-domain repository를 import하면 service method 도입을 고려한다.

## DTO / Model / Entity Names

- **`entity/`**: JPA `@Entity`. 도메인 모듈 내부 전용. cross-module로 넘기지 않는다.
- **`dto/`**: 모든 클래스가 `Request | Response | Dto` 셋 중 하나로 끝나야 한다. 한 파일에 하나의 클래스.
- **`model/`**: 도메인 내부 common value type. dto도 entity도 아닌 것. 한 파일에 하나의 클래스.
- Entity -> Dto 변환은 `fun XxxEntity.toDto(): XxxDto` extension.

## Domain Layer Boundaries

```text
Inner:  Song, Lyric              — 콘텐츠 원본 (domains:song)
Outer:  Word, Flashcard, Deck    — 사용자 학습 데이터 (domains:word)
```

- 같은 모듈 내: 서비스 간 직접 호출.
- 모듈 경계를 넘을 때만 Spring Event 사용. 현재 유일한 사례는 `FlashcardReviewedEvent` → `studystats`.
- 안쪽 계층이 바깥쪽 계층을 참조하면 안 됨. `word` 는 `song` 을 읽지만 `song` 은 `word` 를 모른다.

### word / flashcard / deck 수명주기

`domains:word` 의 주인은 word 다. flashcard 와 deck 은 word 에 딸린 개념이고, `WordService` 가
셋의 수명주기를 **한 트랜잭션 안에서** 관리한다.

| 대상 | word 와의 관계 | 규칙 |
|---|---|---|
| flashcard | 수명주기 동일 | 저장할 때 만들고 삭제할 때 지운다. flashcard 없는 word 는 존재할 수 없다 |
| deck | word 보다 오래 산다 | 담을 때 없으면 만든다. 안이 비어도 지우지 않고, deck 을 지워도 안의 word 는 남는다 |
| 전체 단어장 | 모든 word 가 연결 | 유저당 1개. 지울 수 없다 |

커밋 뒤에 도는 이벤트로 미루지 않는 이유: `deck_word` 는 단어장 구성의 유일한 기록이라
(`song_words` 가 사라져 재구성 경로가 없다) 단어만 저장되고 연결이 유실되면 복구할 방법이 없다.
같은 트랜잭션이면 실패가 전부 롤백돼 그 상태 자체가 생기지 않는다. 자세한 근거는
`word-schema.md`.

### deck ↔ flashcard 의존

deck 멤버십은 `deck_word(deck_id, word_id)`가 소유한다. flashcard 는 FSRS 상태만 들고 있는
word 의 1:1 보조 테이블로, deck 과 직접 연결되지 않는다. deck 이 복습 통계를 낼 때는
`deck_word JOIN flashcards ON flashcards.word_id = deck_word.word_id` 로 word 를 경유한다.

`decks` 는 세 종류를 컬럼 조합으로 구분한다 — `is_default = 1` 전체 단어장(유저당 1개,
`UNIQUE(user_id, is_default)` 로 DB 가 강제), `song_id IS NOT NULL` 곡 단어장, 둘 다 아니면 일반 단어장.

## Spring Event Listeners

모듈 경계를 넘는 부수효과에만 쓴다. 같은 모듈 안이면 그냥 서비스를 직접 부른다 — 이벤트로
감싸면 트랜잭션 경계가 흐려지고, 불변식을 커밋 단위로 지킬 수 없게 된다.

- `@TransactionalEventListener(phase = AFTER_COMMIT)` 안에서 DB 쓰기를 하려면 `@Transactional(propagation = REQUIRES_NEW)`를 같이 붙일 것.
- FK 선행 정리처럼 publisher 커밋 전에 끝나야 하는 listener는 `AFTER_COMMIT`을 쓰지 말고 같은 트랜잭션의 `@EventListener` + `@Transactional(propagation = MANDATORY)`로 처리할 것.
- 진짜 커밋 경계가 필요한 테스트(AFTER_COMMIT 리스너, 롤백, 동시성)는 `AfterCommitListenerTest` 상속, setup은 `inTx { ... }`로 감쌀 것.
- 이벤트 발행 검증은 기존 base + `@RecordApplicationEvents`.
