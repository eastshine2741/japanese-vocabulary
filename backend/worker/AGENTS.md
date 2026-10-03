# Worker Application Instructions

## Scope

Applies to `backend/worker/`.

## Rules

- This is the resident consumer for the song analysis queue. It exists so a user action starts
  analysis immediately instead of waiting for a poll.
- The `song_analysis_work` row is the source of truth; the message carries only `workId`. Never put
  pipeline state in the message.
- Delivery is at-least-once. Idempotency comes from `SongAnalysisWorkService.claim()`, which only
  locks a `PENDING` row — a duplicate delivery must stay a no-op.
- A pipeline failure is recorded as `FAILED` on the row and the message is acked. Let the listener
  throw only for infrastructure failures; those go to the DLQ.
- Keep the listener blocking. Acking before the work finishes would lose it on a pod restart.
  Tune throughput with `song-analysis.worker.concurrency`, not by acking early.
- `SongAnalysisWorkSweeper` is the only `@Scheduled` here, and it is a safety net for lost messages.
  Do not add time-based jobs — those belong in `batch` as CronJobs.
- Keep `@SpringBootApplication` scan narrow to the worker package. Domain/integration beans should
  come from module AutoConfiguration.
- Tests disable the listener and sweeper (`spring.rabbitmq.listener.simple.auto-startup=false`,
  `song-analysis.worker.sweep-enabled=false`) and drive services directly.

## References

- Song analysis flow and the work queue: `../../docs/architecture/song-analysis.md`
- Module boundaries: `../../docs/architecture/backend-modules.md`
