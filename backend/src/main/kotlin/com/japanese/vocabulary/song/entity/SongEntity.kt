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

    @Enumerated(EnumType.STRING)
    @Column(name = "lyric_type", nullable = false)
    val lyricType: LyricType,

    @Column(name = "lyric_content", columnDefinition = "JSON", nullable = false)
    val lyricContent: String,

    @Column(name = "vocabulary_content", columnDefinition = "JSON", nullable = false)
    val vocabularyContent: String,

    @Column(name = "lrclib_id")
    val lrclibId: Long? = null,

    @Column(name = "vocadb_id")
    val vocadbId: Long? = null,

    @Column(name = "youtube_url")
    val youtubeUrl: String? = null,

    @Column(name = "artwork_url")
    val artworkUrl: String? = null,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
