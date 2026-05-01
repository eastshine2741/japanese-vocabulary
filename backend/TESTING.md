# Backend Testing Guide

이 문서는 `backend/`의 Spring Boot + Kotlin 백엔드에 테스트를 추가하는 방법을 정리한다. AI 에이전트가 코드를 변경할 때 회귀를 즉시 잡기 위한 안전망 설계가 목표.

> **상태:** Phase 1(인프라 + auth + flashcard)만 작성됨. 나머지 도메인은 이 문서의 가이드를 따라 후속 PR에서 추가.

---

## 1. 핵심 원칙

### "단위 vs 통합"이 아니라 "결합도"로 결정한다
- **순수 함수·계산·매퍼** → 단위테스트 (10ms 미만)
- **Spring 빈 협력·이벤트·트랜잭션·native 쿼리** → 통합테스트 (1–3s)
- **컨트롤러 권한·검증·직렬화** → Spring Web 슬라이스 (`@WebMvcTest`)

### 외부 API 호출은 절연한다
모든 WebClient/RestClient 클라이언트(`ItunesClient`, `YoutubeClient`, `LrclibClient`, `VocadbClient`, `JishoClient`, `GeminiClient`)는 통합테스트에서 `@MockkBean`으로 stub. **테스트가 인터넷에 의존하면 안 됨.**

### 시계는 주입된 `Clock` 으로 통제한다
운영 코드는 `Instant.now()` / `LocalDateTime.now()` 직접 호출 금지 — `Clock` 빈을 주입받아 `Instant.now(clock)` 형태로 사용. 테스트는 `MutableClock` 으로 시간을 advance. FSRS 누적, KST 날짜 전환, freeze 만료 같은 시간 의존 시나리오를 결정적으로 검증 가능.

### DB는 Testcontainers MySQL을 공유한다
- Native MySQL 쿼리(window 함수, JSON 컬럼)가 도메인에 있어 H2/in-memory 호환성 위험.
- 모든 통합테스트가 **싱글턴 컨테이너 1개**를 공유. 각 테스트는 `@BeforeEach`에서 truncate.
- `withReuse(true)`로 로컬 개발 시 첫 부팅(~10초) 이후 즉시 재사용.

---

## 2. 테스트 매트릭스

| 코드 종류 | 예시 | 테스트 유형 | 어노테이션 |
|---|---|---|---|
| 순수 알고리즘 | `StreakCalculator`, `SongQueryNormalizer`, LRC parser, FSRS rating mapper | 순수 단위 | (없음, 일반 JUnit) |
| 컨트롤러 | `WordController`, `FlashcardController` | Spring Web 슬라이스 | `@WebMvcTest(WordController::class)` |
| 서비스 + DB | `WordService`, `FlashcardService` | 도메인 통합 | `@SpringBootTest` (BaseIntegrationTest 상속) |
| 리포지터리 native query | `FlashcardRepository.findDueByUserIdAndSongId`, `DailyStudySummaryRepository.longestStreak`, `DeckRepository.getDeckList` | JPA + 실제 DB | `@SpringBootTest` (BaseIntegrationTest 상속) |
| Spring Event flow | `FlashcardCreatedEvent` → `DeckEventListener`, `StudyStatsEventListener` | 도메인 통합 | `@SpringBootTest` + `ApplicationEvents` |
| 인증/필터 | `JwtAuthFilter`, `SecurityConfig` | 통합 | `@SpringBootTest` + MockMvc |
| 외부 API 클라이언트 호출 도메인 | `LyricProcessingService`, `WordService.lookupMeaning`, `KoreanLyricTranslationService` | 통합 + `@MockkBean(GeminiClient::class)` | `@SpringBootTest` |
| 배치 스케줄러 | `KoreanLyricTranslationService.processTranslations`, `FreezeConsumeScheduler` | 통합 (스케줄 비동기 X, 직접 invoke) | `@SpringBootTest` |

---

## 3. 인프라 사용법

### TestcontainersConfig + BaseIntegrationTest

`@ServiceConnection`(Spring Boot 3.1+)으로 컨테이너 wiring을 자동화하고, 모든 외부 클라이언트는 **부모에서 일괄 `@MockkBean` 선언**해 ApplicationContext cache key를 안정화한다.

