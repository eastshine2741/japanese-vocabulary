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
│   ├── recommendation/      — 홈 추천곡 전역 목록(`recommended_song`). 운영자가 기존 곡을 넣고 순서를 정한다
│   ├── translation/         — KoreanLyricTranslationService + GeminiClient + JishoService(cache-aside+동시성) + JishoClient + JishoCache. worker만 의존
│   ├── word/                — 사용자 학습 데이터 일체. `word`/`flashcard`/`deck` 세 package 가 한 모듈에 있다. WordService 가 세 수명주기를 한 트랜잭션에서 소유한다
│   ├── studystats/          — DailyStudySummary, StreakCalculator. Spring Batch job 본체는 batch 모듈로 분리됨
│   └── notification/        — FCM 전송 + FirebaseConfig + NotificationLogEntity. Scheduler/조회 로직 없음
├── integrations/            — external provider clients + infra adapters. `song-search`, `lyric-search`, `mv-search`, `github`, `message-queue`
├── api/                     — REST bootstrap. 사용자 API 도메인 모듈 의존. @Scheduled 없음
├── admin-api/               — internal admin REST bootstrap. read-mostly inspection + workflow-specific Reels Factory render + 운영자 수동 푸시
├── worker/                  — 큐 consumer bootstrap. 곡 분석 파이프라인 전용. 상주하며 RabbitMQ 를 듣는다
└── batch/                   — 시간 기반 정기 작업 bootstrap. 상주하지 않고 `--task=<name>` 하나를 실행하고 종료한다 (k8s CronJob)
```

## 즉시 실행(worker) vs 정기 실행(batch)

유저·어드민 액션이 만든 작업은 **즉시** 돌아야 하고, 하루 한 번 도는 일은 **시각**이 기준이다.
이 둘을 한 프로세스에 두면 폴링 주기가 곧 지연 시간이 되므로 bootstrap 을 나눈다.

| | worker | batch |
|---|---|---|
| 기동 형태 | Deployment (상주) | CronJob (1회 실행 후 종료) |
| 실행 계기 | RabbitMQ 메시지 | k8s CronJob 스케줄 |
| 담당 | 곡 분석 파이프라인 + 분석 완료 푸시 | 연속 학습 알림, freeze 소비, 주간 추천곡 수집, 수동 백필 |
| `@Scheduled` | 큐 안전망 sweeper 하나뿐 | 없음 (스케줄은 k8s 가 소유) |

### 곡 분석 작업 큐

```text
api / admin-api  ──(원장 row insert)──>  MySQL song_analysis_work
       │ SongAnalysisWorkQueuedEvent (AFTER_COMMIT)
       ▼
   RabbitMQ  kotonoha.song-analysis / song-analysis.work
       │
       ▼
   worker  SongAnalysisWorkListener  ──claim(workId)──>  PENDING → RUNNING → COMPLETED/FAILED
