package com.japanese.vocabulary.studystats.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDate

/** 프리즈로 이어 간 날(`freeze_used`)은 연속을 잇기만 하고 연속 일수·총 학습일에는 세지 않는다. */
@Service
class StreakCalculator(
    private val repo: DailyStudySummaryRepository,
    transactionManager: PlatformTransactionManager,
) {
    private val readTx = TransactionTemplate(transactionManager).apply { isReadOnly = true }

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

    /**
     * 최근 날짜부터 거꾸로 청크씩 읽으며, 날짜가 끊기지 않고 이어진 구간마다 freeze 가 아닌 날을 세어 가장 긴 값을 고른다.
     * SQL 윈도 함수로 묶으면 MySQL 임시 테이블이 생기고, 한 번에 다 읽으면 이력이 긴 유저의 행이 전부 힙에 올라온다.
     * 청크마다 트랜잭션을 따로 열어 커넥션을 오래 잡지 않으므로 바깥 트랜잭션 없이 불러야 한다.
     */
    fun longestStreak(userId: Long, today: LocalDate): Int {
        var longest = 0
        var run = 0
        var later: LocalDate? = null
        var before = today.plusDays(1)
        while (true) {
            val days = readTx.execute {
                repo.findStudyDaysBefore(userId, before, PageRequest.of(0, LONGEST_CHUNK_SIZE))
            }.orEmpty()
            for (day in days) {
                if (later == null || day.dateKst != later.minusDays(1)) run = 0
                if (!day.freezeUsed) run++
                longest = maxOf(longest, run)
                later = day.dateKst
            }
            if (days.size < LONGEST_CHUNK_SIZE) return longest
            before = days.last().dateKst
        }
    }

    companion object {
        private const val RECENT_LIMIT = 1000
        private const val LONGEST_CHUNK_SIZE = 100
    }
}