```kotlin
// common 모듈
@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfig {
    @Bean
    @ServiceConnection
    fun mysqlContainer(): MySQLContainer<*> =
        MySQLContainer("mysql:8.0").withReuse(true)
}

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(TestcontainersConfig::class)
abstract class BaseIntegrationTest {

    // 모든 외부 클라이언트를 부모에서 mock — 자식이 추가 선언하지 않으면
    // ApplicationContext가 1번만 빌드되어 모든 통합테스트가 재사용
    @MockkBean(relaxed = true) protected lateinit var jishoClient: JishoClient
    @MockkBean(relaxed = true) protected lateinit var lrclibClient: LrclibClient
    @MockkBean(relaxed = true) protected lateinit var vocadbClient: VocadbClient
    @MockkBean(relaxed = true) protected lateinit var youtubeClient: YoutubeClient
    @MockkBean(relaxed = true) protected lateinit var itunesClient: ItunesClient
    @MockkBean(relaxed = true) protected lateinit var geminiClient: GeminiClient

    @Autowired protected lateinit var mockMvc: MockMvc
    @Autowired protected lateinit var entityManager: EntityManager

    @BeforeEach
    fun resetState() {
        clearMocks(jishoClient, lrclibClient, vocadbClient, youtubeClient, itunesClient, geminiClient)
        // SET FOREIGN_KEY_CHECKS=0 → TRUNCATE 모든 도메인 테이블 → SET FOREIGN_KEY_CHECKS=1
    }
}
```

**왜 이렇게:**
- `@ServiceConnection`이 컨테이너 jdbcUrl/username/password 자동 wiring → `@DynamicPropertySource` 보일러 제거.
- 부모에 mock을 모아두면 자식 테스트는 mock 추가/변경 없이 `every { jishoClient.lookup(any()) } returns ...`만 호출 → cache key 동일하게 유지 → ApplicationContext 1개만 빌드.
- `@BeforeEach`의 `clearMocks`는 이전 테스트의 stub 잔재 제거 (silent flaky 방지).
- `withReuse(true)` 사용을 위해 로컬 머신에 1회 설정 필요:
  ```bash
  echo "testcontainers.reuse.enable=true" >> ~/.testcontainers.properties
  ```

### 외부 클라이언트 stub 패턴

자식 테스트는 mock을 **추가 선언하지 않고 부모 mock만 사용**.

```kotlin
class WordServiceTest : BaseIntegrationTest() {
    // @MockkBean 추가 선언 X — 부모의 jishoClient를 그대로 사용

    @Test fun `lookupMeaning falls back when Jisho returns null`() {
        every { jishoClient.lookup(any()) } returns null
        // ...
    }
}
```

자식이 mock을 새로 선언하면 cache key가 깨져 컨텍스트가 다시 빌드된다. 정말 필요한 경우만(예: 부모에 없는 빈) 자식 선언 허용.

### Spring Event 검증 (`@RecordApplicationEvents`)

```kotlin
@RecordApplicationEvents
class FlashcardEventIntegrationTest : BaseIntegrationTest() {
    @Autowired lateinit var events: ApplicationEvents

    @Test fun `reviewCard publishes FlashcardReviewedEvent`() {
        // ...
        val published = events.stream(FlashcardReviewedEvent::class.java).toList()
        assertThat(published).hasSize(1)
    }
}
```

### `Clock` 인프라

운영 코드:
```kotlin
@Configuration
class ClockConfig {
    @Bean fun clock(): Clock = Clock.systemDefaultZone()
}

@Service
class FlashcardService(private val clock: Clock, ...) {
    fun review(...) {
        val now = Instant.now(clock)   // ← clock 경유
    }
}
```

테스트 코드 (`common/src/test/.../test/clock/MutableClock.kt`):
```kotlin
class MutableClock(private var instant: Instant) : Clock() {
    fun advance(duration: Duration) { instant = instant.plus(duration) }
    override fun instant() = instant
    override fun getZone() = ZoneOffset.UTC
    override fun withZone(zone: ZoneId) = this
}

@TestConfiguration
class TestClockConfig {
    @Bean @Primary
    fun mutableClock() = MutableClock(Instant.parse("2026-01-01T00:00:00Z"))
}
```

