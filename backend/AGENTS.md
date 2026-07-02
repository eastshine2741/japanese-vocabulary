# Backend Instructions

## Scope

Applies to all files under `backend/`.

## Required Habits

- Always run Gradle from this directory: `./gradlew ...`.
- Keep application bootstraps (`api`, `admin-api`, `batch`) responsible only for application-local wiring.
- Domain and integration modules that provide Spring beans must own their AutoConfiguration.
- Do not use broad root component scan as a fallback wiring path.
- Do not add test `@SpringBootApplication` classes to domain modules.
- Put DB migrations in `migration/src/main/resources/db/migration/`; keep JPA entities and migrations aligned.

## Module Placement

- Put user-facing REST controllers and HTTP DTOs in `api`.
- Put admin REST controllers and admin DTOs in `admin-api`.
- Put schedulers, Spring Batch jobs/steps, and background workflow services in `batch`.
- Put external provider clients in `integrations/*`, not in domain modules.
- Put invariant-preserving domain state and persistence core in `domains/*`.

## References

- Module boundary background: `../docs/architecture/backend-modules.md`
- Song analysis pipeline: `../docs/architecture/song-analysis.md`
- Push notification flow: `../docs/architecture/push-notification.md`
