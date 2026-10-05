# MV 누락 분류

Kotonoha 곡 분석 파이프라인이 MV를 못 찾고 곡을 MV 없이 분석한 기록(`MV_SEARCH_DEFECT`)이 아래에 있다.
이 기록들을 **같은 원인끼리 묶고**, 묶음마다 셋 중 하나로 판정한다. 결과는 JSON 스키마대로만 답한다.

읽어야 할 문서: `docs/architecture/song-analysis.md` (MV 고르는 규칙).
코드는 `backend/worker/src/main/kotlin/com/japanese/vocabulary/song/service/YoutubeMvSearchService.kt`와
`backend/integrations/mv-search/` 만 본다. 수정은 하지 않는다 — 읽기 전용 단계다.

## 입력이 어떻게 만들어졌는지

- key는 `MV_NOT_FOUND:<아티스트> / <iTunes 제목>`. `surface`가 제목, `line`이 아티스트다.
- `detail.candidates`는 검색이 본 영상 전부다. 아티스트 채널 캐시가 있으면 그 채널 업로드 중 제목이 맞는 것
  (`source=uploads`), 그리고 넓은 검색 결과(`source=search`, 결과가 0건이라 조회수 순으로 다시 찾았으면
  `search:viewCount`).
- `rejection`이 있으면 순위 매기기 전에 걸러진 것이다: `title-mismatch`(제목 불일치), `shorts-tag`,
  `Shorts-length`(곡 길이 절반 이하), `over-length`(곡 길이 2배 초과).
- `rejection`이 null이면 순위까지 갔다가 졌다. `score < 0`(커버·가라오케·가사 영상 등 감점), `artistVerified=false`
  (채널도 제목도 아티스트와 안 맞음), `officialSource=false`(공식 출처 아님) 중 무엇에 걸렸는지 본다.
- 후보가 0개면 YouTube 검색이 아무것도 돌려주지 않은 것이다.

## 판정 기준

- `fix` — 후보 안에 이 곡의 쓸 만한 영상(공식 MV, 아티스트 본인 채널의 업로드, Topic 음원)이 있는데 규칙이
  떨어뜨렸고, 규칙을 고쳐도 다른 곡의 선택을 망치지 않는다. 예: 표기 차이(`丸ノ内`/`丸の内`)로 제목 불일치,
  합작·별칭 표기 때문에 아티스트 불일치, 공식 채널의 다른 형태 영상이 감점됨.
- `expected_no_mv` — 후보에 이 곡의 쓸 만한 영상이 정말 없다(커버·팬 영상·다른 곡뿐). 코드를 건드리지 않는다.
- `hold` — 원인은 짐작되지만 고치면 다른 곡에서 엉뚱한 영상을 고를 위험이 크거나(예: 특정 채널 별칭을 하드코딩),
  후보가 0개라 판단할 근거가 없거나, 판단이 안 서는 것.

원인이 같으면 한 PR로 고쳐야 하므로 묶는다. 원인이 다르면 아티스트가 같아도 나누라.

## fixPlan 작성 규칙 (`verdict=fix`일 때만)

- `files`: 손댈 파일의 저장소 상대 경로. `backend/worker/src/{main,test}/kotlin/com/japanese/vocabulary/song/service/`
  아래의 `YoutubeMvSearch*`/`MvSearchResult.kt` 파일이나 `backend/integrations/mv-search/` 아래여야 한다.
- `approach`: 무엇을 어떻게 바꿀지 2~3문장. 2단계의 수정 에이전트가 이것만 보고 시작한다.
- `testHint`: `YoutubeMvSearchServiceTest`에 이 곡의 실제 후보(제목·채널·길이)로 검색 결과를 스텁하는 테스트를
  어떻게 넣을지. 고른 영상의 videoId를 기대값으로 한다.
- `branchSlug`: 소문자 kebab-case. 러너가 `fix/analysis-` 접두어를 붙인다.
- 금지: 로그 레벨 변경, Sentry 설정, `application.yml`, `logback` — 신호를 끄는 건 수정이 아니다.

## reason

한국어 1~2문장. 왜 그 판정인지만 쓴다.

## 입력