테스트에서:
```kotlin
@Autowired lateinit var clock: MutableClock
// ...
clock.advance(Duration.ofDays(7))
flashcardService.review(...)
```

### 픽스처: 빌더 vs Object Mother

테스트 셋업 도구는 **두 가지로 분리**한다.

#### 도구 1. `TestXxxBuilder` — 얕은 Given 전용
`backend/common/src/test/kotlin/com/japanese/vocabulary/test/fixtures/`. 단일 엔티티, 단순 FK 체인을 직접 영속화로 빠르게 만든다. `build()` 가 `entityManager.persist` 까지 책임.

```kotlin
class TestFlashcardBuilder(private val em: EntityManager) {
    private var user: User? = null
    private var word: Word? = null

    fun forUser(u: User) = apply { user = u }
    fun ofWord(w: Word) = apply { word = w }

    fun build(): Flashcard {
        val u = user ?: TestUserBuilder(em).build()
        val w = word ?: TestWordBuilder(em).forUser(u).build()
        return Flashcard(user = u, word = w, ...).also { em.persist(it); em.flush() }
    }
}
```

**룰:**
- 카스케이드 자동 채움 (상위 엔티티 미명시 → 자동 생성).
- **알고리즘 출력 필드 setter 노출 금지** — `Flashcard.stability`, `Lyric.analyzedContent` 같이 운영 로직이 계산하는 필드를 빌더로 set 가능하게 만들면, 그 시점부터 빌더가 운영 로직 복제로 변질됨. 그런 상태가 필요하면 Mother 로 간다.

#### 도구 2. `XxxMother` — 깊은 Given 전용
`backend/common/src/test/kotlin/com/japanese/vocabulary/test/mothers/`. 알고리즘 출력·이벤트 리스너 부수효과·파이프라인 출력처럼 빌더로 정확히 재현 불가능한 상태를 **운영 서비스 호출**로 만들어주는 헬퍼 빈.

```kotlin
@Component
class FlashcardMother(
    private val flashcardService: FlashcardService,
    private val clock: MutableClock,
    private val flashcardRepository: FlashcardRepository,
) {
    fun matured(user: User, word: Word, reviews: Int = 50): Flashcard {
        val flashcard = flashcardService.create(user.id, word.id)
        repeat(reviews) {
            clock.advance(Duration.ofDays(7))
            flashcardService.review(flashcard.id, Rating.GOOD)
        }
        return flashcardRepository.findById(flashcard.id).get()
    }
}
```

**룰 (Mother 추출 임계점):**
- **2개 이상의 테스트가 공유하는 깊은 Given 만 Mother 메서드로 추출**한다. 한 번만 쓰는 복합 셋업은 해당 테스트 클래스 안에 인라인으로 남기고 (서비스 직접 호출), 두 번째 테스트가 같은 셋업을 필요로 할 때 Mother 로 옮긴다. Mother 가 일회용 시나리오 dumping ground 로 비대해지는 것을 방지.
- 메서드 이름은 도메인 용어로 (`matured`, `analyzed`, `aggregated30Days`).

#### 빌더 vs Mother 분기 룰
> **단언에 사용할 필드 중 하나라도 운영 로직이 계산해서 채워야 정확한가?**
>
> No → 빌더. Yes → Mother (또는 인라인 서비스 호출).

### 테스트 구조: Given / When / Then

모든 통합 테스트는 명시적 주석으로 3 단계를 구분한다. 직접 영속화(빌더)와 서비스 호출의 분리도 이 구조에서 자연스럽게 따라옴 — 별개 룰이 아니다.

```kotlin
@Test
fun `flashcard 복습 시 FSRS 갱신 + StudyStatsEvent`() {
    // Given — 빌더(얕은) 또는 Mother(깊은)
    val user = TestUserBuilder(em).build()
    val word = TestWordBuilder(em).forUser(user).build()
    val flashcard = TestFlashcardBuilder(em).forUser(user).ofWord(word).build()

    // When — 검증 대상 행동, 서비스 직접 호출
    flashcardService.review(flashcard.id, Rating.GOOD)

    // Then — 단언만
    val updated = flashcardRepository.findById(flashcard.id).get()
    assertThat(updated.stability).isGreaterThan(flashcard.stability)
    assertThat(events.stream(FlashcardReviewedEvent::class.java).toList()).hasSize(1)
}
```

