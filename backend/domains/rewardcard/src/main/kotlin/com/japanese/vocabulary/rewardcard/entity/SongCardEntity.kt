package com.japanese.vocabulary.rewardcard.entity

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "song_card")
class SongCardEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "song_id", nullable = false)
    val songId: Long,

    @Column(name = "artist_id")
    var artistId: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "grade", nullable = false, updatable = false, length = 10)
    val grade: SongCardGrade,

    /** 곡·등급마다 따로 센다. */
    @Column(name = "acquired_seq", nullable = false)
    val acquiredSeq: Int,

    /** 비어 있으면 기본 줄. */
    @Convert(converter = IntListConverter::class)
    @Column(name = "lyric_line_indexes", columnDefinition = "JSON", nullable = false)
    var lyricLineIndexes: List<Int> = emptyList(),

    /** 획마다 SVG 경로 하나. 비어 있으면 서명 전 — 연출 없이 채운 카드는 발급된 뒤에도 비어 있고, 앱이 표시 이름을 대신 찍는다. */
    @Convert(converter = StringListConverter::class)
    @Column(name = "signature", columnDefinition = "JSON", nullable = false)
    var signature: List<String> = emptyList(),

    /** null 이면 서명 전이라 획득 연출이 남았다. */
    @Column(name = "issued_at")
    var issuedAt: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant,
) {
    val isIssued: Boolean get() = issuedAt != null

    /** 발급 = 서명 확정. */
    fun issue(signature: List<String>, lyricLineIndexes: List<Int>, now: Instant) {
        if (isIssued) throw BusinessException(ErrorCode.REWARD_CARD_ALREADY_ISSUED)
        this.signature = signature
        this.lyricLineIndexes = lyricLineIndexes
        issuedAt = now
    }

    /** 연출 없이 발급한다. 서명은 그대로 둔다. */
    fun issueSilently(now: Instant) {
        if (issuedAt == null) issuedAt = now
    }
}
