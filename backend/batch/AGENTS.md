# Batch Application Instructions

## Scope

Applies to `backend/batch/`.

## Rules

- This is a one-shot CronJob image, not a resident service. `CronTaskRunner` runs the single
  `--task=<name>` it is given and the process exits; a failure propagates so the k8s Job fails.
- Do not add `@Scheduled`. Schedules live in `k8s/{dev,prod}/batch/cronjobs.yaml`. A new periodic
  job is a `CronTask` implementation plus a CronJob entry.
- Do not add web endpoints. There is no `spring-boot-starter-web`/actuator here, and no Service or
  Ingress in front of the pod. "Run it now" is `kubectl create job --from=cronjob/<name>`.
- Queue-driven work belongs in `worker`, not here.
- Keep batch dependencies minimal; add only the domain/integration modules required by an actual task.
- Cross-domain read models for scheduled work belong here, not in domain modules.
- Spring Batch `Job`/`Step` config lives here. Name `CronTask` implementations `*Task` so they do
  not collide with Spring Batch `Job` bean names.
- Keep `@SpringBootApplication` scan narrow to the batch package. Domain/integration beans should come from module AutoConfiguration.
- Tests must keep `batch.task-runner.enabled=false` (test yml): `@SpringBootTest` runs
  `ApplicationRunner` beans, so an unguarded runner would fail every context load.

## References

- Module boundaries: `../../docs/architecture/backend-modules.md`
- Push notification flow: `../../docs/architecture/push-notification.md`
- CronJob operations: `../../docs/runbooks/k3s-deploy.md`
