package com.japanese.vocabulary.flashcard.dto

/** 앱 `app-rn/src/types/studySchedule.ts` 와 1:1. */
data class StudyScheduleResponse(
    val dueToday: Long,
    val totalCards: Long,
    val previewWords: List<SchedulePreviewWordDto>,
    val dailyTarget: Int,
    val days: List<StudyScheduleDayResponse>,
)

data class StudyScheduleDayResponse(
    /** yyyy-MM-dd, KST 04:00 경계 학습일. */
    val date: String,
    val scheduledDue: Int,
    val simulatedReview: Int,
)
