package com.japanese.vocabulary.rewardcard.repository

import com.japanese.vocabulary.rewardcard.dto.ArtistMasterCountDto
import com.japanese.vocabulary.rewardcard.entity.SongCardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SongCardRepository : JpaRepository<SongCardEntity, Long> {

    fun findByIdAndUserId(id: Long, userId: Long): SongCardEntity?

    fun findByUserIdAndSongIdIn(userId: Long, songIds: Collection<Long>): List<SongCardEntity>

    fun countByUserIdAndSongId(userId: Long, songId: Long): Long

    fun findByUserIdOrderByCreatedAtDescIdDesc(userId: Long): List<SongCardEntity>

    @Query(
        "SELECT new com.japanese.vocabulary.rewardcard.dto.ArtistMasterCountDto(c.artistId, COUNT(c)) " +
            "FROM SongCardEntity c WHERE c.userId = :userId AND c.artistId IN :artistIds " +
            "AND c.grade = com.japanese.vocabulary.rewardcard.model.SongCardGrade.MASTER GROUP BY c.artistId"
    )
    fun countMasteredByArtist(
        @Param("userId") userId: Long,
        @Param("artistIds") artistIds: Collection<Long>,
    ): List<ArtistMasterCountDto>

    fun findByUserIdAndIssuedAtIsNullOrderById(userId: Long): List<SongCardEntity>

    /** 채우기가 만든 카드. 만들면서 바로 발급하는 건 채우기뿐이라 발급 시각이 만든 시각과 같다. */
    @Query("SELECT c FROM SongCardEntity c WHERE c.issuedAt = c.createdAt ORDER BY c.id")
    fun findBackfilled(): List<SongCardEntity>
}