**룰:**
1. `// Given`, `// When`, `// Then` 주석 명시.
2. **Given** — 빌더 또는 Mother 만 사용. 서비스 직접 호출은 *예외적인 경우* 한 줄 주석으로 사유 명기.
3. **When** — 서비스 직접 호출 1~수회. 시간 흐름(`clock.advance(...)`) 시뮬레이션 포함 가능. 빌더/Mother 호출 금지.
4. **Then** — 단언만. 추가 셋업·행동 금지. 다른 행동을 검증하려면 테스트를 분리한다.
5. **시간 흐름**: 시간 통제는 항상 `MutableClock.advance(Duration)`. 시스템 시계 의존 금지.

---

## 4. 도메인별 가이드

### 4.1 auth ✅ Phase 1
- `JwtUtilTest` (단위): 토큰 생성·검증·만료·서명 위조.
- `AuthServiceTest` (통합): bcrypt 해시 저장, 동일 username 거부, 잘못된 password 거부.
- `AuthControllerTest`: signup/login MockMvc.
- `SecurityConfigIntegrationTest`: 보호된 endpoint 토큰 유무에 따른 200/401, public endpoint 통과.

### 4.2 flashcard ✅ Phase 1
**FSRS 스케줄링 (`FlashcardService.reviewCard`):**
- rating 1~4별로 due/stability/difficulty가 *방향성 있게* 변하는지 검증 (정확한 일수 X — 라이브러리 업그레이드 시 깨짐).
- `FlashcardReviewedEvent` 발행 검증.

**이벤트 플로우:**
- `WordService.addWord` → `FlashcardCreatedEvent` → `DeckEventListener` → `DeckEntity`/`DeckFlashcardEntity` 자동 생성.
- word 삭제 → `FlashcardDeletedEvent` → `DeckFlashcardEntity` 제거.
- review → `StudyStatsEventListener` → `DailyStudySummaryEntity` upsert (KST 날짜 처리).

**Native query:**
- `FlashcardRepository.findDueByUserIdAndSongId` — 다른 user 카드 제외, due 미래 카드 제외, deck-song 조인 정확성.

### 4.3 song (Phase 2 예정)
**`LyricProcessingService`:**
- `LyricProvider` chain (LRCLIB → VocaDB) fallback이 첫 provider null 시 다음으로 넘어가는지.
- `@MockkBean(LrclibClient::class, VocadbClient::class, YoutubeClient::class, ItunesClient::class)`로 stub.
- 가사 found → SongEntity + LyricEntity(status=PENDING) 저장 검증.

**`SongQueryNormalizer`** (단위): 일본어/영어 혼합, 다중 아티스트 (`feat.`, `&`), 특수문자 처리.

**`LrcParser`** (단위): synced 가사 (`[mm:ss.xx]text`) vs plain text, malformed timestamp 처리.

**`RecentSongService`** (통합): Redis 의존 — Testcontainers Redis 추가 또는 `@MockkBean(RedisTemplate::class)`. 후자 권장 (가벼움).

**예제 패턴:**
```kotlin
class LyricProcessingServiceTest : BaseIntegrationTest() {
    @MockkBean lateinit var lrclibClient: LrclibClient
    @MockkBean lateinit var vocadbClient: VocadbClient
    @MockkBean lateinit var youtubeClient: YoutubeClient

    @Test fun `falls back to VocaDB when LRCLIB returns null`() {
        every { lrclibClient.search(any(), any(), any()) } returns null
        every { vocadbClient.search(any(), any()) } returns LyricResult(...)
        // ...
    }
}
```

### 4.4 word (Phase 2 예정)
**`WordService`:**
- 같은 userId + japaneseText 중복 방지.
- batch add: 일부 실패 시 트랜잭션 정책 (현재 코드 확인 후 결정).
- delete → `FlashcardDeletedEvent` → cascade 동작.
- `getUserWords` cursor 페이지네이션.

