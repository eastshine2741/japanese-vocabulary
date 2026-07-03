package com.japanese.vocabulary.studystats.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.studystats.dto.DailyDotDto
import com.japanese.vocabulary.studystats.dto.DailyStudySummaryDto
import com.japanese.vocabulary.studystats.dto.DotStatusDto
import com.japanese.vocabulary.studystats.dto.toDto
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.userinventory.entity.InventoryItemType
import com.japanese.vocabulary.userinventory.service.UserInventoryService
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate

@Service
class StudyStatsService(
    private val repo: DailyStudySummaryRepository,
    private val streakCalculator: StreakCalculator,
    private val userInventoryService: UserInventoryService,
    private val kstClock: KstClock,
) {

    @Transactional(readOnly = true)
    fun currentStreak(userId: Long): Int =
        streakCalculator.currentStreak(userId, kstClock.todayStudyDate())

    @Transactional(readOnly = true)
    fun longestStreak(userId: Long): Int = streakCalculator.longestStreak(userId)

    @Transactional(readOnly = true)
    fun totalStudyDays(userId: Long): Int = streakCalculator.totalStudyDays(userId)

    @Transactional(readOnly = true)
    fun freezeCount(userId: Long): Int =
        userInventoryService.quantityOf(userId, InventoryItemType.STREAK_FREEZE)

    @Transactional(readOnly = true)
    fun weekDots(userId: Long): List<DailyDotDto> {
        val today = kstClock.todayStudyDate()
        val (weekStart, weekEnd) = currentWeekBounds(today)
        val rowsByDate = repo.findByUserIdAndDateKstBetweenOrderByDateKstAsc(userId, weekStart, weekEnd)
            .associateBy { it.dateKst }
        return (0..6).map { offset ->
            val d = weekStart.plusDays(offset.toLong())
            DailyDotDto(date = d, status = dotStatus(d, today, rowsByDate[d]))
        }
    }

    @Transactional(readOnly = true)
    fun heatmap(userId: Long): List<DailyStudySummaryDto> {
        val today = kstClock.todayStudyDate()
        val from = today.minusDays((HEATMAP_RANGE - 1).toLong())
        val rows = repo.findByUserIdAndDateKstBetweenOrderByDateKstAsc(userId, from, today)
        val rowsByDate = rows.associateBy { it.dateKst }

        return (0 until HEATMAP_RANGE).map { offset ->
            val d = from.plusDays(offset.toLong())
            rowsByDate[d]?.toDto() ?: DailyStudySummaryDto(
                userId = userId,
                dateKst = d,
                reviewCount = 0,
                freezeUsed = false,
            )
        }
    }

    private fun dotStatus(d: LocalDate, today: LocalDate, row: DailyStudySummaryEntity?): DotStatusDto {
        if (d == today) return DotStatusDto.TODAY
        if (row == null) return DotStatusDto.NONE
        if (row.freezeUsed) return DotStatusDto.FREEZE
        if (row.reviewCount > 0) return DotStatusDto.STUDIED
        return DotStatusDto.NONE
    }

    private fun currentWeekBounds(today: LocalDate): Pair<LocalDate, LocalDate> {
        val daysFromMonday = (today.dayOfWeek.value - DayOfWeek.MONDAY.value + 7) % 7
        val start = today.minusDays(daysFromMonday.toLong())
        return start to start.plusDays(6)
    }

    companion object {
        const val FREEZE_CAP = 2
        const val HEATMAP_RANGE = 112 // 16 weeks, matches Pencil heatmap grid (16 cols × 7 rows)
    }
}
