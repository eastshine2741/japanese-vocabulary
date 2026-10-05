package com.japanese.vocabulary.studystats.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.studystats.dto.DailyDotDto
import com.japanese.vocabulary.studystats.dto.DailyStudySummaryDto
import com.japanese.vocabulary.studystats.dto.DotStatusDto
import com.japanese.vocabulary.studystats.dto.StudyCalendarPageDto
import com.japanese.vocabulary.studystats.dto.toDto
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.userinventory.entity.InventoryItemType
import com.japanese.vocabulary.userinventory.service.UserInventoryService
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth

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

    /** 오늘(KST 04:00 경계) 리뷰가 1건 이상 있는지. freeze 로만 채워진 날은 false. */
    @Transactional(readOnly = true)
    fun studiedToday(userId: Long): Boolean =
        studiedOn(userId, kstClock.todayStudyDate())

    @Transactional(readOnly = true)
    fun studiedOn(userId: Long, date: LocalDate): Boolean =
        (repo.findByUserIdAndDateKst(userId, date)?.reviewCount ?: 0) > 0

    /** 오늘 이전 날짜에 학습 기록이 하나라도 있는지. "첫날"과 "끊긴 뒤 재시작"을 가른다. */
    @Transactional(readOnly = true)
    fun hasStudiedBefore(userId: Long): Boolean =
        repo.existsByUserIdAndDateKstLessThan(userId, kstClock.todayStudyDate())

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
        return denseDays(userId, today.minusDays((HEATMAP_RANGE - 1).toLong()), today)
    }

    /**
     * 달력 한 페이지 = [before] 직전 [months] 개월. [before] 가 없으면 이번 달까지.
     * 미래 달을 요청해도 이번 달에서 끊는다.
     */
    @Transactional(readOnly = true)
    fun calendarPage(userId: Long, before: YearMonth?, months: Int): StudyCalendarPageDto {
        val today = kstClock.todayStudyDate()
        val afterThisMonth = YearMonth.from(today).plusMonths(1)
        val end = before?.takeIf { it < afterThisMonth } ?: afterThisMonth
        val start = end.minusMonths(months.coerceIn(1, CALENDAR_MAX_MONTHS).toLong())
        val from = start.atDay(1)
        val to = minOf(end.atDay(1).minusDays(1), today)
        return StudyCalendarPageDto(
            days = denseDays(userId, from, to),
            nextBefore = start.takeIf { repo.existsByUserIdAndDateKstLessThan(userId, from) },
        )
    }

    private fun denseDays(userId: Long, from: LocalDate, to: LocalDate): List<DailyStudySummaryDto> {
        val rowsByDate = repo.findByUserIdAndDateKstBetweenOrderByDateKstAsc(userId, from, to)
            .associateBy { it.dateKst }
        return generateSequence(from) { it.plusDays(1) }
            .takeWhile { !it.isAfter(to) }
            .map { d ->
                rowsByDate[d]?.toDto() ?: DailyStudySummaryDto(
                    userId = userId,
                    dateKst = d,
                    reviewCount = 0,
                    freezeUsed = false,
                )
            }
            .toList()
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
        const val CALENDAR_DEFAULT_MONTHS = 3
        const val CALENDAR_MAX_MONTHS = 12
    }
}