**Jisho 의존성:** `@MockkBean(JishoClient::class)`로 의미 lookup 결과 fixed.

### 4.5 deck (Phase 3 예정)
**핵심 native query (`DeckRepository.getDeckList`):**
- songs + decks + flashcards 조인 + COUNT/SUM aggregation.
- 시나리오:
  - flashcard 0개인 deck → 결과에서 제외 (또는 포함? 코드 확인)
  - 다른 user의 deck 제외
  - due가 미래인 카드는 dueCount에서 제외

**"all" 가상 deck:** DB 없이 전체 카드 집계 — 별도 메서드 검증.

**`DeckEventListener`** (Phase 1 flashcard 테스트에서 함께 검증되므로 추가 작업 불필요).

### 4.6 user (Phase 3 예정)
**`UserSettingsService`:**
- 기본값 (showIntervals=true, requestRetention=0.9) — settings 없을 때 default 반환.
- update 시 partial 업데이트 vs replace 정책.
- JSON 컬럼 직렬화/역직렬화 round-trip.

### 4.7 studystats (Phase 3 예정)
**`StreakCalculator`** (단위): 가장 ROI 높은 단위테스트.
- 오늘만 있음 → streak 1
- 오늘 없고 어제 있음 → today not yet recorded — streak 1 (어제부터 카운트)
- 연속 5일 → streak 5
- 중간 갭 → 갭에서 끊김
- freezeUsed=true인 날 → 연속 유지

**`DailyStudySummaryRepository.longestStreak`** (통합): SQL window 함수 검증. 다양한 날짜 시퀀스 + 갭 패턴.

**`StudyStatsService.getHeatmap`**: 잘 정의된 기간 내 날짜별 reviewCount 정확성.

### 4.8 batch — KoreanLyricTranslationService (Phase 4 예정)

**가장 까다로운 도메인.** 코루틴 + 스케줄러 + 외부 API 3중 의존.

**전략:**
- `@Scheduled`는 테스트에서 끔: `@TestPropertySource(properties = ["spring.task.scheduling.enabled=false"])` 또는 `@Profile("!test")` on the scheduled bean.
- `processTranslations()`을 **직접 호출**하여 검증.
- `@MockkBean(GeminiClient::class)`로 translateLyrics, lookupWordMeanings stub.
- 실제 KuromojiMorphologicalAnalyzer는 그대로 실행 (사전 동봉 — 외부 의존 없음).

**시나리오:**
- PENDING lyric 1개 → 정상 처리 → status=COMPLETED, analyzedContent JSON 검증.
- Gemini가 빈 결과 → retry 카운트 증가, 3회 초과 시 FAILED.
- BATCH_SIZE(5) 동시 처리 → 모두 COMPLETED.
- 토큰 1:1 매칭 — 토큰 수와 LLM meaning 수가 다를 때 처리.

**`FreezeConsumeScheduler`** (cron 04:00 KST):
- `processFreeze()` 직접 호출.
- 어제 freeze 사용 → DailyStudySummary에 freezeUsed=true 기록 검증.

---

## 5. AI 에이전트 작성 룰

코드 변경 시 AI 에이전트는 다음 룰에 따라 테스트를 함께 추가/수정한다.

### Rule 1 — 신규 컨트롤러 endpoint
신규 `@GetMapping`/`@PostMapping` 추가 시 **반드시** 다음 4종 케이스를 포함한 테스트 작성:
- 정상 케이스 (200 + 응답 검증)
- 인증 누락 (401)
- 입력 검증 실패 (400)
- 권한 위반 / 다른 user 자원 접근 (403 또는 404)

### Rule 2 — 신규 서비스 메서드
서비스 메서드 추가 시:
- DB·이벤트 발행 있음 → 통합테스트 (BaseIntegrationTest 상속)
- 순수 계산 → 단위테스트
- 외부 API 호출 → `@MockkBean` 사용

### Rule 3 — 신규 native @Query
**무조건 통합테스트 작성.** H2/in-memory에서 동작해도 MySQL에서 깨지는 케이스가 자주 발생하므로 Testcontainers로 검증.

