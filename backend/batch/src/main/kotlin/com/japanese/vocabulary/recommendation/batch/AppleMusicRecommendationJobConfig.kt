package com.japanese.vocabulary.recommendation.batch

import org.springframework.batch.core.Job
import org.springframework.batch.core.JobParameters
import org.springframework.batch.core.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.launch.support.RunIdIncrementer
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.batch.repeat.RepeatStatus
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import java.time.LocalDate

@Configuration
class AppleMusicRecommendationJobConfig {

    @Bean
    fun appleMusicRecommendationCollectJob(
        jobRepository: JobRepository,
        appleMusicRecommendationCollectStep: Step,
    ): Job =
        JobBuilder("appleMusicRecommendationCollectJob", jobRepository)
            .incrementer(RunIdIncrementer())
            .start(appleMusicRecommendationCollectStep)
            .build()

    @Bean
    fun appleMusicRecommendationCollectStep(
        jobRepository: JobRepository,
        transactionManager: PlatformTransactionManager,
        collector: AppleMusicRecommendationCollector,
        weekCalculator: RecommendationWeekCalculator,
    ): Step =
        StepBuilder("appleMusicRecommendationCollectStep", jobRepository)
            .tasklet({ contribution, _ ->
                val weekStartDate = contribution.stepExecution.jobExecution.jobParameters.weekStartDate()
                    ?: weekCalculator.currentWeekStartDate()
                collector.collect(weekStartDate)
                RepeatStatus.FINISHED
            }, transactionManager)
            .build()

    private fun JobParameters.weekStartDate(): LocalDate? {
        getLocalDate("weekStartDate")?.let { return it }
        return getString("weekStartDate")?.let { LocalDate.parse(it) }
    }
}
