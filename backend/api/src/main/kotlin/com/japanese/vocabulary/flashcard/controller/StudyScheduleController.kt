package com.japanese.vocabulary.flashcard.controller

import com.japanese.vocabulary.flashcard.dto.MemoryForecastDayResponse
import com.japanese.vocabulary.flashcard.dto.StudyScheduleResponse
import com.japanese.vocabulary.flashcard.service.StudyScheduleService
import com.japanese.vocabulary.studystats.util.KstClock
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 오늘의 복습 스케줄과 기억 단어 수 예보. */
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
            newToday = schedule.newToday,
            studiedCards = schedule.studiedCards,
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
        // 30일로는 오래 공부한 유저의 두 시나리오 차이가 10~20% 라 안 보인다.
        private const val FORECAST_DAYS = 365
    }
}
