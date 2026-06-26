package com.japanese.vocabulary.recommendation.batch

import org.slf4j.LoggerFactory
import org.springframework.batch.core.Job
import org.springframework.batch.core.JobParametersBuilder
import org.springframework.batch.core.launch.JobLauncher
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Clock

@Component
class AppleMusicRecommendationScheduler(
    private val jobLauncher: JobLauncher,
    @Qualifier("appleMusicRecommendationCollectJob")
    private val appleMusicRecommendationCollectJob: Job,
    private val weekCalculator: RecommendationWeekCalculator,
    private val clock: Clock,
) {
    private val logger = LoggerFactory.getLogger(AppleMusicRecommendationScheduler::class.java)

    @Scheduled(cron = "\${recommendation.apple-rss.collect-cron:0 0 3 ? * MON}", zone = "Asia/Tokyo")
    fun runWeeklyCollection() {
        val weekStartDate = weekCalculator.currentWeekStartDate()
        val params = JobParametersBuilder()
            .addLocalDate("weekStartDate", weekStartDate)
            .addLong("scheduledAtEpochMillis", clock.millis())
            .toJobParameters()
        try {
            val execution = jobLauncher.run(appleMusicRecommendationCollectJob, params)
            logger.info(
                "appleMusicRecommendationCollectJob triggered: weekStartDate={}, executionId={}, status={}",
                weekStartDate,
                execution.id,
                execution.status,
            )
        } catch (e: Exception) {
            logger.error("appleMusicRecommendationCollectJob failed for weekStartDate={}", weekStartDate, e)
        }
    }
}
