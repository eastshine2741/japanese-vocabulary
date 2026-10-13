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
    @Column(name = "grade", nullable = false, updatable = false, length = 10)
    val grade: ArtistCardGrade,

    /** 아티스트·등급마다 따로 센다. */
    @Column(name = "acquired_seq", nullable = false)
    val acquiredSeq: Int,

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

    fun issue(signature: List<String>, now: Instant) {
        if (isIssued) throw BusinessException(ErrorCode.REWARD_CARD_ALREADY_ISSUED)
        this.signature = signature
        issuedAt = now
    }

    fun issueSilently(now: Instant) {
        if (issuedAt == null) issuedAt = now
    }
}
