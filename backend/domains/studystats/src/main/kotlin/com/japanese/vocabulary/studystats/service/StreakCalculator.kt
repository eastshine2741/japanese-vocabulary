package com.japanese.vocabulary.studystats.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/** 프리즈로 이어 간 날(`freeze_used`)은 연속을 잇기만 하고 연속 일수·총 학습일에는 세지 않는다. */
@Service
class StreakCalculator(
    private val repo: DailyStudySummaryRepository,
) {
    @Transactional(readOnly = true)
    fun totalStudyDays(userId: Long): Int = repo.countStudyDays(userId).toInt()

    /**
     * Walks daily_study_summary backward from `today` inclusive and counts review days
     * in the consecutive run. Stops at the first gap. If `today` itself has no row,
     * the run ending yesterday is still alive and is what gets counted.
     */
    @Transactional(readOnly = true)
    fun currentStreak(userId: Long, today: LocalDate): Int {
        val rows = repo.findByUserIdAndDateKstLessThanEqualOrderByDateKstDesc(
            userId, today, PageRequest.of(0, RECENT_LIMIT),
        )
        if (rows.isEmpty()) return 0

        var expected = if (rows.first().dateKst == today) today else today.minusDays(1)
        var streak = 0
        for (row in rows) {
            if (row.dateKst != expected) break
            if (!row.freezeUsed) streak++
            expected = expected.minusDays(1)
        }
        return streak
    }

    @Transactional(readOnly = true)
    fun longestStreak(userId: Long): Int = repo.longestStreak(userId).toInt()

    companion object {
        private const val RECENT_LIMIT = 1000
    }
}
