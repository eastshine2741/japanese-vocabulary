package com.japanese.vocabulary.flashcard.dto

data class StudyScheduleDto(
    val dueToday: Long,
    /** [dueToday] 중 한 번도 평가하지 않은 새 카드 수. */
    val newToday: Long,
    /** 한 번 이상 평가한 카드 수. 예보는 이 카드들만 대상으로 한다. */
    val studiedCards: Long,
    val previewWords: List<SchedulePreviewWordDto>,
    /** 호출자가 넘긴 학습일 순서 그대로. */
    val days: List<MemoryForecastDayDto>,
)

data class SchedulePreviewWordDto(
    val wordId: Long,
    val japanese: String,
)

/** 그 학습일이 시작하는 순간 기억하고 있을 단어 수의 기대값 (한 번 이상 평가한 카드의 FSRS 기억 확률 합). */
data class MemoryForecastDayDto(
    /** 매일 그날 due 를 전부 '알고 있음'으로 복습했을 때. */
    val rememberedIfReviewed: Int,
    /** 오늘부터 복습하지 않을 때. */
    val rememberedIfSkipped: Int,
)
