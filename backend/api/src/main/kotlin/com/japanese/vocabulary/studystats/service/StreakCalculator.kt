package com.japanese.vocabulary.studystats.service

import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Service
class StreakCalculator(
    private val repo: DailyStudySummaryRepository,
) {
    @Transactional(readOnly = true)
    fun totalStudyDays(userId: Long): Int = repo.countByUserId(userId).toInt()

    /**
     * Walks daily_study_summary backward from `today` inclusive, counting consecutive
     * dates (a row's existence — review or freeze_used — counts as a study day).
     * Stops at the first gap. If `today` itself has no row, the streak is the
     * consecutive run ending at the most recent past day before `today`.
     */
    @Transactional(readOnly = true)
    fun currentStreak(userId: Long, today: LocalDate): Int {
        val rows = repo.findRecentDatesDesc(userId, today, PageRequest.of(0, RECENT_LIMIT))
        if (rows.isEmpty()) return 0

        var streak = 0
        var expected = today
        for (date in rows) {
            if (date.isAfter(expected)) continue // safety; shouldn't happen given the WHERE clause
            if (date == expected) {
                streak++
                expected = expected.minusDays(1)
                continue
            }
            // date < expected
            if (streak == 0 && date == today.minusDays(1)) {
                // Today not yet recorded — streak is the run ending yesterday.
                streak = 1
                expected = date.minusDays(1)
                continue
            }
            break
        }
        return streak
    }

    @Transactional(readOnly = true)
    fun longestStreak(userId: Long): Int = repo.longestStreak(userId).toInt()

    companion object {
        private const val RECENT_LIMIT = 1000
    }
}
