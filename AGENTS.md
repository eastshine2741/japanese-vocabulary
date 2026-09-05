# AGENTS.md

## Project Overview

Japanese learning app based on songs. Users pick a song they like, study its lyrics with synced playback, tap unfamiliar words to save them, and review saved vocabulary with flashcards.

**Core loop:** song -> lyric-based study -> vocabulary capture -> flashcard review -> better understanding

## Quick Reference

### Build & Run

`gradlew`는 `backend/` 디렉토리에 위치. 반드시 `backend/`에서 실행할 것.

```bash
./deploy.sh                                   # k3s에 backend(api+batch+admin-api+admin-web) + mysql + redis 배포
cd backend && ./gradlew :admin-api:test       # Admin API tests
cd admin-web && npm run dev                   # Admin Web (local, http://localhost:5174)
cd app-rn && npm test                         # App unit tests (vitest)
cd app-rn && npx expo run:android             # App - Android
cd app-rn && npx expo start --web             # App - Web (dev)
```

### Detailed Docs

- Feature development workflow (기획 -> 디자인 -> 개발 -> QA): `docs/workflow/feature-development.md`
- Backend module boundaries: `docs/architecture/backend-modules.md`
- Word 스키마와 song 결합 해제: `docs/architecture/word-schema.md`
- Song analysis and word-meaning pipeline: `docs/architecture/song-analysis.md`
- Translation pipeline guardrails: `docs/translation-pipeline.md`
- Push notification architecture: `docs/architecture/push-notification.md`
- Admin service: `docs/admin-service.md`
- Recommended songs: `docs/recommended-songs.md`
- k3s deploy and environment variables: `docs/runbooks/k3s-deploy.md`
- Mobile OTA release flow: `docs/runbooks/mobile-ota-release.md`
- Bottom sheet nested scroll: `docs/runbooks/bottom-sheet-nested-scroll.md`
- Pencil editing: `docs/runbooks/pencil-editing.md`

Directory-specific instructions live in nested `AGENTS.md` files. Each has a sibling `CLAUDE.md` that links to it with `@AGENTS.md`.

## Backend Module Structure

Multi-module Gradle (Kotlin DSL) at `backend/`. 항상 `backend/`에서 `./gradlew` 실행.

```text
backend/
├── common/                  — cross-cutting infra and test fixtures
├── migration/               — Flyway migrations
├── domains/                 — domain modules, no @SpringBootApplication
│   └── word/                — word + flashcard + deck. 학습 데이터 일체
├── integrations/            — external music provider clients
├── api/                     — user REST bootstrap
├── admin-api/               — internal admin REST bootstrap
└── batch/                   — scheduled/background job bootstrap
```

### Core Rules

- **batch가 의존하는 도메인은 최소화**. 필요한 도메인만 추가한다.
- **api는 사용자 API에 필요한 도메인 의존**. translation은 batch 전용 유지.
- **admin-api는 public api와 분리된 bootstrap**. v1은 inspection 중심이며 music integration module을 의존하지 않는다.
- **active module은 자기 Spring surface를 AutoConfiguration으로 선언한다**. `AutoConfiguration.imports` + `com.japanese.autoconfigure.*`를 사용하고, module bean은 module package `@ComponentScan`, JPA는 `@EntityScan`/`@EnableJpaRepositories`로 등록한다.
- **도메인 모듈은 persistence-aware domain core로 수렴**. entity/model/enum, domain method/service, invariant/state transition 중심으로 유지한다.
- **외부 API client는 domain core가 아니다**. iTunes/YouTube/LRCLIB/VocaDB client는 function-specific `integrations:*` 모듈에 둔다.
- **cache 위치는 의미로 결정한다**. product/read-model cache는 behavior owner application module에 둔다.
- **Admin write는 raw field update 금지**. 향후 mutation은 entity별 domain method/service를 통해서만 수행한다.
- **Spring Batch Job/Step config, Scheduler, job worker service는 batch bootstrap 모듈에만 둔다**.
- **통합테스트는 bootstrap 모듈(api/batch/admin-api)에 둔다**. 도메인 모듈에 테스트용 `@SpringBootApplication`을 만들지 않는다.

## Naming Rules

- **`entity/`**: JPA `@Entity`. 도메인 모듈 내부 전용. cross-module로 넘기지 말 것.
- **`dto/`**: 모든 클래스가 `Request | Response | Dto` 셋 중 하나로 끝나야 함. 한 파일에 하나의 클래스.
- **`model/`**: 도메인 내부 common value type. dto도 entity도 아닌 것.
- Entity -> Dto 변환은 `fun XxxEntity.toDto(): XxxDto` extension.

