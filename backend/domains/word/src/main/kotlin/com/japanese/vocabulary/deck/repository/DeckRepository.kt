package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface DeckRepository : JpaRepository<DeckEntity, Long> {
    fun findByUserIdAndSongId(userId: Long, songId: Long): DeckEntity?

    fun findByUserIdAndIsDefaultTrue(userId: Long): DeckEntity?

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: Pageable): List<DeckEntity>

    // 전체 단어장은 /decks/all 로 따로 노출되므로 목록 페이징에서 제외한다.
    fun findByUserIdAndIsDefaultIsNullOrderByCreatedAtDesc(userId: Long, pageable: Pageable): List<DeckEntity>

    fun findByUserIdAndIsDefaultIsNullAndIdLessThanOrderByCreatedAtDesc(
        userId: Long,
        id: Long,
        pageable: Pageable,
    ): List<DeckEntity>

    // Returns ids (not FlashcardEntity) — entities stay inside their own module (see CLAUDE.md);
    // the flashcard module re-loads them when assembling the response.
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

    // COALESCE: SUM over zero rows returns NULL, which fails projection mapping to non-null Int.
    // words JOIN 은 소유자 스코프용 — 이게 없으면 목록의 wordCount 가 상세(findDeckDetailStats,
    // user_id 로 거르는)와 어긋난다. flashcard 는 불변식상 항상 있지만, 깨졌을 때 word 가 통째로
    // 안 보이는 것보다 통계만 0 으로 나오는 게 나으므로 LEFT JOIN 을 유지한다.
    @Query(nativeQuery = true, value = """
        SELECT dw.deck_id AS deckId,
               COUNT(DISTINCT dw.word_id) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= :now THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount
        FROM deck_word dw
        JOIN words w ON w.id = dw.word_id AND w.user_id = :userId
        LEFT JOIN flashcards f ON f.word_id = dw.word_id
        WHERE dw.deck_id IN (:deckIds)
        GROUP BY dw.deck_id
    """)
    fun findDeckStats(
        @Param("userId") userId: Long,
        @Param("deckIds") deckIds: List<Long>,
        @Param("now") now: Instant,
    ): List<DeckStatsProjection>

    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= :now THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount,
               COALESCE(SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END), 0) AS studyingCount,
               COALESCE(SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END), 0) AS newWordCount
        FROM flashcards f
        WHERE f.user_id = :userId
    """)
    fun findAllDeckDetailStats(@Param("userId") userId: Long, @Param("now") now: Instant): DeckDetailStatsProjection

    // deck_word 를 기준으로 세야 목록(findDeckStats)과 같은 wordCount 가 나온다.
    // flashcards 를 기준으로 세면 flashcard 가 아직 없는 word 가 상세에서만 누락된다.
    @Query(nativeQuery = true, value = """
        SELECT COUNT(*) AS wordCount,
               COALESCE(SUM(CASE WHEN f.due <= :now THEN 1 ELSE 0 END), 0) AS dueCount,
               COALESCE(SUM(CASE WHEN f.state = 1 THEN 1 ELSE 0 END), 0) AS masteredCount,
               COALESCE(SUM(CASE WHEN (f.state = 0 AND f.last_review IS NOT NULL) OR f.state = 2 THEN 1 ELSE 0 END), 0) AS studyingCount,
               COALESCE(SUM(CASE WHEN f.state = 0 AND f.last_review IS NULL THEN 1 ELSE 0 END), 0) AS newWordCount
        FROM deck_word dw
        JOIN words w ON w.id = dw.word_id AND w.user_id = :userId
        LEFT JOIN flashcards f ON f.word_id = dw.word_id
        WHERE dw.deck_id = :deckId
    """)
    fun findDeckDetailStats(
        @Param("deckId") deckId: Long,
        @Param("userId") userId: Long,
        @Param("now") now: Instant,
    ): DeckDetailStatsProjection
}

interface DeckStatsProjection {
    fun getDeckId(): Long
    fun getWordCount(): Int
    fun getDueCount(): Int
    fun getMasteredCount(): Int
}

interface DeckDetailStatsProjection {
    fun getWordCount(): Int
    fun getDueCount(): Int
    fun getMasteredCount(): Int
    fun getStudyingCount(): Int
    fun getNewWordCount(): Int
}
