# Pen(구 Pencil) 편집

`.pen` 파일 편집 규칙. MCP 툴: `mcp__pen__execute` / `get_app_state` / `read_skill` / `get_style` / `browser`.

## 연결
- MCP 서버 키는 `pen`. 소켓·serverInfo 는 아직 `pencil` 이름(정상).
- AppImage 마운트 경로(`/tmp/.mount_Pen-<랜덤>`)는 실행마다 바뀐다 → `~/.claude.json` 의 `mcpServers.pen.command` 는 래퍼 `~/.local/bin/pen-mcp-server` 로. Pen 앱이 떠 있어야 함.
- 툴이 안 보이면: mcp 로그(`~/.cache/claude-cli-nodejs/<프로젝트>/mcp-logs-pen*/`)에서 ENOENT 확인 → `/mcp` 재연결 또는 세션 재시작(설정만 고치면 반영 안 됨).

## 대상 문서·저장
- `execute` 의 `filePath` 는 믿지 말 것 — evict 되면 다른 워크트리의 active editor 로 넘어간다. 쓰기 전 같은 호출에서 top-level 노드를 Print 해 대상 문서를 확인하거나, 유저에게 대상 .pen 을 앱에서 active 로 열어 달라고 할 것.
- MCP 에 save 없음. Update/Insert 는 에디터 메모리에만 반영 → 끝나면 유저에게 해당 탭에서 Ctrl+S 안내. `Export` 는 저장 전 상태도 디스크에 씀.
- 자동화(CLI): `pencil interactive -i FILE -o FILE` + `save()`, `PENCIL_CLI_KEY` 필요(issue-resolver). 로컬엔 CLI 미설치.

## 파일 포맷·병합
- `.pen` 은 jq 2-space 평문 JSON, 끝 개행 없음. merge conflict 는 top-level `children[]` 를 노드 id 단위로 비교해 해결, `ref` dangling·`descendants` 고아 키를 검사.
- Python `json.dumps(indent=2, ensure_ascii=False)` 라운드트립은 바이트 동일 → 두 .pen 병합 안전.
- 파일 간 component 참조 불가 → 앱 컴포넌트를 쓰는 마케팅 아트보드는 앱 .pen 안에 둔다.

## execute 함정
- 생성 직후 같은 호출의 `ctx.problems`(clipped)·`TakeScreenshot` 은 정착 전 상태라 틀리게 나온다 → 검증은 다음 호출에서.
- 함수는 호출 간 유지 안 됨(값만 유지) → 헬퍼는 매 호출 다시 선언, 노드 id 는 전역 변수로.
- 한 줄 `for (...) Delete(x)` 는 파서가 자름 → 중괄호로 감쌀 것.
- 텍스트 높이는 추측 금지(fontSize 28 → h≈41, lineHeight≈1.45). `ctx.bounds` 로 잴 것.

## Insert/Replace 가 렌더 안 될 때
- 증상: 노드가 안 보이고 `ctx.bounds.y` 가 raw `y` 보다 +50. `Replace()` 텍스트는 부모 alignItems 무시(x=0·음수).
- 기본 우회: 비슷한 기존 노드를 `Copy(원본, 부모, {오버라이드})` 로 만들고 Insert 노드는 지운다.
- Copy 후 `Move(…, index)` 하면 뒤 형제들 bounds 가 옛 위치에 고정 → 겹치는 형제도 각각 Copy → 같은 index 로 Move → 원본 Delete.
- flow 자식 Insert 가 부모 끝에 박히면: **같은 호출에서** `Update(새노드,{width:"fill_container"})` + `Update(부모,{layout:"vertical"})` 둘 다.
- `layoutPosition:"absolute"` Insert 오버레이는 아예 안 그려짐 → `Copy(노드, 같은부모, {x,y})` 후 원본 Delete.
- 컴포넌트 마스터 안 Insert 가 안 보이면 부모 그룹 통째로 Copy → 같은 index Move → 원본 Delete. id 가 바뀌니 인스턴스 `descendants` 키를 다시 매핑.

## 컴포넌트·override
- 마스터 자식을 지우면 인스턴스 override 가 고아가 됨: compact `descendants` 맵은 무시(겉보기 정상), expanded `ref` 포맷은 노드를 되살림. 고아가 있으면 마스터 Insert/Get 이 "node not accessible" 로 실패하기도.
- 지우기 전 `"ref": "<id>"` 와 `"<id>":` 두 형태로 grep 해 영향받는 인스턴스를 전수 정리.
- 인스턴스 자식은 Delete 불가 → `Update("inst/child",{enabled:false})` 또는 override 값 교정.
- `Update(inst,{descendants})`: 전체 맵이면 교체, 일부면 병합, `null` 로 키 삭제 불가. replacement override(`type` 있는 값)가 있으면 전체 맵 Update 가 "Node not found for override path" 로 실패 → compact 고아는 방치.
- `placeholder:true` 프레임은 스크린샷에 빈 박스 → 확인 전 `{placeholder:false}`(같은 호출 스크린샷은 여전히 blank).
- pen 에 scale 속성 없음 → 키울 땐 Copy 후 x/y/크기/폰트/패딩/gap/반경/선/그림자를 곱한다.

## 렌더 안 되는 속성
- 텍스트 `underline`/`strikethrough` 는 저장도 렌더도 안 됨 → 부모에 absolute rectangle(h 1.5, radius 1, y 는 bounds 중앙보다 ≈1.3px 위).
- 텍스트 `stroke` 는 저장만, 렌더 무시(앱 UI 에 Stroke 섹션 없음 = 렌더 안 됨) → effect 에 blur:0 그림자 8방향. 두께: 40~68px `(3,2)`, 26~28px `(2,1)`. 반투명 fill 은 먼저 불투명으로.
- 가는 선 확인은 `Export([id],"png",dir,{scale:6})` 후 확대.

## 그라디언트·텍스처
- linear `rotation` 은 향하는 방향, position 0 은 반대쪽 끝: 180 = 위→아래 스크림, 270 = 왼→오른쪽. 기존 파일 값을 근거로 삼지 말 것. 헷갈리면 불투명 빨강으로 찍어 확인.
- 카드 질감: `app-rn/assets/cards/*.png` 를 fill 배열에 image fill + `blendMode`(holo-etch colorDodge, brushed-metal·facet-a overlay). 무지개 그라디언트는 overlay — normal·colorDodge 는 밝은 아트에서 뿌옇게 뜬다.
