package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.word.entity.WordEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface AdminWordRepository : JpaRepository<WordEntity, Long> {
    @Query(
        """
        SELECT w.userId AS userId, COUNT(w) AS wordCount, MAX(w.createdAt) AS lastSavedAt
        FROM WordEntity w
        WHERE w.userId IN :userIds
        GROUP BY w.userId
        """,
    )
    fun summarizeByUserIds(@Param("userIds") userIds: Collection<Long>): List<AdminUserWordSummaryProjection>

    // q 는 빈 문자열이면 무시한다 (null 대신 '' 로 받아 LIKE 파라미터 타입 문제를 피한다).
    @Query(
        value = """
        SELECT w FROM WordEntity w
        WHERE w.userId = :userId
          AND (:deckId IS NULL OR EXISTS (
              SELECT 1 FROM DeckWordEntity dw WHERE dw.deckId = :deckId AND dw.wordId = w.id
          ))
          AND (:q = '' OR w.japaneseText LIKE CONCAT('%', :q, '%') OR w.reading LIKE CONCAT('%', :q, '%'))
        """,
        countQuery = """
        SELECT COUNT(w) FROM WordEntity w
        WHERE w.userId = :userId
          AND (:deckId IS NULL OR EXISTS (
              SELECT 1 FROM DeckWordEntity dw WHERE dw.deckId = :deckId AND dw.wordId = w.id
          ))
          AND (:q = '' OR w.japaneseText LIKE CONCAT('%', :q, '%') OR w.reading LIKE CONCAT('%', :q, '%'))
        """,
    )
    fun search(
        @Param("userId") userId: Long,
        @Param("deckId") deckId: Long?,
        @Param("q") q: String,
        pageable: Pageable,
    ): Page<WordEntity>
}

interface AdminUserWordSummaryProjection {
    fun getUserId(): Long
    fun getWordCount(): Long
    fun getLastSavedAt(): Instant?
}
