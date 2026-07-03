package com.japanese.vocabulary.recommendation.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(
    name = "song_recommendation",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_song_rec_candidate", columnNames = ["candidate_id"]),
        UniqueConstraint(name = "uk_song_rec_week_song", columnNames = ["week_start_date", "song_id"]),
    ],
    indexes = [
        Index(name = "idx_song_rec_status_week_order_created", columnList = "status, week_start_date, order_index, created_at"),
    ],
)
@EntityListeners(AuditingEntityListener::class)
class SongRecommendationEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "candidate_id", nullable = false)
    val candidateId: Long,

    @Column(name = "week_start_date", nullable = false)
    val weekStartDate: LocalDate,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    var status: SongRecommendationStatus = SongRecommendationStatus.PENDING,

    @Column(name = "song_id", nullable = false)
    val songId: Long,

    @Column(name = "lyric_id", nullable = false)
    val lyricId: Long,

    @Column(name = "order_index", nullable = false)
    var orderIndex: Int = 0,

    @Column(name = "published_at")
    var publishedAt: Instant? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
)
