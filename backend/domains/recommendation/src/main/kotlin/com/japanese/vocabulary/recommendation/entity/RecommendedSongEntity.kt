package com.japanese.vocabulary.recommendation.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
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

@Entity
@Table(
    name = "recommended_song",
    uniqueConstraints = [UniqueConstraint(name = "uk_recommended_song_song", columnNames = ["song_id"])],
    indexes = [Index(name = "idx_recommended_song_order", columnList = "order_index, id")],
)
@EntityListeners(AuditingEntityListener::class)
class RecommendedSongEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "song_id", nullable = false)
    val songId: Long,

    @Column(name = "order_index", nullable = false)
    var orderIndex: Int,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
)
