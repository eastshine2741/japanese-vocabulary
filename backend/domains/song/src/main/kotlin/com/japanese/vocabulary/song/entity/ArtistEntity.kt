package com.japanese.vocabulary.song.entity

import jakarta.persistence.*
import java.time.Instant

/** Apple Music 카탈로그 아티스트. 행은 [com.japanese.vocabulary.song.repository.ArtistRepository.upsert] 로만 만든다. */
@Entity
@Table(name = "artist")
class ArtistEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "apple_music_id", nullable = false)
    val appleMusicId: String,

    @Column(nullable = false)
    val name: String,

    @Column(name = "artwork_url")
    val artworkUrl: String? = null,

    @Column(name = "apple_music_url")
    val appleMusicUrl: String? = null,

    @Column(name = "created_at", insertable = false, updatable = false)
    val createdAt: Instant? = null,

    @Column(name = "updated_at", insertable = false, updatable = false)
    val updatedAt: Instant? = null,
)
