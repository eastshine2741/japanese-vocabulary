package com.japanese.vocabulary.flashcard.dto

data class StudyScheduleDto(
    val dueToday: Long,
    /** 오늘 복습을 끝내도 내일 새로 due 가 되는 카드 수. 오늘 남은 시간에 due 가 되는 카드도 포함한다. */
    val dueTomorrow: Long,
    val totalCards: Long,
    val previewWords: List<SchedulePreviewWordDto>,
    /** 호출자가 넘긴 학습일 순서 그대로. */
    val days: List<MemoryForecastDayDto>,
)

data class SchedulePreviewWordDto(
    val wordId: Long,
    val japanese: String,
)

/** 그 학습일이 시작하는 순간 기억하고 있을 단어 수의 기대값 (카드별 FSRS 기억 확률의 합). */
data class MemoryForecastDayDto(
    /** 매일 그날 due 를 전부 '알고 있음'으로 복습했을 때. */
    val rememberedIfReviewed: Int,
    /** 오늘부터 복습하지 않을 때. */
    val rememberedIfSkipped: Int,
)
