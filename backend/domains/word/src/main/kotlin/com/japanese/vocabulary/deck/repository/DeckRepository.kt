package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.dto.SongDeckRefDto
import com.japanese.vocabulary.deck.dto.SongDeckReviewDto
import com.japanese.vocabulary.deck.entity.DeckEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface DeckRepository : JpaRepository<DeckEntity, Long> {
    fun findByUserIdAndSongId(userId: Long, songId: Long): DeckEntity?

    fun findByUserIdAndSongIdIn(userId: Long, songIds: Collection<Long>): List<DeckEntity>

    fun findByUserIdAndIsDefaultTrue(userId: Long): DeckEntity?

    @Query("""
        SELECT d.songId FROM DeckEntity d, DeckWordEntity dw
        WHERE dw.deckId = d.id AND d.userId = :userId AND dw.wordId = :wordId AND d.songId IS NOT NULL
    """)
    fun findSongIdsContainingWord(@Param("userId") userId: Long, @Param("wordId") wordId: Long): List<Long>

    /** 곡 단어장 전부를 만든 순서대로. 보상 카드 채우기가 먼저 담은 유저에게 앞 순번을 준다. */
    @Query(
        "SELECT new com.japanese.vocabulary.deck.dto.SongDeckRefDto(d.userId, d.songId) FROM DeckEntity d " +
            "WHERE d.songId IS NOT NULL ORDER BY d.createdAt, d.id"
    )
    fun findSongDecksInCreationOrder(): List<SongDeckRefDto>

    @Query(
        "SELECT new com.japanese.vocabulary.deck.dto.SongDeckReviewDto(d.songId, COUNT(f.id), " +
            "SUM(CASE WHEN f.due <= :now THEN 1L ELSE 0L END)) " +
            "FROM DeckEntity d, DeckWordEntity dw, FlashcardEntity f " +
            "WHERE dw.deckId = d.id AND f.wordId = dw.wordId AND d.userId = :userId AND d.songId IN :songIds " +
            "AND f.lastReview IS NOT NULL GROUP BY d.songId"
    )
    fun findSongDeckReviews(
        @Param("userId") userId: Long,
        @Param("songIds") songIds: Collection<Long>,
        @Param("now") now: Instant,
    ): List<SongDeckReviewDto>

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): List<DeckEntity>

    // 전체 단어장은 /decks/all 로 따로 노출되므로 목록 페이징에서 제외한다.
    fun findByUserIdAndIsDefaultIsNullOrderByCreatedAtDesc(userId: Long, pageable: Pageable): List<DeckEntity>

    fun findByUserIdAndIsDefaultIsNullAndIdLessThanOrderByCreatedAtDesc(
        userId: Long,
        id: Long,
        pageable: Pageable,
    ): List<DeckEntity>

    // Returns ids, not FlashcardEntity: entities stay inside their own module.
    @Query("""
        SELECT f.id FROM DeckWordEntity dw, FlashcardEntity f
        WHERE dw.wordId = f.wordId AND dw.deckId = :deckId
        AND f.userId = :userId AND f.due <= :now
        ORDER BY f.due ASC, f.id ASC
    """)
    fun findDueFlashcardIds(
        @Param("userId") userId: Long,
        @Param("deckId") deckId: Long,
        @Param("now") now: Instant,
        pageable: Pageable,
    ): List<Long>

    @Query("""
        SELECT COUNT(f.id) FROM DeckWordEntity dw, FlashcardEntity f
        WHERE dw.wordId = f.wordId AND dw.deckId = :deckId
        AND f.userId = :userId AND f.due <= :now
    """)
    fun countDueFlashcards(
        @Param("userId") userId: Long,
        @Param("deckId") deckId: Long,
        @Param("now") now: Instant,
    ): Long

    @Query("""
        SELECT MIN(f.due) FROM DeckWordEntity dw, FlashcardEntity f
        WHERE dw.wordId = f.wordId AND dw.deckId = :deckId
        AND f.userId = :userId AND f.due > :now
    """)
    fun findNextDueAt(
        @Param("userId") userId: Long,
        @Param("deckId") deckId: Long,
        @Param("now") now: Instant,
    ): Instant?

    // mastered/studying/new 판정은 FlashcardStudyState 와 같아야 한다.
    // longTerm/shortTerm 은 FSRS state 가 아니라 stability 기준이다 — 판정은 FlashcardMemory 와 같아야 한다.
    // COALESCE: SUM over zero rows returns NULL, which fails projection mapping to non-null Int.
    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= :now THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount,
               COALESCE(SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END), 0) AS studyingCount,
               COALESCE(SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END), 0) AS newWordCount,
               COALESCE(SUM(CASE WHEN f.last_review IS NOT NULL AND f.stability >= :longTermStabilityDays THEN 1 ELSE 0 END), 0) AS longTermCount,
               COALESCE(SUM(CASE WHEN f.last_review IS NOT NULL AND f.stability < :longTermStabilityDays THEN 1 ELSE 0 END), 0) AS shortTermCount
        FROM flashcards f
        WHERE f.user_id = :userId
    """)
    fun findAllDeckDetailStats(
        @Param("userId") userId: Long,
        @Param("now") now: Instant,
        @Param("longTermStabilityDays") longTermStabilityDays: Double,
    ): DeckDetailStatsProjection

    // deck_word 를 기준으로 세야 목록(DeckStatsReader)과 같은 wordCount 가 나온다.
    // flashcards 를 기준으로 세면 flashcard 가 아직 없는 word 가 상세에서만 누락된다.
    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= :now THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount,
               COALESCE(SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END), 0) AS studyingCount,
               COALESCE(SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END), 0) AS newWordCount,
               COALESCE(SUM(CASE WHEN f.last_review IS NOT NULL AND f.stability >= :longTermStabilityDays THEN 1 ELSE 0 END), 0) AS longTermCount,
               COALESCE(SUM(CASE WHEN f.last_review IS NOT NULL AND f.stability < :longTermStabilityDays THEN 1 ELSE 0 END), 0) AS shortTermCount
        FROM deck_word dw
        JOIN words w ON w.id = dw.word_id AND w.user_id = :userId
        LEFT JOIN flashcards f ON f.word_id = dw.word_id
        WHERE dw.deck_id = :deckId
    """)
    fun findDeckDetailStats(
        @Param("deckId") deckId: Long,
        @Param("userId") userId: Long,
        @Param("now") now: Instant,
        @Param("longTermStabilityDays") longTermStabilityDays: Double,
    ): DeckDetailStatsProjection
}

interface DeckDetailStatsProjection {
    fun getWordCount(): Int
    fun getDueCount(): Int
    fun getMasteredCount(): Int
    fun getStudyingCount(): Int
    fun getNewWordCount(): Int
    fun getLongTermCount(): Int
    fun getShortTermCount(): Int
}
