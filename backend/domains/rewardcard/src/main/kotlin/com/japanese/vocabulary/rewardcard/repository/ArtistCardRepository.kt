package com.japanese.vocabulary.rewardcard.repository

import com.japanese.vocabulary.rewardcard.entity.ArtistCardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ArtistCardRepository : JpaRepository<ArtistCardEntity, Long> {

    fun findByUserIdAndArtistId(userId: Long, artistId: Long): ArtistCardEntity?

    fun findByUserIdAndArtistIdIn(userId: Long, artistIds: Collection<Long>): List<ArtistCardEntity>

    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<ArtistCardEntity>

    @Query(
        "SELECT c FROM ArtistCardEntity c WHERE c.userId = :userId " +
            "AND (c.seenGrade IS NULL OR c.seenGrade <> c.grade) ORDER BY c.id"
    )
    fun findPending(@Param("userId") userId: Long): List<ArtistCardEntity>
}
