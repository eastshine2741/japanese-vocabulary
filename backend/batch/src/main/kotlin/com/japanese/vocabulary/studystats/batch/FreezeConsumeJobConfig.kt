package com.japanese.vocabulary.studystats.batch

import org.slf4j.LoggerFactory
import org.springframework.batch.core.Job
import org.springframework.batch.core.Step
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.batch.repeat.RepeatStatus
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager

@Configuration
class FreezeConsumeJobConfig {

    private val logger = LoggerFactory.getLogger(FreezeConsumeJobConfig::class.java)

    @Bean
    fun freezeConsumeJob(jobRepository: JobRepository, freezeConsumeStep: Step): Job =
        JobBuilder("freezeConsumeJob", jobRepository)
            .start(freezeConsumeStep)
            .build()

    @Bean
    fun freezeConsumeStep(
        jobRepository: JobRepository,
        transactionManager: PlatformTransactionManager,
        jdbcTemplate: JdbcTemplate,
    ): Step =
        StepBuilder("freezeConsumeStep", jobRepository)
            .tasklet({ contribution, _ ->
                val params = contribution.stepExecution.jobExecution.jobParameters
                val runDate = params.getLocalDate("runDate")
                    ?: throw IllegalStateException("runDate parameter required")
                val yesterday = runDate.minusDays(1)
                val dayBeforeYesterday = runDate.minusDays(2)

                val inserted = jdbcTemplate.update(
                    """
                    INSERT INTO daily_study_summary (user_id, date_kst, review_count, freeze_used)
                    SELECT i.user_id, ?, 0, TRUE
                    FROM user_inventory i
                    WHERE i.item_type = 'STREAK_FREEZE' AND i.quantity > 0
                      AND EXISTS (
                        SELECT 1 FROM daily_study_summary d
                        WHERE d.user_id = i.user_id AND d.date_kst = ?
                      )
                      AND NOT EXISTS (
                        SELECT 1 FROM daily_study_summary d
                        WHERE d.user_id = i.user_id AND d.date_kst = ?
                      )
                    """.trimIndent(),
                    yesterday, dayBeforeYesterday, yesterday,
                )

                // Decrement freeze inventory for users whose yesterday is freeze-protected.
                // For users at quantity=1, we DELETE rather than UPDATE to maintain the
                // "row exists ⟺ quantity ≥ 1" invariant (CHECK constraint would otherwise reject 0).
                val deleted = jdbcTemplate.update(
                    """
                    DELETE FROM user_inventory
                    WHERE item_type = 'STREAK_FREEZE' AND quantity = 1
                      AND EXISTS (
                        SELECT 1 FROM daily_study_summary d
                        WHERE d.user_id = user_inventory.user_id
                          AND d.date_kst = ?
                          AND d.freeze_used = TRUE
                      )
                    """.trimIndent(),
                    yesterday,
                )
                val decremented = jdbcTemplate.update(
                    """
                    UPDATE user_inventory
                    SET quantity = quantity - 1
                    WHERE item_type = 'STREAK_FREEZE' AND quantity > 1
                      AND EXISTS (
                        SELECT 1 FROM daily_study_summary d
                        WHERE d.user_id = user_inventory.user_id
                          AND d.date_kst = ?
                          AND d.freeze_used = TRUE
                      )
                    """.trimIndent(),
                    yesterday,
                )

                logger.info(
                    "freezeConsumeJob runDate={} inserted={} decremented={} deleted={}",
                    runDate, inserted, decremented, deleted,
                )
                RepeatStatus.FINISHED
            }, transactionManager)
            .build()
}
