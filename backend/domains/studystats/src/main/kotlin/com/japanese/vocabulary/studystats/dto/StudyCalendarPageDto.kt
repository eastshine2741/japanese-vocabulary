package com.japanese.vocabulary.studystats.dto

import java.time.YearMonth

/** [days] 는 페이지 첫 달 1일부터 (끝 달 말일과 오늘 중 이른 날)까지 빈 날 없이 채운다. */
data class StudyCalendarPageDto(
    val days: List<DailyStudySummaryDto>,
    /** 이 페이지보다 이전 기록이 있을 때만 — 다음 요청의 before. */
    val nextBefore: YearMonth?,
)
