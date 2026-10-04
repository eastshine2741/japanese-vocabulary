package com.japanese.vocabulary.recommendation.batch

import com.japanese.vocabulary.batch.CronTask
import org.slf4j.LoggerFactory
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.Job
import org.springframework.batch.core.JobParametersBuilder
import org.springframework.batch.core.launch.JobLauncher
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component
import java.time.Clock

/** 매주 월요일 03:00 JST CronJob. */
@Component
class AppleMusicRecommendationTask(
    private val jobLauncher: JobLauncher,
    @Qualifier("appleMusicRecommendationCollectJob")
    private val appleMusicRecommendationCollectJob: Job,
    private val weekCalculator: RecommendationWeekCalculator,
    private val clock: Clock,
) : CronTask {
    private val logger = LoggerFactory.getLogger(AppleMusicRecommendationTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val weekStartDate = weekCalculator.currentWeekStartDate()
        val params = JobParametersBuilder()
            .addLocalDate("weekStartDate", weekStartDate)
            .addLong("scheduledAtEpochMillis", clock.millis())
            .toJobParameters()

        val execution = jobLauncher.run(appleMusicRecommendationCollectJob, params)
        logger.info(
            "appleMusicRecommendationCollectJob weekStartDate={} executionId={} status={}",
            weekStartDate,
            execution.id,
            execution.status,
        )
        check(execution.status == BatchStatus.COMPLETED) {
            "appleMusicRecommendationCollectJob did not complete for weekStartDate=$weekStartDate " +
                "(status=${execution.status})"
        }
    }

    companion object {
        const val NAME = "apple-music-recommendation"
    }
}
