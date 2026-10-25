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

    youtubeUrl: String? = null,

    @Column(name = "artwork_url")
    val artworkUrl: String? = null,

    @Column(name = "active_lyric_id")
    var activeLyricId: Long? = null,

    /** 분석 뒤에 Apple Music 에서 찾아 잇는다. 카탈로그에 없는 곡은 null 로 남는다. */
    @Column(name = "artist_id")
    var artistId: Long? = null,

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null,

    @Column(name = "updated_at")
    var updatedAt: Instant? = null,
) {
    @Column(name = "youtube_url")
    var youtubeUrl: String? = youtubeUrl
        set(value) {
            // 이유는 그 MV 에 붙은 것이다. 새 MV 는 검색이 재생 불가 후보를 이미 거른다.
            if (value != field) mvUnavailableReason = null
            field = value
        }

    /** [youtubeUrl] 을 앱에서 재생할 수 없는 이유. 기존 곡은 batch `mv-playability-backfill` 이 YouTube Data API 로 채웠다. */
    @Enumerated(EnumType.STRING)
    @Column(name = "mv_unavailable_reason", length = 20)
    var mvUnavailableReason: MvUnavailableReason? = null
}

/** 연령 제한은 YouTube 에 로그인하면 볼 수 있고, 나머지(삭제·비공개·임베드 금지·한국 차단)는 볼 수 없다. */
enum class MvUnavailableReason { AGE_RESTRICTED, UNAVAILABLE }
