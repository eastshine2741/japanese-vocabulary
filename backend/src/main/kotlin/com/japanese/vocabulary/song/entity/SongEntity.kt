package com.japanese.vocabulary.song.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "songs")
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
    val youtubeUrl: String? = null,

    @Column(name = "artwork_url")
    val artworkUrl: String? = null,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
