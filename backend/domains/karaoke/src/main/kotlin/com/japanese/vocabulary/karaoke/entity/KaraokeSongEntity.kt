package com.japanese.vocabulary.karaoke.entity

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

/**
 * 노래방 한 곳에 일본곡 한 곡이 등재된 사실. 같은 곡이 TJ·금영 양쪽에 오르면 행이 둘이다.
 * 분석 결과와 무관하게 남고, 분석이 끝난 곡만 [songId] 가 채워진다.
 */
@Entity
@Table(
    name = "karaoke_song",
    uniqueConstraints = [UniqueConstraint(name = "uk_karaoke_song_vendor_number", columnNames = ["vendor", "number"])],
    indexes = [
        Index(name = "idx_karaoke_song_listed_on", columnList = "listed_on"),
        Index(name = "idx_karaoke_song_title_artist", columnList = "title, artist"),
    ],
)
@EntityListeners(AuditingEntityListener::class)
class KaraokeSongEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val vendor: KaraokeVendor,

    @Column(nullable = false)
    val number: Int,

    @Column(nullable = false)
    val title: String,

    @Column(nullable = false)
    val artist: String,

    @Column(name = "artwork_url", length = 500)
    val artworkUrl: String? = null,

    @Column(name = "listed_on", nullable = false)
    val listedOn: LocalDate,

    @Column(name = "song_id")
    var songId: Long? = null,

    @Column(name = "notified_at")
    var notifiedAt: Instant? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
)
