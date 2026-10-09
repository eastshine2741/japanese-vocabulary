package com.japanese.vocabulary.flashcard.dto

/** 앱 `app-rn/src/types/studySchedule.ts` 와 1:1. */
data class StudyScheduleResponse(
    val dueToday: Long,
    val newToday: Long,
    val studiedCards: Long,
    val previewWords: List<SchedulePreviewWordDto>,
    val days: List<MemoryForecastDayResponse>,
)

data class MemoryForecastDayResponse(
    /** yyyy-MM-dd, KST 04:00 경계 학습일. */
    val date: String,
    val rememberedIfReviewed: Int,
    val rememberedIfSkipped: Int,
)
