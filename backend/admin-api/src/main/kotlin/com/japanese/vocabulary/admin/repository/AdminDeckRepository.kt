package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.deck.entity.DeckEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface AdminDeckRepository : JpaRepository<DeckEntity, Long> {
    fun findByUserIdOrderByIdDesc(userId: Long): List<DeckEntity>

    // 전체 단어장(isDefault = true)은 모든 유저가 자동으로 가지므로 카운트에서 뺀다.
    @Query(
        """
        SELECT d.userId AS userId,
               SUM(CASE WHEN d.songId IS NOT NULL THEN 1 ELSE 0 END) AS songDeckCount,
               SUM(CASE WHEN d.songId IS NULL AND (d.isDefault IS NULL OR d.isDefault = false) THEN 1 ELSE 0 END) AS customDeckCount
        FROM DeckEntity d
        WHERE d.userId IN :userIds
        GROUP BY d.userId
        """,
    )
    fun summarizeByUserIds(@Param("userIds") userIds: Collection<Long>): List<AdminUserDeckSummaryProjection>
}

interface AdminUserDeckSummaryProjection {
    fun getUserId(): Long
    fun getSongDeckCount(): Long
    fun getCustomDeckCount(): Long
}
