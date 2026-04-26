package com.japanese.vocabulary.studystats.batch

import com.japanese.vocabulary.studystats.util.KstClock
import org.slf4j.LoggerFactory
import org.springframework.batch.core.Job
import org.springframework.batch.core.JobParametersBuilder
import org.springframework.batch.core.launch.JobLauncher
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

/**
 * Dev-only manual trigger for the freeze consume job. Useful for end-to-end testing
 * without waiting for the 04:00 KST cron. Pass `runDate=YYYY-MM-DD` to override
 * the date the job processes (it consumes freezes for `runDate - 1`).
 *
 * Each invocation gets a unique `ts` parameter so the same `runDate` can be replayed
 * (Spring Batch otherwise rejects identical JobParameters).
 */
@RestController
@RequestMapping("/api/dev/freeze-consume")
class FreezeConsumeDevController(
    private val jobLauncher: JobLauncher,
    private val freezeConsumeJob: Job,
    private val kstClock: KstClock,
) {
    private val logger = LoggerFactory.getLogger(FreezeConsumeDevController::class.java)

    data class RunResponse(
        val status: String,
        val exitCode: String,
        val jobExecutionId: Long?,
        val runDate: String,
    )

    @PostMapping
    fun run(@RequestParam(required = false) runDate: String?): RunResponse {
        val date = runDate?.let { LocalDate.parse(it) } ?: kstClock.todayStudyDate()
        val params = JobParametersBuilder()
            .addLocalDate("runDate", date)
            .addLong("ts", System.currentTimeMillis())
            .toJobParameters()
        val exec = jobLauncher.run(freezeConsumeJob, params)
        logger.info("freezeConsumeJob manual trigger runDate={} status={}", date, exec.status)
        return RunResponse(
            status = exec.status.toString(),
            exitCode = exec.exitStatus.exitCode,
            jobExecutionId = exec.id,
            runDate = date.toString(),
        )
    }
}
