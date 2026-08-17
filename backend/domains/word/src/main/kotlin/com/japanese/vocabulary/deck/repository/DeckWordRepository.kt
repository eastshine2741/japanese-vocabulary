package com.japanese.vocabulary.deck.repository

import com.japanese.vocabulary.deck.entity.DeckWordEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface DeckWordRepository : JpaRepository<DeckWordEntity, Long> {
    fun findByDeckId(deckId: Long): List<DeckWordEntity>
    fun existsByDeckIdAndWordId(deckId: Long, wordId: Long): Boolean

    /*
     * flushAutomatically 는 필수다. 두 삭제 모두 `words` / `decks` 행을 지우기 직전에 불리는데,
     * Hibernate 의 AUTO flush 는 질의 대상 테이블과 겹치는 변경만 내보내므로 이게 없으면
     * 앞서 예약된 flashcard 삭제가 남아 있는 채로 bulk delete 가 나가고 FK 순서가 깨진다.
     *
     * clearAutomatically 는 일부러 켜지 않는다. 영속성 컨텍스트를 통째로 비우면 호출자가 들고
     * 있던 word/deck 엔티티까지 detach 돼서 바로 뒤의 delete 가 merge 를 거치게 된다.
     */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM DeckWordEntity dw WHERE dw.wordId = :wordId")
    fun deleteByWordId(@Param("wordId") wordId: Long)

    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM DeckWordEntity dw WHERE dw.deckId = :deckId")
    fun deleteByDeckId(@Param("deckId") deckId: Long)
}
