# Worker Application Instructions

## Scope

Applies to `backend/worker/`.

## Rules

- This is the resident consumer for the song analysis queue. It exists so a user action starts
  analysis immediately instead of waiting for a poll.
- One message runs one stage. The message carries only `workId` and `stage`; stage outputs live in
  `song_analysis_work_stage.output` (JSON via `SongAnalysisStageCodec`). Never put pipeline state in
  the message.
- Delivery is at-least-once. Idempotency comes from `SongAnalysisWorkService.claimStage()` — a
  duplicate delivery must stay a no-op. Every ledger write carries the claimed `attempt` (fence); a
  stage that does DB writes of its own does them in the same transaction as `completeStage` and rolls
  back when refused.
- A stage failure is recorded as `FAILED` and the message is acked. Do not requeue on errors: retries
  are per HTTP call, `delay`-based (never `Thread.sleep`), and stop at the `RetryDeadline` (5-minute
  budget). Let the listener throw only for infrastructure failures; those go to the DLQ.
- Run stage code under `runBlocking(Dispatchers.IO)`; a bare `runBlocking` serializes the pipeline's
  parallel branches on the listener thread.
- Keep the listener blocking. Acking before the work finishes would lose it on a pod restart.
  Tune throughput with `song-analysis.worker.concurrency`, not by acking early.
- `SongAnalysisWorkSweeper` is the only `@Scheduled` here, and it is a safety net for lost messages.
  Do not add time-based jobs — those belong in `batch` as CronJobs.
- Keep `@SpringBootApplication` scan narrow to the worker package. Domain/integration beans should
  come from module AutoConfiguration.
- Tests disable the listener and sweeper (`spring.rabbitmq.listener.simple.auto-startup=false`,
  `song-analysis.worker.sweep-enabled=false`) and deliver stages through
  `SongAnalysisWorkListener.handle(..., EmptyCoroutineContext)` so the code stays on the test
  transaction's thread.

## References

- Song analysis flow and the work queue: `../../docs/architecture/song-analysis.md`
- Module boundaries: `../../docs/architecture/backend-modules.md`
