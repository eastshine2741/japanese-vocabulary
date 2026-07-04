package com.japanese.vocabulary.song.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

@Entity
@Table(name = "songs")
@EntityListeners(AuditingEntityListener::class)
class SongEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    val title: String,

    @Column(nullable = false)
    val artist: String,

    @Column(name = "duration_seconds")
    val durationSeconds: Int? = null,

    @Column(name = "youtube_url")
    var youtubeUrl: String? = null,

    @Column(name = "artwork_url")
    val artworkUrl: String? = null,

    @Column(name = "active_lyric_id")
    var activeLyricId: Long? = null,

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null,

    @Column(name = "updated_at")
    var updatedAt: Instant? = null,
)