## Domain Layer Boundaries

```text
Inner:  Song, Lyric              — 콘텐츠 원본 (domains:song)
Outer:  Word, Flashcard, Deck    — 사용자 학습 데이터 (domains:word)
```

- 같은 모듈 내: 서비스 간 직접 호출.
- 모듈 경계를 넘을 때만 Spring Event 사용.
- 안쪽 계층이 바깥쪽 계층을 참조하면 안 됨.
- **word 도메인 → song 도메인의 물리적 FK는 `decks.song_id` 하나뿐**. 곡과 단어를 매핑하는 테이블은 만들지 않는다. 예문의 `songId`/`lineIndex`는 `words.senses` JSON 안의 논리 참조다.

### word / flashcard / deck 수명주기

`domains:word` 의 주인은 word 다. 세 수명주기를 `WordService` 가 **한 트랜잭션 안에서** 소유한다.

- **flashcard 는 word 와 수명주기가 같다.** word 저장 시 만들고 삭제 시 지운다. flashcard 없는 word 는 존재할 수 없다.
- **deck 은 word 보다 오래 산다.** 담을 때 없으면 만들지만, 안의 word 가 모두 지워져도 deck 은 남고 deck 을 지워도 안의 word 는 남는다.
- **모든 word 는 전체 단어장(`is_default = 1`)에 연결된다.** 전체 단어장은 유저당 1개이고 삭제할 수 없다.

### Spring Event Listeners

- 모듈 경계를 넘는 부수효과에만 쓴다. 같은 모듈이면 서비스를 직접 부른다 — 이벤트로 감싸면 불변식을 커밋 단위로 지킬 수 없다.
- `@TransactionalEventListener(phase = AFTER_COMMIT)` 안에서 DB 쓰기를 하려면 `@Transactional(propagation = REQUIRES_NEW)`를 같이 붙일 것.
- FK 선행 정리처럼 publisher 커밋 전에 끝나야 하는 listener는 `AFTER_COMMIT`을 쓰지 말고 같은 트랜잭션의 `@EventListener` + `@Transactional(propagation = MANDATORY)`로 처리할 것.
- 진짜 커밋 경계가 필요한 테스트(AFTER_COMMIT 리스너, 롤백, 동시성)는 `AfterCommitListenerTest` 상속, setup은 `inTx { ... }`로 감쌀 것.
- 이벤트 발행 검증은 기존 base + `@RecordApplicationEvents`.

## Current State

**Implemented:** Song search -> lyric fetch -> async batch word-meaning analysis -> study view, YouTube MV playback with synced lyrics, word save with meanings, flashcard review, decks, recent songs, user settings, push notifications, admin inspection surface.

**Backend modularization:** Multi-module Gradle split 완료. dto 규칙 적용. `@Scheduled`는 batch에만. notification 모듈은 FCM 전송 책임만, DB 조회는 batch가 담당하고 `PushNotificationDataPort`로 추상화. 학습 데이터는 `domains:word` 한 모듈로 통합됐다 — `word`/`flashcard`/`deck` package 가 같은 모듈에 있고 `WordService` 가 셋의 수명주기를 한 트랜잭션에서 소유한다. word↔deck 사이 Spring Event 는 제거됐다.

**Word 스키마 (V29):** 단어는 뜻(sense) 단위다. `words.senses` JSON 이 `{meaning, partOfSpeech, jlpt, examples[]}` 배열을 들고 있고, 예문은 sense 당 최대 5개다. `song_words`·`deck_flashcards` 는 제거됐고 deck 멤버십은 `deck_word(deck_id, word_id)` 가 갖는다. SongDetail 담김 판정은 `words` 를 `UNIQUE(user_id, japanese_text)` 로 한 번 조회한 뒤 곡이 제시한 뜻이 **전부** 저장돼 있는지 메모리에서 비교한다(ALL 판정). `PUT /api/words/{id}` 는 `senses` 전체 replace 다. 곡 분석이 주는 뜻은 "사랑, 애정" 같은 쉼표 문자열 하나라서 담기 직전에 조각마다 sense 로 쪼갠다 — 이미 담긴 조각엔 예문만 붙고 처음 보는 조각만 새 sense 가 된다. 예문은 **첫 조각만** 갖고, 한 가사 줄은 **뜻 하나에만** 붙는다(같은 줄이 뜻마다 반복되면 안 된다). `splitMeaningText`, 앱에도 같은 규칙이 있다. 설계 근거는 `docs/architecture/word-schema.md`.

