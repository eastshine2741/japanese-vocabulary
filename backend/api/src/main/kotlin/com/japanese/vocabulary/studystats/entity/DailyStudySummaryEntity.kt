package com.japanese.vocabulary.studystats.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.LocalDate

@Entity
@Table(
    name = "daily_study_summary",
    uniqueConstraints = [UniqueConstraint(name = "uk_daily_study_summary", columnNames = ["user_id", "date_kst"])],
)
class DailyStudySummaryEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "date_kst", nullable = false)
    val dateKst: LocalDate,

    @Column(name = "review_count", nullable = false)
    var reviewCount: Int = 0,

    @Column(name = "freeze_used", nullable = false)
    var freezeUsed: Boolean = false,
)
