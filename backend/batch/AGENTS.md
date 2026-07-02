# Batch Application Instructions

## Scope

Applies to `backend/batch/`.

## Rules

- Put all `@Scheduled` jobs, Spring Batch jobs/steps, and background workflow workers here.
- Keep batch dependencies minimal; add only the domain/integration modules required by an actual job.
- Cross-domain read models for scheduled work belong here, not in domain modules.
- Batch may implement domain ports such as `PushNotificationDataPort` when the implementation needs broad cross-domain queries.
- External provider orchestration for song analysis belongs here; provider clients themselves live in `integrations/*`.
- Keep `@SpringBootApplication` scan narrow to the batch package. Domain/integration beans should come from module AutoConfiguration.
- Add integration tests here for scheduler/job wiring and cross-module background workflows.

## References

- Song analysis flow: `../../docs/architecture/song-analysis.md`
- Push notification flow: `../../docs/architecture/push-notification.md`