**SongDetail 단어 순서:** `GET /api/songs/{id}/words` 의 `words` 는 곡 등장순이고, `lineWordIndexes[line]` 은 **그 줄 안에서 나온 순서**다 — 앱 가사 시트는 이 순서를 그대로 쓴다(재정렬 금지). 중요도는 배열 순서가 아니라 `importanceScore` 로 따로 매긴다: 서버는 `wordSummary.topWords`, 앱은 `selectMajorWords`·단어 탭 정렬. `WordCandidateGenerator` 가 `lineCandidates` 에 줄 안 순서를 굽기 때문에, **이미 분석된 곡은 재생성해야 새 순서가 적용된다** — batch 의 `POST /api/dev/lyric-word-candidates/backfill?regenerate=true`.

**Word Meaning Pipeline (jisho entry 경계):** 사전 entry 는 `(headword, reading)` 페어다. **senseId 는 사전 뜻 하나를 가리킨다 — occurrence 가 아니다.** `LexicalResolver` 가 (baseForm, entry headword/reading, 영어 gloss, raw POS, provenance) 로 id 를 나눠서, 후렴에 여섯 번 나오는 단어도 sense-translate 를 한 번만 탄다. 예전엔 occurrence 마다 id 를 발급해 같은 뜻이 줄마다 따로 번역됐고(`シャイ` → 수줍음이 많은/수줍은/수줍어하다) 그게 한 단어의 비슷한 sense 여러 개로 저장됐다. **sense-translate 는 뜻을 하나만 준다** — 뜻 문자열은 담을 때 쉼표로 쪼개지므로 유의어를 나열하면 sense 가 늘어난다(조사는 예외). segmentation 은 사전 표제어가 아닌 결합을 쪼갠다: 長くない → 長く/ない, 置いてった → 置いて/った, 納豆巻き → 納豆/巻き. **분절은 일본어 단어만 낸다** — 공백·기호·라틴은 토큰이 아니다. 앵커링이 버리고 앱이 토큰 사이 틈을 원문에서 되읽는다. 원문에 없는 공백을 토큰으로 내면 뒤쪽의 진짜 공백에 매칭돼 커서가 그 사이 단어들을 건너뛰고, 멀쩡한 단어가 "순서에 없다"고 지적당한다(`涼しい風吹く 青空の匂い` 의 `風`). 재시도는 temperature 를 올린다 — 0 에서는 같은 출력이 그대로 다시 온다. **같은 텍스트의 줄은 한 번만 분절한다** — 청크가 갈리면 같은 후렴 줄이 서로 다르게 분절돼서, 한쪽은 `帰る`, 다른 쪽은 `帰れない` 를 표제형으로 내고 뜻을 잃었다. 분절 결과에는 코드 검증 두 개가 붙는다. **조사 접착은 `GluedParticleSplitter` 가 쪼갠다** — `surface == headword + 조사1자`(`何を`) 또는 `surface` 가 headword 에 없는 조사로 시작(`がある`)이면 모델이 자기 출력끼리 모순한 것이다. 다만 붙은 형태가 사전 표제어면(`いつも`, `ように`) 손대지 않고, 발음이 안 떨어지거나 조회가 실패하면 그대로 둔다 — 안 쪼개면 표시만 어긋나지만 잘못 쪼개면 멀쩡한 단어가 부서진다. 대상 조사는 `は を が も`(뒤) / `が を の も`(앞) 뿐이다(`です`·`ねばった` 오탐 때문에 `で`·`ね` 제외). **headword 가 사전에 없으면 그 줄만 한 번 재분절한다**(`LexicalResolver.unresolvedTokens`, `RuleMeaningProvider` 뒤에 검사 — 안 그러면 조사·조동사가 전부 미스로 잡힌다). **앵커링 실패는 두 등급이다.** surface 가 원문에 없거나 순서가 어긋나면 위치를 못 쓰니 소진 후 곡을 죽인다. **덮이지 않은 텍스트는 죽이지 않는다** — 나온 surface 는 다 제 위치라 오프셋은 정확하고 단어만 빠진 것이다(`晴れ舞台（イェイ）` → `晴れ舞台` 로 4번 연속, 곡이 추임새 때문에 죽었다). `SegmentAnchoringResult` 가 `failuresByIndex`(재분절)와 `incompleteByIndex`(채택)로 나눠 준다. 덮이지 않은 텍스트와 사전 미스는 같은 등급이라 `MAX_DEFECT_RETRIES`(1) 예산과 '결함 수가 적은 시도 채택' 비교를 공유하고, 소진되면 WARN 만 남긴다. **조사 규칙은 headword 섹션이 아니라 분절 규칙에 둔다** — headword 만 `に` 로 바꾸라는 뜻으로 읽혀서 surface `にも` + 토큰 `も` 가 나와 `も` 가 두 번 세어졌다. 가타카나 전용(`チリン`)은 사전에 없는 게 정상이라 면제. 뜻이 빈 토큰은 `WordCandidateGenerator` 가 단어 후보에서 제외한다. `JishoClient.distill` 이 조회 결과를 페어 단위 entry 로 보존하고, `LexicalResolver` 가 segmentation 이 준 `(headword, baseFormReading)` 과 맞춰 **한 entry 로 좁힌 뒤 그 entry 의 sense 만** sense-select 에 넘긴다. 이전에는 모든 entry 의 모든 sense 가 경계 없이 한 배열로 합쳐져, `前` 조회에 前[マエ]·前[ゼン]·先[サキ] 의 뜻이 섞였다. 페어가 entry 하나를 특정할 때만 `EXACT` 다 — 가나 표제어(`かける` → 掛ける/賭ける/欠ける 전부 カケル)처럼 페어가 여러 entry 에 걸리면 `AMBIGUOUS_HEADWORD` 로 라벨을 붙여 넘긴다. reading 이 어긋날 때도 후보 entry 수에 따라 `APPROVED_FALLBACK` / `AMBIGUOUS_HEADWORD` 로 완충한다. **가사가 가타카나로 쓴 native word 는 조회 스크립트를 맞춰줘야 한다** — jisho 검색이 스크립트에 민감해서 `distill` 의 reading 비교를 카타카나로 정규화하고(`アタシ` 의 상위 히트가 私[あたし] 인데 문자열이 달라 탈락했다), 가타카나 전용 headword 가 미스면 히라가나로 한 번 더 조회한다(`hiraganaProbe`: `アンタ` 는 アンタレス 만 주고 貴方 를 안 준다). baseForm 이 `あたし` 로 수렴해서 분절이 스크립트를 알아서 정규화한 줄과 한 단어로 합쳐진다 — 한 곡 안에서 같은 `アタシ` 가 줄마다 뜻이 있고 없었다. 스크립트를 바꿀 뿐 entry 를 만들지는 않으니 `ステンバイミー` 같은 조어는 여전히 미스다. **후보 sense 가 1개면 LLM 을 부르지 않고 코드가 확정한다.** 발음은 **카타카나**로 통일했다 — `JapaneseText.toKatakana` 가 유일한 정규화 지점이고, `Token.reading` 이 그 줄에서 실제로 불리는 발음이다. **조사는 표기와 발음이 다르다** — `JapaneseText.particleReading` 이 `は`→ワ, `へ`→エ 로 바꾼다(`には`→ニワ). 모델은 넷 중 셋만 ワ 로 주고 rule 표는 자기 표면형을 전사해 늘 ハ 를 줬으니 서버에서 확정한다. `を` 는 ヲ 로 둔다 — `オ` 는 앞 음절에 장음으로 먹힌다. **표제형 surface 는 사전 리딩을 쓴다** — 모델이 같은 토큰에서 사전이 적어준 발음을 틀린다(`痛々しい` → イタタマシイ / 사전 イタイタシイ, `腹立たしい` → ハラタタシイ / ハラダタシイ). `surface == baseForm` 이고 entry 가 모호하지 않을 때(`EXACT`/`APPROVED_FALLBACK`)만 — 아니면 sense-select 가 고른 entry 를 리딩이 따라간다. 작은 가나 표기 차이(ハァ/ハア)는 교정이 아니다. **rule 표 리딩은 fallback 이지 override 가 아니다** — 표가 headword 로 키를 잡아서 `なんだ`→だ, `だった`→だ 같은 긴 surface 가 모라를 잃었다(`馬鹿だった` → 바카다). `AssembleAnalyzedLinesStage` 가 `usedReading` 을 먼저 쓰고, 표 값은 rewrite 가 만든 토큰처럼 자기 리딩이 없을 때만 쓴다. **줄 발음은 저장하지 않는다** — 클라이언트가 토큰에서 조립한다(앱 `convertLineReading`, admin-web `buildLineReading`). 단어 경계에 공백을 넣고(조사·조동사·접미사, ッ/ン 로 시작하는 리딩, 앞이 한자·가타카나인 전히라가나 토큰은 앞에 붙임 — 명사가 연달으면 과분할된다), 토큰이 안 덮은 일본어는 원문 복사 대신 공백으로 바꾸고(그대로 복사하면 한국어 줄에 일본어가 박힌다 — `叫べべベノム` → 사케베べ베노무), 받침은 토큰 경계를 넘지만 장음은 못 넘는다(`だ`+`って` → 닷테 / `ボクノ`+`ウタ` → 보쿠노 우타). 조립된 문자열은 그 경계를 잃어서 저장할 수가 없다. 한글 쪽 규칙은 `katakanaToKorean` 에 있다 — 장음은 반복 음절로 적고 표시만 `-` 로 해서 받침이 얹히면 음절이 드러나고(`ワンシーン` → 완시인, `せいって` → 세잇테), 장음은 한 번 쓰면 소진되고(`エイエン` → 에-엔), 앉을 자리 없는 촉음은 버리고(`喰わん`+`って` → 쿠완테), 외래음 조합은 한 음절이라 뒤 모음 가나로 안 늘어난다(`イェイ` → 예이). 단어가 없는 줄은 독음을 그리지 않는다. `AnalyzedLine.pronounciation`·`koreanPronounciation` 과 그 DTO 필드는 제거됐다 — 구 행은 `JsonListConverter` 가 unknown key 를 무시해서 계속 읽히지만, **토큰 리딩이 기본형(`欲しかった` → `ホシイ`)이라 재분석해야 한다.** 이제 그걸 알려주는 필드가 행에 없다. 조사 발음·rule 표 fallback 규칙보다 먼저 쓰인 행도 같은 이유로 재분석해야 한다. 재분석은 `song_analysis_work` 행을 PENDING 으로 넣으면 `SongAnalysisWorkScheduler`(30초 폴링)가 집어간다. jisho 캐시 키는 `jisho:v5:` — `distill` 이 같은 응답을 다르게 distill 하게 바뀌면 캐시된 값이 옛 판정을 TTL 만큼 붙잡으니 같이 올린다. 설계 근거는 `docs/translation-pipeline.md`.

