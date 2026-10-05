package com.japanese.vocabulary.studystats.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.studystats.util.KstClock
import org.slf4j.LoggerFactory
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.Job
import org.springframework.batch.core.JobParametersBuilder
import org.springframework.batch.core.launch.JobLauncher
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component
import java.time.LocalDate

/**
 * 04:00 KST CronJob. `--runDate=YYYY-MM-DD` 로 날짜를 덮어쓸 수 있고 (job 은 `runDate - 1` 의
 * freeze 를 소비한다), 같은 runDate 를 다시 돌릴 수 있도록 매 실행에 고유한 `ts` 를 붙인다.
 */
@Component
class FreezeConsumeTask(
    private val jobLauncher: JobLauncher,
    private val freezeConsumeJob: Job,
    private val kstClock: KstClock,
) : CronTask {
    private val logger = LoggerFactory.getLogger(FreezeConsumeTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val runDate = args.getOptionValues(RUN_DATE_OPTION)?.firstOrNull()
            ?.let { LocalDate.parse(it) }
            ?: kstClock.todayStudyDate()
        val params = JobParametersBuilder()
            .addLocalDate("runDate", runDate)
            .addLong("ts", System.currentTimeMillis())
            .toJobParameters()

        val execution = jobLauncher.run(freezeConsumeJob, params)
        logger.info("freezeConsumeJob runDate={} status={}", runDate, execution.status)
        check(execution.status == BatchStatus.COMPLETED) {
            "freezeConsumeJob did not complete for runDate=$runDate (status=${execution.status})"
        }
    }

    companion object {
        const val NAME = "freeze-consume"
        const val RUN_DATE_OPTION = "runDate"
    }
}
