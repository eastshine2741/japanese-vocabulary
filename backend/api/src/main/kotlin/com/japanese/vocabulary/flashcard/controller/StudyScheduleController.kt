package com.japanese.vocabulary.flashcard.controller

import com.japanese.vocabulary.flashcard.dto.MemoryForecastDayResponse
import com.japanese.vocabulary.flashcard.dto.StudyScheduleResponse
import com.japanese.vocabulary.flashcard.service.StudyScheduleService
import com.japanese.vocabulary.studystats.util.KstClock
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 오늘의 복습 스케줄 (docs/product-intents/261004-study-schedule-api.md). */
@RestController
@RequestMapping("/api/study-schedule")
class StudyScheduleController(
    private val studyScheduleService: StudyScheduleService,
    private val kstClock: KstClock,
) {

    @GetMapping
    fun getSchedule(): StudyScheduleResponse {
        val today = kstClock.todayStudyDate()
        val dates = (0 until FORECAST_DAYS).map { today.plusDays(it.toLong()) }
        val schedule = studyScheduleService.getSchedule(currentUserId(), dates.map(kstClock::endOf))
        return StudyScheduleResponse(
            dueToday = schedule.dueToday,
            dueTomorrow = schedule.dueTomorrow,
            totalCards = schedule.totalCards,
            previewWords = schedule.previewWords,
            days = dates.zip(schedule.days) { date, day ->
                MemoryForecastDayResponse(
                    date = date.toString(),
                    rememberedIfReviewed = day.rememberedIfReviewed,
                    rememberedIfSkipped = day.rememberedIfSkipped,
                )
            },
        )
    }

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    companion object {
        private const val FORECAST_DAYS = 365
    }
}
