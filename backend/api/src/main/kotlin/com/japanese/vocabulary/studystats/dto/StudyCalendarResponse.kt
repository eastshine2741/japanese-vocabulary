package com.japanese.vocabulary.studystats.dto

data class StudyCalendarResponse(
    val days: List<HeatmapDayDto>,
    /** "yyyy-MM". null 이면 더 이전 기록이 없다. */
    val nextBefore: String?,
)
