# 분석 결손 수정

이 워크트리는 `origin/main`에서 막 갈라졌다. 아래 묶음의 결손을 고치고, 결과를 JSON 스키마대로만 답한다.

읽어야 할 문서: `docs/translation-pipeline.md`. 저장소의 AGENTS.md 규칙을 따른다.
Gradle은 반드시 `backend/`에서 실행한다: `cd backend && ./gradlew :domains:translation:test --tests <클래스FQCN>`.
이 형태 그대로만 허용된다 — 파이프(`| tail`)나 리다이렉트(`2>&1`)를 붙이면 권한 규칙에 걸려 실행되지 않는다.

## 해야 할 것

1. 결손이 난 **실제 가사 줄**을 그대로 쓰는 테스트를 먼저 추가한다. 이 테스트는 지금 코드에서 실패해야 하고,
   고친 뒤 통과해야 한다. 러너가 `origin/main`과 이 브랜치 양쪽에서 돌려 확인한다 — 실패→통과가 아니면 PR이
   만들어지지 않는다.
2. 가장 작은 변경으로 고친다. 같은 유형이 다시 안 생기게 하는 변경이면 되고, 그 이상은 하지 않는다.
3. 그 테스트 클래스를 돌려 통과를 확인한다.

## 하지 말 것

- `backend/domains/translation/` 밖의 파일을 바꾸지 않는다.
- 로그 레벨을 낮추거나 `logger.warn`/`logger.error`를 지우지 않는다. Sentry 설정, `application.yml`, `logback`을
  건드리지 않는다. 러너가 diff에서 이걸 찾으면 PR을 버린다.
- git 명령을 쓰지 않는다. 커밋·푸시는 러너가 한다.
- 고칠 수 없다고 판단되면 파일을 되돌릴 필요 없이 `status=gave_up`으로 답하고 `reason`에 이유를 쓴다.

## 답의 각 필드

- `commitTitle`: 영어, 명령형, 소문자 시작, 72자 이내. 저장소 컨벤션 예: `retry Gemini calls on transport failures`.
- `why`: 한국어 3문장 이내. 왜 이 단어가 뜻을 잃었는지 — 파이프라인의 어느 지점이 어떻게 판단했는지.
  결손 목록을 반복하지 않는다(PR 본문에 러너가 따로 넣는다).
- `how`: 한국어 3문장 이내. 무엇을 바꿨는지. 파일 이름을 하나쯤 짚는 건 좋다.
- `gradleTask`: 테스트 클래스가 속한 모듈의 test 태스크. 예: `:domains:translation:test`.
- `testClass`: 추가한 테스트의 FQCN. 러너가 `--tests`에 그대로 넣는다.

`why`와 `how`는 PR을 읽는 사람이 30초 안에 이해하는 게 목적이다. 접속사로 문장을 늘리지 말고, 확신 없는
표현("~일 수 있습니다", "~로 보입니다")을 쓰지 않는다. 사실만 쓴다.

## 입력
