# API Application Instructions

## Scope

Applies to `backend/api/`.

## Rules

- Keep this module focused on public user REST API behavior.
- Controllers, HTTP request/response DTOs, user-facing query workflows, product/read-model caches, and API-local services belong here.
- Do not put schedulers, Spring Batch jobs/steps, or background polling workers here.
- Do not depend on `domains:translation`; lyric translation execution is worker-owned. api only enqueues the work.
- Prefer using domain services/methods for mutation paths. Avoid raw entity field updates that bypass invariants.
- Keep `@SpringBootApplication` scan narrow to the API package. Domain/integration beans should come from module AutoConfiguration.
- Add integration tests here when behavior spans several domain modules.
- `GET /api/study-stats/heatmap` 은 구버전 앱·다른 유저 프로필이 쓰므로 `/calendar` 가 있어도 지우지 않는다.
- 분석 제보 유형 목록은 서버 enum `SongReportType` 이 소유한다(`GET /api/song-reports/types`). 앱에 유형을 하드코딩하지 않는다.
- 프로필 이미지는 앱이 presigned URL 로 R2 에 직접 PUT 하므로 서버는 업로드 내용을 못 본다 → `PUT /api/users/me/profile-image {key}` 확정 때 HEAD 로 크기(5MB)·타입을 검사하고 이전 객체를 지운다.