```

- **원장 row 가 진실 원천이고 메시지는 `workId` 만 싣는 깨우기 신호다.** 처리에 필요한 나머지는
  worker 가 DB 에서 읽으므로, 메시지가 중복·지연 배달돼도 판단 기준은 행의 상태 하나다.
- **중복 배달은 `claim` 이 흡수한다.** PENDING 인 행만 잠그므로 두 번째 배달은 그냥 ack 된다.
- **유실은 sweeper 가 복구한다.** 커밋과 발행 사이의 크래시, 브로커 재시작, 발행 실패로 메시지가
  없어져도 행은 PENDING 으로 남는다. `SongAnalysisWorkSweeper` 가 5분마다 5분 이상 묵은 PENDING 을
  다시 발행하고, 락이 만료된 RUNNING 을 FAILED 로 넘긴다.
- **파이프라인 실패는 예외가 아니라 원장의 FAILED 다.** 메시지는 ack 되고 DLQ 로 가지 않는다.
  DLQ(`song-analysis.work.dlq`)에 쌓이는 것은 DB 접근 불가 같은 인프라 장애뿐이므로, 거기 메시지가
  있으면 브로커가 아니라 worker 환경을 봐야 한다.
- 브로커는 단일 인스턴스 + PVC 다. 재시작 동안의 공백은 위 sweeper 가 흡수하므로 quorum queue
  3노드 클러스터는 두지 않는다.

## Dependency Principles

- **worker/batch가 의존하는 도메인은 최소화**. 필요한 도메인만 추가한다. batch 는 상주 서버가 아니라서 `spring-boot-starter-web`/actuator 를 싣지 않는다 — 그래서 `HttpClientMetricsConfig`(WebClient 타입 때문에 spring-webflux 필요)도 batch 에는 올리지 않는다.
- **api는 사용자 API에 필요한 도메인 의존**. 현재 REST 표면은 대부분의 사용자 도메인을 노출하고 song 조회/분석 polling 때문에 `song`과 `song-analysis`를 둘 다 의존한다. 홈 추천곡 읽기 때문에 `recommendation`도 의존한다. **예외: translation**은 batch 전용 유지.
- **admin-api는 public api와 분리된 bootstrap**. 기본은 `song`, `lyric`, `user` 조회이며 raw entity mutation route를 만들지 않는다. mutation은 불변식을 지키는 workflow 단위로만 연다 — song 재분석, 추천곡 상태 변경, 운영자 수동 푸시, 그리고 DB 상태를 전혀 바꾸지 않는 Reels Factory render action. 수동 푸시 때문에 `domains:notification` 을 의존하며, 그 모듈이 Redis 를 런타임 classpath 로 끌고 온다 (admin-api 자신은 Redis 를 호출하지 않고 health 체크도 꺼져 있다). admin-api는 `domains:song` core를 의존하되 music integration module을 의존하지 않는다. 타 모듈 entity/repository scan 지식은 application bootstrap에 두지 않고, 각 active module의 AutoConfiguration이 제공한다.
- **active module은 자기 Spring surface를 AutoConfiguration으로 선언한다**. Spring bean을 제공하는 domain/integration module은 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`와 `com.japanese.autoconfigure.*` 설정 클래스를 둔다. AutoConfiguration은 해당 모듈의 `com.japanese.vocabulary.<module>` package를 `@ComponentScan`으로 열고, entity/repository는 `@EntityScan`/`@EnableJpaRepositories`로 등록한다.
- **도메인 모듈은 persistence-aware domain core로 수렴**. 목표 구조는 entity/model/enum, domain method/service, invariant/state transition 중심이다. `SongRepository`, `LyricRepository` 같은 JPA repository는 이번 모듈화 pass에서 외부 노출을 유지한다.
- **외부 API client는 domain core가 아니다**. iTunes/YouTube/LRCLIB/VocaDB client와 provider DTO는 application별로 중복하지 않고 기능별 integration 모듈에 둔다. 이 프로젝트에서는 불필요한 port/adapter 복잡도를 피하고, 필요한 application module이 client class를 직접 사용한다.
- **integration package는 domain package와 분리한다**. integration 모듈의 Kotlin package는 `com.japanese.vocabulary.songsearch`, `com.japanese.vocabulary.lyricsearch`, `com.japanese.vocabulary.mvsearch`처럼 소유 모듈을 드러낸다. `com.japanese.vocabulary.song.client.*` 아래에 새 외부 client를 추가하지 않는다.
- **외부 client 설정은 integration client + application별 properties override로 처리한다**. timeout, connection, retry 차이가 필요하면 client class를 복제하지 말고 application yml/env에서 같은 property namespace를 다르게 설정한다.
- **cache 위치는 의미로 결정한다**. Redis cache를 integration module에 넣지 않고 현재 behavior owner application에 둔다. `SongSearchCache`는 `api`, `ArtistChannelCache`는 `worker`, `RecentSongService`/`SearchHistoryService`는 `api`가 소유한다.
- **Admin write는 raw field update 금지**. 향후 admin mutation은 entity별로 허용된 domain method/service를 통해서만 수행한다. DTO 바인딩이나 generic table editor로 엔티티 필드를 직접 여는 방식은 금지하며, 필요한 경우 audit logging을 붙인다. Reels Factory render는 transient file generation/download workflow로만 허용하고 DB entity를 추가하지 않는다.
- **Spring Batch Job/Step config 는 batch bootstrap 모듈에만 둔다**. 도메인 모듈에 `spring-boot-starter-batch`가 들어가면 그 모듈을 의존하는 api에도 spring-batch가 classpath에 올라와 startup job auto-run 문제가 생긴다. 큐 consumer 와 그 워크플로 서비스는 `worker` 에 둔다.
- **스케줄은 코드가 아니라 k8s CronJob 이 소유한다**. batch 에 `@Scheduled` 를 새로 넣지 않는다. 새 정기 작업은 `CronTask` 를 구현하고 `k8s/{dev,prod}/batch/cronjobs.yaml` 에 CronJob 을 추가한다. dev 네임스페이스의 CronJob 은 전부 `suspend: true` 이고 필요할 때 `kubectl create job --from=cronjob/<name>` 로 부른다.
- **외부 API 클라이언트가 integration 모듈에 있고 그 integration을 application이 의존하면, 해당 application yml에도 해당 키를 넣어야** placeholder 미해석 크래시를 피한다. 예: `integrations:mv-search`의 `YoutubeClient` -> worker의 `youtube.api-key`.
- **통합테스트는 bootstrap 모듈(api/worker/batch/admin-api)에 둔다**. 도메인 모듈에 테스트용 `@SpringBootApplication(TestBoot)`을 만들지 않는다. 예외적으로 `integrations:message-queue` 는 브로커 토폴로지가 자기 책임이라 Testcontainers 왕복 테스트를 모듈 안에 둔다.
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
- 모듈 경계를 넘을 때만 Spring Event 사용. `FlashcardReviewedEvent` → `studystats`, `SongAnalysisWorkQueuedEvent` → `integrations:message-queue`(AFTER_COMMIT 에 브로커로 발행), `SongAnalysisCompletedEvent` → worker 의 푸시 알림.
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
