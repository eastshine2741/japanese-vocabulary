package com.japanese.vocabulary.rewardcard.entity

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
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
@Table(name = "artist_card")
class ArtistCardEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "artist_id", nullable = false)
    val artistId: Long,

    @Enumerated(EnumType.STRING)
    @Column(name = "grade", nullable = false, length = 10)
    var grade: ArtistCardGrade,

    @Enumerated(EnumType.STRING)
    @Column(name = "seen_grade", length = 10)
    var seenGrade: ArtistCardGrade? = null,

    @Column(name = "acquired_seq", nullable = false)
    val acquiredSeq: Int,

    @Convert(converter = StringListConverter::class)
    @Column(name = "signature", columnDefinition = "JSON", nullable = false)
    var signature: List<String> = emptyList(),

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant,
) {
    val isIssued: Boolean get() = seenGrade != null

    fun raiseTo(target: ArtistCardGrade): Boolean {
        if (target <= grade) return false
        grade = target
        return true
    }

    fun issue(signature: List<String>) {
        if (isIssued) throw BusinessException(ErrorCode.REWARD_CARD_ALREADY_ISSUED)
        this.signature = signature
        seenGrade = grade
    }

    fun issueSilently() {
        seenGrade = grade
    }

    fun markSeen(seen: ArtistCardGrade) {
        val current = seenGrade ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_ISSUED)
        if (seen > grade) throw BusinessException(ErrorCode.INVALID_REWARD_CARD_GRADE)
        if (seen > current) seenGrade = seen
    }
}
