package com.japanese.vocabulary.studystats.controller

import com.japanese.vocabulary.studystats.dto.HeatmapDayDto
import com.japanese.vocabulary.studystats.dto.HeatmapResponse
import com.japanese.vocabulary.studystats.dto.HomeStatsResponse
import com.japanese.vocabulary.studystats.dto.ProfileStatsResponse
import com.japanese.vocabulary.studystats.dto.WeekDotDto
import com.japanese.vocabulary.studystats.dto.DailyDotDto
import com.japanese.vocabulary.studystats.dto.DailyStudySummaryDto
import com.japanese.vocabulary.studystats.dto.DotStatusDto
import com.japanese.vocabulary.studystats.service.StudyStatsService
import com.japanese.vocabulary.user.service.UserSettingsService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/study-stats")
class StudyStatsController(
    private val studyStatsService: StudyStatsService,
    private val userSettingsService: UserSettingsService,
) {
    @GetMapping("/home")
    fun getHome(): HomeStatsResponse {
        val userId = currentUserId()
        return HomeStatsResponse(
            currentStreak = studyStatsService.currentStreak(userId),
            freezeCount = studyStatsService.freezeCount(userId),
            freezeMax = StudyStatsService.FREEZE_CAP,
            weekDots = studyStatsService.weekDots(userId).map { it.toWeekDot() },
        )
    }

    @GetMapping("/profile")
    fun getProfile(): ProfileStatsResponse {
        val userId = currentUserId()
        return ProfileStatsResponse(
            currentStreak = studyStatsService.currentStreak(userId),
            longestStreak = studyStatsService.longestStreak(userId),
            totalStudyDays = studyStatsService.totalStudyDays(userId),
            freezeCount = studyStatsService.freezeCount(userId),
            freezeMax = StudyStatsService.FREEZE_CAP,
            dailyGoal = userSettingsService.getSettings(userId).dailyGoal,
        )
    }

    @GetMapping("/heatmap")
    fun getHeatmap(): HeatmapResponse {
        val userId = currentUserId()
        return HeatmapResponse(days = studyStatsService.heatmap(userId).map { it.toHeatmapDay() })
    }

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    private fun DailyDotDto.toWeekDot() = WeekDotDto(date = date.toString(), status = status.toWire())

    private fun DotStatusDto.toWire(): String = when (this) {
        DotStatusDto.STUDIED -> "studied"
        DotStatusDto.NONE -> "none"
        DotStatusDto.FREEZE -> "freeze"
        DotStatusDto.TODAY -> "today"
    }

    private fun DailyStudySummaryDto.toHeatmapDay() = HeatmapDayDto(
        date = dateKst.toString(),
        reviewCount = reviewCount,
        freezeUsed = freezeUsed,
    )
}
