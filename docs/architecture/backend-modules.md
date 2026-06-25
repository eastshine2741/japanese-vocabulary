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
│   ├── flashcard/           — word + flashcard packages merged (word <-> flashcard cycle): WordEntity, FlashcardEntity, repositories, services, events
│   ├── deck/                — DeckEntity, DeckService, DeckEventListener
│   ├── studystats/          — DailyStudySummary, StreakCalculator. Spring Batch job 본체는 batch 모듈로 분리됨
│   └── notification/        — FCM 전송 + FirebaseConfig + NotificationLogEntity. Scheduler/조회 로직 없음
├── integrations/            — external music provider clients. `song-search`, `lyric-search`, `mv-search`, `apple-music-rss`
├── api/                     — REST bootstrap. 사용자 API 도메인 모듈 의존. @Scheduled 없음
├── admin-api/               — internal admin REST bootstrap. read-only inspection 중심
└── batch/                   — scheduled/background job bootstrap. 모든 @Scheduled는 여기
```

## Dependency Principles

- **batch가 의존하는 도메인은 최소화**. 필요한 도메인만 추가한다.
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
- **`model/`**: 도메인 내부 common value type. dto도 entity도 아닌 것.
- Entity -> Dto 변환은 `fun XxxEntity.toDto(): XxxDto` extension.

## Domain Layer Boundaries

```text
Inner:  Song, Lyric              — 콘텐츠 원본
Middle: Word, SongWord, Flashcard — 사용자 학습 데이터
Outer:  Deck, DeckFlashcard       — 조직화 레이어
```

- 같은 계층 내: 서비스 간 직접 호출.
- 계층 경계를 넘을 때만 Spring Event 사용.
- 안쪽 계층이 바깥쪽 계층을 참조하면 안 됨.

## Spring Event Listeners

- `@TransactionalEventListener(phase = AFTER_COMMIT)` 안에서 DB 쓰기를 하려면 `@Transactional(propagation = REQUIRES_NEW)`를 같이 붙일 것.
- listener 직접 호출 테스트는 `AfterCommitListenerTest` 상속, setup은 `inTx { ... }`로 감쌀 것.
- 이벤트 발행 검증은 기존 base + `@RecordApplicationEvents`.