**Admin surface:** `backend/admin-api` exposes `/admin/api/auth/login`, `/admin/api/songs`, `/admin/api/lyrics`, `/admin/api/song-analysis-works`, and `/admin/api/users`. `admin-web` is a Vite React TypeScript shadcn-style SPA. Dev 는 `/<namespace>/admin` 경로로, prod 는 `https://kotonoha.eastshine.dev/admin` (API 는 `/admin/api`) 한 호스트로 배포된다 — path 별 미들웨어가 필요해 Traefik `IngressRoute` 를 쓴다. See `docs/admin-service.md`.

**Partial coverage:** Backend integration tests for new domains; broader e2e tests still pending.

## Conventions

- Backend package root: `com.japanese.vocabulary.<domain>`. Music provider clients live in function-specific `integrations:*` modules and use `RestClient` where behavior is equivalent.
- DB migrations: `backend/migration/src/main/resources/db/migration/`. 새 테이블은 여기에 `V_숫자` SQL로 추가. 도메인 모듈의 JPA `@Entity`와 migration이 일치해야 함.
- App: Zustand stores by domain, Axios with auth interceptor, `StyleSheet.create()` co-located with components.

### Frontend Performance Rules

- **Zustand 셀렉터 필수**: `useStore()` 금지. 반드시 `useShallow` 또는 개별 셀렉터 사용.
- **React.memo**: 리스트 아이템, 반복 렌더링되는 컴포넌트에 적용.
- **useCallback**: 자식 컴포넌트에 전달하는 이벤트 핸들러에 적용.
- **인라인 함수 금지**: `renderItem` 안에서 인라인 콜백 대신, 자식 컴포넌트가 prop으로 받아 내부에서 호출.
- **useMemo**: 비용이 있는 렌더 경로 계산에 적용.

## Execution Rules

- Treat the sprint request as the source of truth for current priorities.
- Do not expand scope unless explicitly requested.
- Prefer simple end-to-end value over partial systems.
- Surface missing decisions early.
- When making changes that affect project structure, API contracts, DB schema, tech stack, or architecture decisions, update `AGENTS.md` or the relevant linked doc.
