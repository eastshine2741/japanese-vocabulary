package com.japanese.vocabulary.studystats.batch

import com.japanese.vocabulary.studystats.util.KstClock
import org.slf4j.LoggerFactory
import org.springframework.batch.core.Job
import org.springframework.batch.core.JobParametersBuilder
import org.springframework.batch.core.launch.JobLauncher
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class FreezeConsumeScheduler(
    private val jobLauncher: JobLauncher,
    private val freezeConsumeJob: Job,
    private val kstClock: KstClock,
) {
    private val logger = LoggerFactory.getLogger(FreezeConsumeScheduler::class.java)

    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    fun runDailyFreezeConsumption() {
        val today = kstClock.todayStudyDate()
        val params = JobParametersBuilder()
            .addLocalDate("runDate", today)
            .toJobParameters()
        try {
            jobLauncher.run(freezeConsumeJob, params)
        } catch (e: Exception) {
            logger.error("freezeConsumeJob failed for runDate={}", today, e)
        }
    }
}
