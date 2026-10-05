# MV 누락 수정

이 워크트리는 `origin/main`에서 막 갈라졌다. 아래 묶음의 곡이 MV 없이 분석된 원인을 고치고, 결과를 JSON
스키마대로만 답한다.

읽어야 할 문서: `docs/architecture/song-analysis.md`. 저장소의 AGENTS.md 규칙을 따른다.
Gradle은 반드시 `backend/`에서 실행한다:
`cd backend && ./gradlew :worker:test --tests com.japanese.vocabulary.song.service.YoutubeMvSearchServiceTest`.
이 형태 그대로만 허용된다 — 파이프(`| tail`)나 리다이렉트(`2>&1`)를 붙이면 권한 규칙에 걸려 실행되지 않는다.

## 해야 할 것

1. `YoutubeMvSearchServiceTest`에 결손 상세의 **실제 후보**(제목·채널명·길이, 나온 순서 그대로)로
   `youtubeClient`를 스텁하는 테스트를 먼저 추가한다. 쓸 만한 영상의 videoId가 골라지는지 확인한다. 이 테스트는
   지금 코드에서 실패해야 하고, 고친 뒤 통과해야 한다. 러너가 `origin/main`과 이 브랜치 양쪽에서 돌려 확인한다 —
   실패→통과가 아니면 PR이 만들어지지 않는다.
2. 가장 작은 변경으로 고친다. 같은 유형이 다시 안 생기게 하는 변경이면 되고, 그 이상은 하지 않는다.
3. 테스트 클래스 전체를 돌려 기존 테스트도 통과하는지 확인한다. 기존 테스트는 다른 곡에서 엉뚱한 영상을 고르지
   않는다는 보장이다 — 기존 테스트를 고쳐서 통과시키지 않는다.

## 하지 말 것

- `YoutubeMvSearch*`/`MvSearchResult.kt` 파일과 `backend/integrations/mv-search/` 밖의 파일을 바꾸지 않는다.
- 특정 곡·아티스트·채널 이름을 코드에 박지 않는다. 규칙을 고친다.
- 로그 레벨을 낮추거나 `logger.warn`/`logger.error`를 지우지 않는다. Sentry 설정, `application.yml`, `logback`을
  건드리지 않는다. 러너가 diff에서 이걸 찾으면 PR을 버린다.
- git 명령을 쓰지 않는다. 커밋·푸시는 러너가 한다.
- 고칠 수 없다고 판단되면 파일을 되돌릴 필요 없이 `status=gave_up`으로 답하고 `reason`에 이유를 쓴다.

## 답의 각 필드

- `commitTitle`: 한국어, 72자 이내. 커밋과 PR 제목에 그대로 쓰인다. 저장소 컨벤션 예:
  `MV 검색: 합작 아티스트의 멤버 채널도 본인 채널로 본다`.
- `why`: 한국어 3문장 이내. 왜 이 곡의 영상이 떨어졌는지 — 어느 규칙이 어떻게 판단했는지.
  곡 목록을 반복하지 않는다(PR 본문에 러너가 따로 넣는다).
- `how`: 한국어 3문장 이내. 무엇을 바꿨는지.
- `gradleTask`: `:worker:test`.
- `testClass`: 추가한 테스트의 클래스 FQCN. 러너가 `--tests`에 그대로 넣는다.

`why`와 `how`는 PR을 읽는 사람이 30초 안에 이해하는 게 목적이다. 접속사로 문장을 늘리지 말고, 확신 없는
표현("~일 수 있습니다", "~로 보입니다")을 쓰지 않는다. 사실만 쓴다.

## 입력
