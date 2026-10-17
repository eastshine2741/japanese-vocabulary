package com.japanese.vocabulary.rewardcard.repository

import com.japanese.vocabulary.rewardcard.entity.ArtistCardEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ArtistCardRepository : JpaRepository<ArtistCardEntity, Long> {

    fun findByIdAndUserId(id: Long, userId: Long): ArtistCardEntity?

    fun findByUserIdAndArtistIdIn(userId: Long, artistIds: Collection<Long>): List<ArtistCardEntity>

    fun findByUserIdOrderByCreatedAtDescIdDesc(userId: Long): List<ArtistCardEntity>

    fun findByUserIdAndIssuedAtIsNullOrderById(userId: Long): List<ArtistCardEntity>
}
