# Pencil Editing

Rules for editing `.pen` files.

- **워크트리 경로 확인 필수**: `get_editor_state` 반환 경로가 현재 작업 디렉토리와 다를 수 있음. 작업 전 `open_document`로 현재 워크트리의 `.pen` 파일을 명시적으로 열 것.
- **대화형 작업 (MCP)**: `batch_design` 변경은 에디터 메모리에만 반영됨. 작업 완료 후 유저에게 에디터에서 저장(Ctrl+S)하라고 안내할 것.
- **자동화 (CLI)**: Pencil CLI `pencil interactive -i FILE -o FILE`로 headless 편집 + `save()`로 디스크 저장 가능. issue-resolver 등 GUI 없는 환경에서는 CLI를 사용할 것. `PENCIL_CLI_KEY` 환경변수 필요.
