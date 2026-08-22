# Feature Development Workflow

기능 하나를 기획부터 QA까지 통과시키는 4단계. 각 단계는 다음 단계로 넘기는 산출물이 하나씩 있다.

```text
기획              디자인            개발                       QA
Product Intent -> Pencil 프레임 -> capsule -> 구현            수용 기준 체크
docs/product-    app-rn/*.pen      distributor -> implementer  (Product Intent)
intents/
```

## Source of Truth

- **제품 흐름, 노출 규칙, 범위**: Product Intent
- **시각, 인터랙션 디테일**: Pencil 프레임과 프레임 프롬프트
- capsule은 스펙이 아니라 **인덱스**다. 구현자는 capsule만 보고 코딩하지 않고 참조된 Pencil 프레임을 직접 읽는다.
- 둘이 충돌하면 흐름은 Product Intent, UI는 Pencil을 따르고 충돌을 보고한다.

## 1. 기획 — Product Intent

`docs/product-intents/_template.md`를 복사해 `docs/product-intents/<YYMMDD>-<기능명>`으로 작성한다.

- 사용자 목표, 현재 문제, 제품 목표, Scope/Non-goal, 주요 플로우, 사이드케이스 플로우
- **수용 기준**: 체크박스 목록. QA 단계에서 그대로 쓰는 완료 판정 기준이다.
- **결정 경계**: 구현자가 제품 확인 없이 정할 수 있는 것과, 제품 확인이 필요한 변경을 나눠 적는다. 크기·간격·토큰 수치는 구현자에게 위임한다.
- 로깅이 범위에 없으면 정량 측정 대신 수용 기준 QA로 완료를 판정한다고 명시한다.

예: `docs/product-intents/260712-recommended-songs`

## 2. 디자인 — Pencil

Product Intent를 근거로 Pencil Desktop 에이전트에 넣을 프롬프트 문서를 `<intent 파일명>-pencil-prompt.md`로 작성한다. 프롬프트에 넣을 것:

- 작업할 `.pen` 절대 경로와 "다른 경로면 편집하지 마" 지시
- 원본 프레임 복제 후 작업, 완성 프레임 이름 명시 (상태별로 하나씩)
- 확정된 문구, 확정된 UI 구조
- **금지 사항** 목록 (기획에서 배제한 요소를 그대로 옮긴다)
- 완료 전 자체 검토 체크리스트

`.pen` 편집 규칙은 `docs/runbooks/pencil-editing.md`를 따른다. 워크트리 경로를 `open_document`로 명시적으로 열고, MCP 편집은 에디터 메모리에만 남으므로 저장을 안내한다.

예: `docs/product-intents/260712-recommended-songs-pencil-prompt.md`

## 3. 개발 — Capsule 분배와 구현

스킬 두 개가 짝을 이룬다. Claude Code는 `.claude/skills/`, Codex는 `.codex/skills/`에서 읽는다.

**`pencil-capsule-distributor`** (마스터)

1. Product Intent와 프론트엔드 구조를 읽는다.
2. Pencil MCP로 프레임 트리와 프레임 프롬프트를 확인한다.
3. 독립 배정 가능한 단위로 쪼갠다: 스크린 셸, 반복 카드/행, 바텀시트, 플레이어 영역, 내비게이션 연동, 상태·데이터 연동.
4. 단위별 capsule을 쓴다. 색상·타이포·패딩처럼 Pencil에서 직접 읽을 수 있는 값은 복사하지 않는다.

**`pencil-frontend-implementer`** (서브에이전트)

1. capsule, 해당 영역 `AGENTS.md`, 참조된 Pencil 프레임, 기존 코드 경로를 읽는다.
2. capsule scope 안에서만 구현한다. 인접 UI를 다시 디자인하지 않는다.
3. 변경 파일, 구현 범위, 실행한 검사, 미해결 충돌을 짧게 보고한다.

**공통: Pencil MCP 연결이나 프레임 읽기가 실패하면 즉시 중단한다.** 재시도하지 않고, 기억 속 스크린샷을 쓰지 않고, 추측으로 capsule이나 코드를 만들지 않고 사용자에게 보고한다.

## 4. QA — 수용 기준 체크

Product Intent의 수용 기준 체크박스를 위에서부터 확인하고 채운다.

- 항목이 하나라도 미충족이면 3단계로 되돌린다.
- 기준 자체를 바꿔야 한다면 그건 제품 결정이므로 1단계로 올린다.
- 앱 실행과 화면 확인 방법은 `AGENTS.md`의 Build & Run을 따른다.

## 스킬 파일 배치

원본은 `.codex/skills/<skill>/SKILL.md` 하나뿐이고, `.claude/skills/<skill>/SKILL.md`는 거기를 가리키는 상대 경로 symlink다. 원본만 고치면 양쪽에 그대로 반영되므로 따로 복사할 것이 없다.

```bash
ls -l .claude/skills/*/SKILL.md   # -> ../../../.codex/skills/<skill>/SKILL.md
```

- **`.codex/` 쪽을 편집한다.** `.claude/` 경로로 열어 편집해도 결과는 같지만, 원본 위치를 기준으로 작업한다.
- 스킬을 새로 추가하면 `.claude/skills/<skill>/` 디렉토리를 만들고 같은 형태의 symlink를 걸어준다.
- `.codex/skills/*/agents/openai.yaml`은 Codex 전용 표시용 메타데이터이므로 미러링하지 않는다.
- `.gitignore`는 `.claude/*`를 무시하고 `!.claude/skills/`로 예외를 둔다. symlink 자체가 커밋되므로 다른 워크트리·머신에서도 그대로 동작한다.
