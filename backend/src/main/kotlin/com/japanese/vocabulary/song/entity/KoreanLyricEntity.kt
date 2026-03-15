package com.japanese.vocabulary.song.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "korean_lyrics")
class KoreanLyricEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "song_id", nullable = false, unique = true)
    val songId: Long,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: KoreanLyricStatus = KoreanLyricStatus.PENDING,
    @Column(columnDefinition = "JSON")
    var content: String? = null,
    @Column(name = "retry_count", nullable = false)
    var retryCount: Int = 0,
    @Column(name = "created_at")
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at")
    var updatedAt: Instant = Instant.now()
)