### Rule 4 — Spring Event 추가/변경
신규 event class 또는 listener 추가 시:
- `@RecordApplicationEvents`로 발행 검증
- listener의 side effect (DB write, 다른 event publish)까지 검증

### Rule 5 — FSRS / 알고리즘 변경
스케줄링·streak·정규화 등 알고리즘 변경 시:
- 변경 전 테스트가 모두 통과하는지 먼저 확인
- 의도된 동작 변화는 테스트 expectation 업데이트와 함께 커밋

### Rule 6 — 외부 API 통합
신규 클라이언트 추가 시:
- `@MockkBean`으로 stub 가능하도록 interface or open class로 작성
- 도메인 서비스에서 사용하는 통합테스트는 클라이언트 mock 필수

### Rule 7 — 테스트 깨짐 = 즉시 stop
AI가 코드 변경 후 테스트가 실패하면 **테스트를 우회·삭제하지 말고 사용자에게 보고.** 의도된 동작 변경인지, 회귀인지 사용자가 판단.

### Rule 8 — Given/When/Then 구조 강제
신규 통합 테스트 작성 시:
- `// Given`, `// When`, `// Then` 주석 명시.
- Given: 빌더 또는 Mother 사용 (얕은 ↔ 깊은 분기 룰). 서비스 호출은 예외 — 한 줄 주석으로 사유 명기.
- When: 서비스 직접 호출만. 빌더/Mother 호출 금지.
- Then: 단언만. 셋업·행동 금지.

### Rule 9 — 빌더에 알고리즘 출력 필드 setter 금지
신규 빌더 작성 시 운영 로직이 계산하는 필드(예: FSRS `stability`/`difficulty`/`due`, `Lyric.analyzedContent`, 집계 컬럼) 의 setter 를 노출하지 말 것. 그런 상태가 필요한 테스트는 Mother 로 가거나 인라인 서비스 호출로 셋업.

### Rule 10 — 시간 의존 코드는 `Clock` 주입
운영 코드에 `Instant.now()`, `LocalDateTime.now()`, `LocalDate.now(...)` 직접 호출 금지. `Clock` 빈 주입 후 `Instant.now(clock)` 형태로. 테스트는 `MutableClock.advance(Duration)` 으로 시간 통제.

### Rule 11 — Mother 추출 임계점
깊은 Given 셋업이 **2개 이상의 테스트에서 공유될 때만** Mother 메서드로 추출. 한 번만 쓰는 복합 셋업은 인라인으로 두고, 두 번째 사용 시점에 Mother 로 옮긴다.

---

## 6. 새 도메인 추가 시 체크리스트

1. [ ] 컨트롤러 추가 → `@WebMvcTest` 슬라이스 1개 + `BaseIntegrationTest` 상속한 보안 통합테스트 1개.
2. [ ] 서비스 추가 → 통합테스트 (이벤트·트랜잭션·DB 검증). 모든 통합 테스트는 Given/When/Then 구조.
3. [ ] 시간 의존 로직 있음 → `Clock` 주입, 운영 코드 `now()` 직접 호출 금지.
4. [ ] 리포지터리 native query 있음 → 별도 RepositoryTest (BaseIntegrationTest 상속).
5. [ ] 외부 API 호출 → 의존하는 클라이언트 빈 `@MockkBean` 처리 (부모에 없으면 부모에 추가, 자식에 직접 추가는 가능한 피함).
6. [ ] 도메인 경계 넘는 Spring Event 발행 → `@RecordApplicationEvents`로 발행 검증, listener별 side effect 검증.
7. [ ] 픽스처 빌더 추가 → `test/fixtures/`에 도메인 builder. 알고리즘 출력 필드 setter 노출 금지.
8. [ ] 깊은 Given 이 2개 이상 테스트에서 반복되면 → `test/mothers/`에 Mother 메서드 추출.
9. [ ] 이 문서의 "도메인별 가이드" 섹션 업데이트 — 추후 변경 시 참고.

---

## 7. 실행 명령어

