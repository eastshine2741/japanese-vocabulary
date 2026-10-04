package com.japanese.vocabulary.flashcard.controller

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.flashcard.dto.StudyScheduleDayResponse
import com.japanese.vocabulary.flashcard.dto.StudyScheduleResponse
import com.japanese.vocabulary.flashcard.service.StudyScheduleService
import com.japanese.vocabulary.studystats.util.KstClock
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 오늘의 복습 스케줄 (docs/product-intents/261004-study-schedule-api.md). */
@RestController
@RequestMapping("/api/study-schedule")
class StudyScheduleController(
    private val studyScheduleService: StudyScheduleService,
    private val kstClock: KstClock,
) {

    @GetMapping
    fun getSchedule(@RequestParam dailyTarget: Int): StudyScheduleResponse {
        if (dailyTarget !in 0..MAX_DAILY_TARGET) throw BusinessException(ErrorCode.INVALID_DAILY_TARGET)
        val today = kstClock.todayStudyDate()
        val dates = (0 until FORECAST_DAYS).map { today.plusDays(it.toLong()) }
        val schedule = studyScheduleService.getSchedule(currentUserId(), dailyTarget, dates.map(kstClock::endOf))
        return StudyScheduleResponse(
            dueToday = schedule.dueToday,
            totalCards = schedule.totalCards,
            previewWords = schedule.previewWords,
            dailyTarget = dailyTarget,
            days = dates.zip(schedule.days) { date, day ->
                StudyScheduleDayResponse(
                    date = date.toString(),
                    scheduledDue = day.scheduledDue,
                    simulatedReview = day.simulatedReview,
                )
            },
        )
    }

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    companion object {
        private const val FORECAST_DAYS = 30
        private const val MAX_DAILY_TARGET = 100
    }
}
