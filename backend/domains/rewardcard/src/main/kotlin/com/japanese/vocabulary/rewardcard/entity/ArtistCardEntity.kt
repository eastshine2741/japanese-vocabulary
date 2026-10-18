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

/** 유저·아티스트마다 한 장. 등급은 마스터 곡 수를 따르고, 곡 학습을 그만둬 그 수가 줄면 내려간다. */
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

    /** 유저가 마지막으로 본 등급. [grade] 와 다르면 강화 연출이 남았다. */
    @Enumerated(EnumType.STRING)
    @Column(name = "seen_grade", length = 10)
    var seenGrade: ArtistCardGrade? = null,

    /** 몇 번째 팬인지. BRONZE 에 처음 닿을 때 아티스트마다 매기고 바뀌지 않는다. 기본으로 내려가도 남는다. */
    @Column(name = "fan_no")
    var fanNo: Int? = null,

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

    /** 기본 카드엔 팬 번호를 보이지 않는다. */
    val shownFanNo: Int? get() = fanNo.takeIf { grade >= ArtistCardGrade.BRONZE }

    /** 서명 뒤 아직 못 본 강화가 있다. */
    val hasUnseenUpgrade: Boolean get() = isIssued && seenGrade != grade

    fun issue(signature: List<String>, now: Instant) {
        if (isIssued) throw BusinessException(ErrorCode.REWARD_CARD_ALREADY_ISSUED)
        this.signature = signature
        issuedAt = now
        seenGrade = grade
    }

    fun issueSilently(now: Instant) {
        if (issuedAt == null) issuedAt = now
        seenGrade = grade
    }

    fun upgrade(to: ArtistCardGrade) {
        if (to > grade) grade = to
    }

    /** 내려간 등급은 연출하지 않는다. */
    fun downgrade(to: ArtistCardGrade) {
        if (to >= grade) return
        grade = to
        if (seenGrade != null && seenGrade!! > to) seenGrade = to
    }

    /** 앱이 강화 연출을 다 보여 줬다. 그 사이 또 오른 등급은 남긴다. */
    fun markSeen(seen: ArtistCardGrade) {
        if (!isIssued || seen > grade) return
        if (seenGrade == null || seen > seenGrade!!) seenGrade = seen
    }
}
