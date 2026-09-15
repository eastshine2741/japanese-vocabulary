# 분석 결손 분류

Kotonoha 곡 분석 파이프라인이 단어를 뜻 없이 내보낸 기록(`ANALYSIS_DEFECT`)이 아래에 있다.
이 기록들을 **같은 원인끼리 묶고**, 묶음마다 셋 중 하나로 판정한다. 결과는 JSON 스키마대로만 답한다.

읽어야 할 문서: `docs/translation-pipeline.md`, `docs/architecture/song-analysis.md`.
코드는 `backend/domains/translation/` 아래만 본다. 수정은 하지 않는다 — 읽기 전용 단계다.

## 입력이 어떻게 만들어졌는지

- `cause=DICTIONARY_MISS`: jisho가 응답했고, `headword`로도 규칙(`RuleMeaningProvider`)으로도
  i-형용사·히라가나 재조회로도 항목을 못 찾았다. 분절 모델이 원형을 잘못 잡았거나, 구어 축약이거나,
  사전에 정말 없는 말이다.
- `cause=UNCOVERED`: 가사 줄의 일본어 일부가 어떤 surface에도 안 잡혔다. `surface`가 그 글자다.
- `cause=SENSE_REJECTED`: sense-select 모델이 제시받지 않은 senseId를 골라 뜻이 버려졌다.
- `PROVIDER_ERROR`는 여기 오지 않는다. 러너가 앞에서 걸러낸다.

## 판정 기준

- `fix` — 코드로 고칠 수 있고, 고치면 같은 유형이 다시 안 생긴다. 예: 구어 축약(`しなきゃ`, `じゃなくて`)이
  `RuleMeaningProvider`에 없음, 가능형 활용(`買えれ`→`買える`)의 원형 복원, `々`나 장음 `ー`가 커버리지에서
  빠짐, 히라가나 재조회 조건 누락.
- `expected_no_meaning` — 감탄사·의성어·애드립·조어(`あぁ`, `ぱっぱらぱ`, `ぐわんぐわん`)처럼 사전 뜻이 없는 게
  맞는 것. 코드를 건드리지 않는다.
- `hold` — 원인은 짐작되지만 프롬프트나 모델 동작을 바꿔야 해서 자동 PR로는 위험하거나, 판단이 안 서는 것.

한 묶음에 여러 key를 넣어도 된다. 원인이 같으면 한 PR로 고쳐야 하므로 묶는다.
원인이 다르면 headword가 비슷해도 나누라.

## fixPlan 작성 규칙 (`verdict=fix`일 때만)

- `files`: 손댈 파일의 저장소 상대 경로. `backend/domains/translation/` 아래여야 한다.
- `approach`: 무엇을 어떻게 바꿀지 2~3문장. 2단계의 수정 에이전트가 이것만 보고 시작한다.
- `testHint`: 실제 가사 줄로 재현하는 테스트를 어느 테스트 클래스에 어떤 식으로 넣을지.
- `branchSlug`: 소문자 kebab-case. 러너가 `fix/analysis-` 접두어를 붙인다.
- 금지: 로그 레벨 변경, Sentry 설정, `application.yml`, `logback` — 신호를 끄는 건 수정이 아니다.

## reason

한국어 1~2문장. 왜 그 판정인지만 쓴다.

## 입력
