package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckWordEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface DeckWordRepository : JpaRepository<DeckWordEntity, Long> {
    fun findByDeckId(deckId: Long): List<DeckWordEntity>
    fun existsByDeckIdAndWordId(deckId: Long, wordId: Long): Boolean

    @Modifying(flushAutomatically = true)
    @Query(
        value = """
            INSERT INTO deck_word (deck_id, word_id)
            VALUES (:deckId, :wordId)
            ON DUPLICATE KEY UPDATE word_id = VALUES(word_id)
        """,
        nativeQuery = true,
    )
    fun insertIfAbsent(@Param("deckId") deckId: Long, @Param("wordId") wordId: Long): Int

    /*
     * flushAutomatically 필수: AUTO flush 는 겹치는 테이블만 내보내므로 없으면 예약된 flashcard 삭제 전에
     * bulk delete 가 나가 FK 순서가 깨진다.
     * clearAutomatically 는 끈다: 호출자의 word/deck 엔티티가 detach 되어 뒤따르는 delete 가 merge 를 거친다.
     */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM DeckWordEntity dw WHERE dw.wordId = :wordId")
    fun deleteByWordId(@Param("wordId") wordId: Long)

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM DeckWordEntity dw WHERE dw.deckId = :deckId")
    fun deleteByDeckId(@Param("deckId") deckId: Long)

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM DeckWordEntity dw WHERE dw.wordId IN :wordIds")
    fun deleteByWordIdIn(@Param("wordIds") wordIds: Collection<Long>)

    /** 전체 단어장을 빼면 이 단어장에만 속한 단어. 단어장 삭제 때 함께 지워질 대상이다. */
    @Query(
        """
            SELECT dw.wordId FROM DeckWordEntity dw
            WHERE dw.deckId = :deckId
              AND NOT EXISTS (
                SELECT 1 FROM DeckWordEntity other, DeckEntity d
                WHERE other.wordId = dw.wordId
                  AND d.id = other.deckId
                  AND other.deckId <> :deckId
                  AND d.isDefault IS NULL
              )
        """
    )
    fun findExclusiveWordIds(@Param("deckId") deckId: Long): List<Long>
}
