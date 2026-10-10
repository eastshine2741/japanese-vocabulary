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
    @Column(name = "grade", nullable = false, length = 10)
    var grade: SongCardGrade,

    @Enumerated(EnumType.STRING)
    @Column(name = "seen_grade", length = 10)
    var seenGrade: SongCardGrade? = null,

    @Column(name = "acquired_seq", nullable = false)
    val acquiredSeq: Int,

    /** 비어 있으면 기본 줄. */
    @Convert(converter = IntListConverter::class)
    @Column(name = "lyric_line_indexes", columnDefinition = "JSON", nullable = false)
    var lyricLineIndexes: List<Int> = emptyList(),

    /** 획마다 SVG 경로 하나. 비어 있으면 서명 전. */
    @Convert(converter = StringListConverter::class)
    @Column(name = "signature", columnDefinition = "JSON", nullable = false)
    var signature: List<String> = emptyList(),

    @Column(name = "mastered_at")
    var masteredAt: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant,
) {
    val isIssued: Boolean get() = seenGrade != null

    /** 오르기만 한다. 올랐으면 true. */
    fun raiseTo(target: SongCardGrade, now: Instant): Boolean {
        if (target <= grade) return false
        grade = target
        if (target == SongCardGrade.MASTER) masteredAt = now
        return true
    }

    /** 발급 = 서명 확정. 발급할 때의 등급까지 본 것으로 친다. */
    fun issue(signature: List<String>, lyricLineIndexes: List<Int>) {
        if (isIssued) throw BusinessException(ErrorCode.REWARD_CARD_ALREADY_ISSUED)
        this.signature = signature
        this.lyricLineIndexes = lyricLineIndexes
        seenGrade = grade
    }

    fun markSeen(seen: SongCardGrade) {
        val current = seenGrade ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_ISSUED)
        if (seen > grade) throw BusinessException(ErrorCode.INVALID_REWARD_CARD_GRADE)
        if (seen > current) seenGrade = seen
    }
}
