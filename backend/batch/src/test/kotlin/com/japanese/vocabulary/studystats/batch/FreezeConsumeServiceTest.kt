package com.japanese.vocabulary.studystats.batch

import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.support.GeneratedKeyHolder
import java.sql.Statement
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicLong

/**
 * Spring Batch 의 잡 인프라(JobLauncher / 메타데이터 테이블 / 시퀀스)를 한꺼번에 검증하려고
 * 하면 in-container 의 BATCH_*_SEQ seed 상태에 묶여 깨지기 쉽다. 그래서 잡의 핵심 비즈니스
 * 로직을 [FreezeConsumeService.consumeFor] 로 분리했고, 이 테스트는 그 서비스에 대한 통합테스트다.
 *
 * Step 자체는 service 호출 + JobParameters 추출만 담당하는 thin wrapper 이므로 별도 검증
 * 대상으로 두지 않는다.
 */
class FreezeConsumeServiceTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var service: FreezeConsumeService

    private val runDate: LocalDate = LocalDate.of(2026, 5, 1)
    private val yesterday: LocalDate = runDate.minusDays(1)
    private val dayBeforeYesterday: LocalDate = runDate.minusDays(2)

    private val seededUserIds = mutableListOf<Long>()

    @AfterEach
    fun cleanup() {
        if (seededUserIds.isEmpty()) return
        val placeholders = seededUserIds.joinToString(",") { "?" }
        val params = seededUserIds.toTypedArray()
        jdbcTemplate.update("DELETE FROM user_inventory WHERE user_id IN ($placeholders)", *params)
        jdbcTemplate.update("DELETE FROM daily_study_summary WHERE user_id IN ($placeholders)", *params)
        jdbcTemplate.update("DELETE FROM users WHERE id IN ($placeholders)", *params)
        seededUserIds.clear()
    }

    private fun insertUser(): Long {
        val seq = SEQ.incrementAndGet()
        val keyHolder = GeneratedKeyHolder()
        jdbcTemplate.update({ conn ->
            conn.prepareStatement(
                "INSERT INTO users (provider, provider_sub, username) VALUES ('test', ?, ?)",
                Statement.RETURN_GENERATED_KEYS,
            ).apply {
                setString(1, "sub-$seq")
                setString(2, "user-$seq")
            }
        }, keyHolder)
        val id = keyHolder.key!!.toLong()
        seededUserIds += id
        return id
    }

    private fun insertFreeze(userId: Long, quantity: Int) {
        jdbcTemplate.update(
            "INSERT INTO user_inventory (user_id, item_type, quantity) VALUES (?, 'STREAK_FREEZE', ?)",
            userId, quantity,
        )
    }

    private fun insertSummary(userId: Long, date: LocalDate, reviewCount: Int = 1, freezeUsed: Boolean = false) {
        jdbcTemplate.update(
            "INSERT INTO daily_study_summary (user_id, date_kst, review_count, freeze_used) VALUES (?, ?, ?, ?)",
            userId, date, reviewCount, freezeUsed,
        )
    }

    private fun freezeQuantity(userId: Long): Int? =
        jdbcTemplate.query(
            "SELECT quantity FROM user_inventory WHERE user_id = ? AND item_type = 'STREAK_FREEZE'",
            { rs, _ -> rs.getInt("quantity") },
            userId,
        ).firstOrNull()

    private fun summary(userId: Long, date: LocalDate): SummaryRow? =
        jdbcTemplate.query(
            "SELECT review_count, freeze_used FROM daily_study_summary WHERE user_id = ? AND date_kst = ?",
            { rs, _ -> SummaryRow(rs.getInt("review_count"), rs.getBoolean("freeze_used")) },
            userId, date,
        ).firstOrNull()

    @Test
    fun `golden path - studied D-2 missed D-1 with freeze=3 - inserts freeze-used summary and decrements freeze`() {
        val user = insertUser()
        insertFreeze(user, 3)
        insertSummary(user, dayBeforeYesterday, reviewCount = 4)

        service.consumeFor(runDate)

        assertThat(summary(user, yesterday)).isEqualTo(SummaryRow(reviewCount = 0, freezeUsed = true))
        assertThat(freezeQuantity(user)).isEqualTo(2)
    }

    @Test
    fun `freeze=1 is deleted rather than decremented to 0 to honor quantity-greater-or-equal-1 invariant`() {
        val user = insertUser()
        insertFreeze(user, 1)
        insertSummary(user, dayBeforeYesterday)

        service.consumeFor(runDate)

        assertThat(summary(user, yesterday)).isEqualTo(SummaryRow(reviewCount = 0, freezeUsed = true))
        assertThat(freezeQuantity(user)).isNull()
    }

    @Test
    fun `no streak - missing D-2 summary - skipped even if freeze available`() {
        val user = insertUser()
        insertFreeze(user, 2)

        service.consumeFor(runDate)

        assertThat(summary(user, yesterday)).isNull()
        assertThat(freezeQuantity(user)).isEqualTo(2)
    }

    @Test
    fun `already studied D-1 - existing summary untouched and freeze not consumed`() {
        val user = insertUser()
        insertFreeze(user, 2)
        insertSummary(user, dayBeforeYesterday)
        insertSummary(user, yesterday, reviewCount = 9, freezeUsed = false)

        service.consumeFor(runDate)

        assertThat(summary(user, yesterday)).isEqualTo(SummaryRow(reviewCount = 9, freezeUsed = false))
        assertThat(freezeQuantity(user)).isEqualTo(2)
    }

    @Test
    fun `no freeze inventory - no summary is inserted`() {
        val user = insertUser()
        insertSummary(user, dayBeforeYesterday)

        service.consumeFor(runDate)

        assertThat(summary(user, yesterday)).isNull()
        assertThat(freezeQuantity(user)).isNull()
    }

    @Test
    fun `mixed cohort - each user is evaluated independently in a single run`() {
        val eligible = insertUser().also { insertFreeze(it, 3); insertSummary(it, dayBeforeYesterday) }
        val noStreak = insertUser().also { insertFreeze(it, 3) }
        val noFreeze = insertUser().also { insertSummary(it, dayBeforeYesterday) }
        val freezeOne = insertUser().also { insertFreeze(it, 1); insertSummary(it, dayBeforeYesterday) }
        val alreadyStudied = insertUser().also {
            insertFreeze(it, 3)
            insertSummary(it, dayBeforeYesterday)
            insertSummary(it, yesterday, reviewCount = 5)
        }

        val result = service.consumeFor(runDate)

        assertThat(result.inserted).isEqualTo(2)   // eligible + freezeOne
        assertThat(result.decremented).isEqualTo(1) // eligible: 3 → 2
        assertThat(result.deleted).isEqualTo(1)    // freezeOne: 1 → row removed

        assertThat(summary(eligible, yesterday)).isEqualTo(SummaryRow(0, true))
        assertThat(freezeQuantity(eligible)).isEqualTo(2)

        assertThat(summary(noStreak, yesterday)).isNull()
        assertThat(freezeQuantity(noStreak)).isEqualTo(3)

        assertThat(summary(noFreeze, yesterday)).isNull()
        assertThat(freezeQuantity(noFreeze)).isNull()

        assertThat(summary(freezeOne, yesterday)).isEqualTo(SummaryRow(0, true))
        assertThat(freezeQuantity(freezeOne)).isNull()

        assertThat(summary(alreadyStudied, yesterday)).isEqualTo(SummaryRow(5, false))
        assertThat(freezeQuantity(alreadyStudied)).isEqualTo(3)
    }

    private data class SummaryRow(val reviewCount: Int, val freezeUsed: Boolean)

    companion object {
        private val SEQ = AtomicLong(0)
    }
}
