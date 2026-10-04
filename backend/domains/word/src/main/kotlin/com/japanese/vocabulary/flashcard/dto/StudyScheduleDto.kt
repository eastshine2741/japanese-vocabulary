package com.japanese.vocabulary.flashcard.dto

data class StudyScheduleDto(
    val dueToday: Long,
    val totalCards: Long,
    val previewWords: List<SchedulePreviewWordDto>,
    /** 호출자가 넘긴 학습일 순서 그대로. */
    val days: List<StudyScheduleDayDto>,
)

data class SchedulePreviewWordDto(
    val wordId: Long,
    val japanese: String,
)

data class StudyScheduleDayDto(
    /** 아무것도 복습하지 않을 때 그날 due 가 되는 카드 수. 0일차는 이미 밀린 것까지 포함한다. */
    val scheduledDue: Int,
    /** 매일 dailyTarget 장씩 '알고 있음'으로만 평가했을 때 그날 복습하는 카드 수. */
    val simulatedReview: Int,
)
