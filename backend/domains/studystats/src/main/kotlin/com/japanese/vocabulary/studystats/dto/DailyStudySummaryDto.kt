package com.japanese.vocabulary.studystats.dto

import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import java.time.LocalDate

/**
 * Entity-mirror data class for [DailyStudySummaryEntity]. Use this as the cross-module
 * return type instead of the JPA entity.
 */
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
