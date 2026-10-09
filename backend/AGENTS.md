# Backend Instructions

## Scope

Applies to all files under `backend/`.

## Required Habits

- Always run Gradle from this directory: `./gradlew ...`.
- Keep application bootstraps (`api`, `admin-api`, `worker`, `batch`) responsible only for application-local wiring.
- Domain and integration modules that provide Spring beans must own their AutoConfiguration.
- Do not use broad root component scan as a fallback wiring path.
- Do not add test `@SpringBootApplication` classes to domain modules.
- Put DB migrations in `migration/src/main/resources/db/migration/`; keep JPA entities and migrations aligned.

## Module Placement

- Put user-facing REST controllers and HTTP DTOs in `api`.
- Put admin REST controllers and admin DTOs in `admin-api`.
- Put queue consumers and the song-analysis workflow in `worker`.
- Put Spring Batch jobs/steps and `CronTask` implementations in `batch`. Do not add `@Scheduled`
  there — schedules live in `k8s/{dev,prod}/batch/cronjobs.yaml`.
- Put external provider clients and infra adapters (message queue) in `integrations/*`, not in domain modules.
- Put invariant-preserving domain state and persistence core in `domains/*`.

## References

- Module boundary background: `../docs/architecture/backend-modules.md`
- Song analysis pipeline (and its work queue): `../docs/architecture/song-analysis.md`
- Push notification flow: `../docs/architecture/push-notification.md`
