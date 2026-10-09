package com.japanese.vocabulary.studystats.dto

import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import java.time.LocalDate

/** Cross-module return type; the JPA entity does not leave this module. */
data class DailyStudySummaryDto(
    val userId: Long,
    val dateKst: LocalDate,
    val reviewCount: Int,
    val freezeUsed: Boolean,
)

fun DailyStudySummaryEntity.toDto(): DailyStudySummaryDto = DailyStudySummaryDto(
    userId = userId,
    dateKst = dateKst,
    reviewCount = reviewCount,
    freezeUsed = freezeUsed,
)
