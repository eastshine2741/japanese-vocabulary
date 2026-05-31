package com.japanese.vocabulary.studystats.batch

import org.springframework.batch.core.Job
import org.springframework.batch.core.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.batch.repeat.RepeatStatus
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager

@Configuration
class FreezeConsumeJobConfig {

    @Bean
    fun freezeConsumeJob(jobRepository: JobRepository, freezeConsumeStep: Step): Job =
        JobBuilder("freezeConsumeJob", jobRepository)
            .start(freezeConsumeStep)
            .build()

    @Bean
    fun freezeConsumeStep(
        jobRepository: JobRepository,
        transactionManager: PlatformTransactionManager,
        freezeConsumeService: FreezeConsumeService,
    ): Step =
        StepBuilder("freezeConsumeStep", jobRepository)
            .tasklet({ contribution, _ ->
                val runDate = contribution.stepExecution.jobExecution.jobParameters.getLocalDate("runDate")
                    ?: throw IllegalStateException("runDate parameter required")
                freezeConsumeService.consumeFor(runDate)
                RepeatStatus.FINISHED
            }, transactionManager)
            .build()
}
