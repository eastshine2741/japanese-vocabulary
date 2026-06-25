# API Application Instructions

## Scope

Applies to `backend/api/`.

## Rules

- Keep this module focused on public user REST API behavior.
- Controllers, HTTP request/response DTOs, user-facing query workflows, product/read-model caches, and API-local services belong here.
- Do not put schedulers, Spring Batch jobs/steps, or background polling workers here.
- Do not depend on `domains:translation`; lyric translation execution is batch-owned.
- Prefer using domain services/methods for mutation paths. Avoid raw entity field updates that bypass invariants.
- Keep `@SpringBootApplication` scan narrow to the API package. Domain/integration beans should come from module AutoConfiguration.
- Add integration tests here when behavior spans several domain modules.
