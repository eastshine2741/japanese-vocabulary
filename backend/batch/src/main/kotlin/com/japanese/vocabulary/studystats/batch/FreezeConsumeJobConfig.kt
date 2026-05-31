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
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

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

@Service
class FreezeConsumeService(private val jdbcTemplate: JdbcTemplate) {

    private val logger = LoggerFactory.getLogger(FreezeConsumeService::class.java)

    data class Result(val inserted: Int, val decremented: Int, val deleted: Int)

    /**
     * Insert freeze-used summary rows for users who studied [runDate]-2 but missed [runDate]-1
     * and have a STREAK_FREEZE in inventory, then consume the freeze (decrement or delete to
     * honor the row-exists-iff-quantity≥1 invariant).
     */
    @Transactional
    fun consumeFor(runDate: LocalDate): Result {
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

        // Delete-vs-decrement split: at quantity=1, deleting keeps the
        // "row exists ⟺ quantity ≥ 1" invariant (CHECK rejects 0).
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
            "freezeConsume runDate={} inserted={} decremented={} deleted={}",
            runDate, inserted, decremented, deleted,
        )
        return Result(inserted = inserted, decremented = decremented, deleted = deleted)
    }
}
