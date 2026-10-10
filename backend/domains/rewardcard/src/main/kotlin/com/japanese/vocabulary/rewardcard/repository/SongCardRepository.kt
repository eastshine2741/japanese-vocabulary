package com.japanese.vocabulary.rewardcard.repository

import com.japanese.vocabulary.rewardcard.dto.ArtistMasterCountDto
import com.japanese.vocabulary.rewardcard.entity.SongCardEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface SongCardRepository : JpaRepository<SongCardEntity, Long> {

    fun findByUserIdAndSongId(userId: Long, songId: Long): SongCardEntity?

    fun findByUserIdAndSongIdIn(userId: Long, songIds: Collection<Long>): List<SongCardEntity>

    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<SongCardEntity>

    @Query(
        "SELECT new com.japanese.vocabulary.rewardcard.dto.ArtistMasterCountDto(c.artistId, COUNT(c)) " +
            "FROM SongCardEntity c WHERE c.userId = :userId AND c.artistId IN :artistIds " +
            "AND c.grade = com.japanese.vocabulary.rewardcard.model.SongCardGrade.MASTER GROUP BY c.artistId"
    )
    fun countMasteredByArtist(
        @Param("userId") userId: Long,
        @Param("artistIds") artistIds: Collection<Long>,
    ): List<ArtistMasterCountDto>

    @Query(
        "SELECT c FROM SongCardEntity c WHERE c.userId = :userId " +
            "AND (c.seenGrade IS NULL OR c.seenGrade <> c.grade) ORDER BY c.id"
    )
    fun findPending(@Param("userId") userId: Long): List<SongCardEntity>
}
