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
            // 이유는 그 MV 에 붙은 것이라 MV 가 바뀌면 새 MV 를 다음 확인 때 다시 본다.
            if (value != field) mvUnavailableReason = null
            field = value
        }

    /** [youtubeUrl] 을 앱에서 재생할 수 없는 이유. batch `mv-playability-check` 가 YouTube Data API 로 채운다. */
    @Enumerated(EnumType.STRING)
    @Column(name = "mv_unavailable_reason", length = 20)
    var mvUnavailableReason: MvUnavailableReason? = null
}

/** 연령 제한은 YouTube 에 로그인하면 볼 수 있고, 나머지(삭제·비공개·임베드 금지·한국 차단)는 볼 수 없다. */
enum class MvUnavailableReason { AGE_RESTRICTED, UNAVAILABLE }
