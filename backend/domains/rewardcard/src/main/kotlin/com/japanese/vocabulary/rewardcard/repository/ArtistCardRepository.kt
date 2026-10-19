package com.japanese.vocabulary.rewardcard.repository

import com.japanese.vocabulary.rewardcard.entity.ArtistCardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface ArtistCardRepository : JpaRepository<ArtistCardEntity, Long> {

    fun findByIdAndUserId(id: Long, userId: Long): ArtistCardEntity?

    fun findByUserIdAndArtistIdIn(userId: Long, artistIds: Collection<Long>): List<ArtistCardEntity>

    fun findByUserIdOrderByCreatedAtDescIdDesc(userId: Long): List<ArtistCardEntity>

    /** 서명 전이거나 못 본 강화가 남은 카드. */
    @Query(
        "SELECT c FROM ArtistCardEntity c WHERE c.userId = :userId " +
            "AND (c.issuedAt IS NULL OR c.seenGrade IS NULL OR c.seenGrade <> c.grade) ORDER BY c.id"
    )
    fun findPendingByUserId(userId: Long): List<ArtistCardEntity>
}