```bash
cd backend                                                 # gradlew는 backend/에 있음

./gradlew :api:test                                        # api 모듈 전체 테스트
./gradlew :api:test --tests "*FlashcardServiceTest"        # 단일 테스트 클래스
./gradlew :api:test --tests "*FlashcardServiceTest.reviewCard publishes*"  # 단일 테스트 메서드

./gradlew :batch:test                                      # batch 모듈
./gradlew test                                             # 전체 모듈

./gradlew :api:test --rerun-tasks                          # gradle 캐시 무시
./gradlew :api:test --info                                 # 상세 로그 (왜 실패했는지 추적할 때)
```

**Testcontainers 컨테이너 재사용 활성화 (1회만):**
```bash
echo "testcontainers.reuse.enable=true" >> ~/.testcontainers.properties
```

---

## 8. 병렬 실행 정책

테스트 병렬화는 4개 층위에서 가능하지만, 이 프로젝트는 **단일 JVM 순차 실행**을 기본으로 한다.

| 층위 | 옵션 | 사용 여부 | 이유 |
|---|---|---|---|
| 모듈 간 task 병렬 | `--parallel`, `org.gradle.parallel=true` | **금지** | 모듈마다 별 JVM이 동시에 컨테이너 reuse 시도 → cross-JVM race로 컨테이너 N개 생성 가능 |
| 모듈 내 JVM fork 분기 | `maxParallelForks > 1`, `forkEvery > 0` | **금지** | fork마다 ApplicationContext 새로 빌드 (캐시 손실), 컨테이너 race, RAM N배. DB 동시성 충돌은 그대로 |
| 통합테스트 클래스/메서드 병렬 | JUnit 5 `@Execution(CONCURRENT)` | **금지** | 같은 ApplicationContext의 mock·event·connection pool을 동시 스레드가 충돌 → silent flaky 다발 |
| **단위테스트만 메서드 병렬** | JUnit 5 `@Execution(CONCURRENT)` (unit test source set) | **추후 허용 검토** | 단위테스트는 ApplicationContext·DB 미사용이라 격리 문제 없음. Phase 5쯤 source set 분리 + 적용 |

`backend/gradle.properties`에 `org.gradle.parallel=false` 명시. CI에서도 동일 정책 유지.

병렬화로 시간 단축이 필요해지는 시점:
- 통합테스트가 100개 이상 누적되어 단일 JVM 순차로 5분을 넘기면 — **그때 컨테이너 분리(`maxParallelForks` + `withReuse(false)`)** 만 검토. 픽스처 격리(같은 DB에서 row 충돌 회피) 방식은 **시도하지 않음** — silent flaky 비용이 회귀 방지 ROI를 초과.

---

## 9. FAQ

**Q. 테스트가 너무 느려요.**
A. 컨테이너 재사용이 켜져 있는지 확인 (`~/.testcontainers.properties`). 그래도 느리면 단위테스트 중심으로 옮길 수 있는 케이스인지 검토. 도메인 협력이 본질이면 통합 유지.

**Q. H2를 쓰면 안 되나요?**
A. `DailyStudySummaryRepository.longestStreak`(window function)와 JSON 컬럼 검색이 H2와 호환 불가. 한 번 H2로 통과해도 prod에서 깨지는 사례가 발생. 항상 Testcontainers 사용.

**Q. 외부 API를 실제 호출하는 테스트는 절대 안 되나요?**
A. **CI/일반 테스트에선 절대 금지.** 별도 `@Tag("contract")` 태그를 단 contract test로 격리하고, 수동 또는 야간 빌드에서만 실행. (현 시점에선 작성 권장 안 함.)

**Q. flaky한 테스트는 어떻게 처리하나요?**
A. `@Disabled` 절대 금지. 원인 분석 후 fix 또는 testcontainers 격리·시간 의존 제거로 해결. AI가 disable한 흔적이 보이면 사용자에게 즉시 보고.

---

## 10. 참고

- 이 문서의 Phase 1 인프라는 `.omc/plans/backend-testing-strategy.md`에 정의된 plan에 따라 구축됨.
- 후속 PR 진행 시 이 문서의 "도메인별 가이드" 섹션을 따라 작성하고, 작성 완료된 도메인은 ✅ 표시.
- 본 문서가 outdated되면 (라이브러리 업그레이드, 도메인 구조 변경) 즉시 갱신.
