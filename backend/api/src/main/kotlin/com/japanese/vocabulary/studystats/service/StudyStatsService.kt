package com.japanese.vocabulary.studystats.service

import com.japanese.vocabulary.studystats.dto.HeatmapDay
import com.japanese.vocabulary.studystats.dto.HeatmapResponse
import com.japanese.vocabulary.studystats.dto.HomeStatsResponse
import com.japanese.vocabulary.studystats.dto.ProfileStatsResponse
import com.japanese.vocabulary.studystats.dto.WeekDot
import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.user.dto.UserSettingsData
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import com.japanese.vocabulary.userinventory.entity.InventoryItemType
import com.japanese.vocabulary.userinventory.service.UserInventoryService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate

@Service
class StudyStatsService(
    private val repo: DailyStudySummaryRepository,
    private val streakCalculator: StreakCalculator,
    private val userInventoryService: UserInventoryService,
    private val userSettingsRepository: UserSettingsRepository,
    private val kstClock: KstClock,
) {

    @Transactional(readOnly = true)
    fun getHome(userId: Long): HomeStatsResponse {
        val today = kstClock.todayStudyDate()
        val streak = streakCalculator.currentStreak(userId, today)
        val freezeCount = userInventoryService.quantityOf(userId, InventoryItemType.STREAK_FREEZE)

        val (weekStart, weekEnd) = currentWeekBounds(today)
        val rowsByDate = repo.findByUserIdAndDateKstBetweenOrderByDateKstAsc(userId, weekStart, weekEnd)
            .associateBy { it.dateKst }

        val dots = (0..6).map { offset ->
            val d = weekStart.plusDays(offset.toLong())
            WeekDot(date = d.toString(), status = dotStatus(d, today, rowsByDate[d]))
        }

        return HomeStatsResponse(
            currentStreak = streak,
            freezeCount = freezeCount,
            freezeMax = FREEZE_CAP,
            weekDots = dots,
        )
    }

    @Transactional(readOnly = true)
    fun getProfile(userId: Long): ProfileStatsResponse {
        val today = kstClock.todayStudyDate()
        return ProfileStatsResponse(
            currentStreak = streakCalculator.currentStreak(userId, today),
            longestStreak = streakCalculator.longestStreak(userId),
            totalStudyDays = streakCalculator.totalStudyDays(userId),
            freezeCount = userInventoryService.quantityOf(userId, InventoryItemType.STREAK_FREEZE),
            freezeMax = FREEZE_CAP,
            dailyGoal = settingsOrDefault(userId).dailyGoal,
        )
    }

    @Transactional(readOnly = true)
    fun getHeatmap(userId: Long): HeatmapResponse {
        val today = kstClock.todayStudyDate()
        val from = today.minusDays((HEATMAP_RANGE - 1).toLong())
        val rows = repo.findByUserIdAndDateKstBetweenOrderByDateKstAsc(userId, from, today)
        val rowsByDate = rows.associateBy { it.dateKst }

        val days = (0 until HEATMAP_RANGE).map { offset ->
            val d = from.plusDays(offset.toLong())
            val row = rowsByDate[d]
            HeatmapDay(
                date = d.toString(),
                reviewCount = row?.reviewCount ?: 0,
                freezeUsed = row?.freezeUsed ?: false,
            )
        }

        return HeatmapResponse(days = days)
    }

    private fun dotStatus(d: LocalDate, today: LocalDate, row: DailyStudySummaryEntity?): String {
        if (d == today) return "today"
        if (row == null) return "none"
        if (row.freezeUsed) return "freeze"
        if (row.reviewCount > 0) return "studied"
        return "none"
    }

    private fun currentWeekBounds(today: LocalDate): Pair<LocalDate, LocalDate> {
        val daysFromMonday = (today.dayOfWeek.value - DayOfWeek.MONDAY.value + 7) % 7
        val start = today.minusDays(daysFromMonday.toLong())
        return start to start.plusDays(6)
    }

    private fun settingsOrDefault(userId: Long): UserSettingsData =
        userSettingsRepository.findByUserId(userId)?.settings ?: UserSettingsData()

    companion object {
        const val FREEZE_CAP = 2
        const val HEATMAP_RANGE = 112 // 16 weeks, matches Pencil heatmap grid (16 cols × 7 rows)
    }
}
