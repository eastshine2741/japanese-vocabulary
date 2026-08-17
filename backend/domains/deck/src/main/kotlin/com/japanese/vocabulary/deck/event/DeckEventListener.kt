package com.japanese.vocabulary.deck.event

import org.springframework.stereotype.Component
import com.japanese.vocabulary.deck.repository.DeckWordRepository
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.word.event.WordDeletedEvent
import com.japanese.vocabulary.word.event.WordSavedEvent
import org.springframework.context.event.EventListener
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class DeckEventListener(
    private val deckService: DeckService,
    private val deckWordRepository: DeckWordRepository,
) {
    /**
     * 담은 단어는 전체 단어장에 항상 연결되고, 곡 화면에서 담았다면 곡 단어장에도 연결된다.
     *
     * 두 연결은 **서로 다른 트랜잭션**이다. `deck_word` 는 deck 구성의 유일한 기록이고
     * (song_words 가 사라져 재구성 경로가 없다) 이 리스너는 커밋 뒤에 도는 best-effort 쓰기라,
     * 곡 단어장 생성이 실패했다고 전체 단어장 연결까지 되돌리면 단어가 어느 단어장에도 없는
     * 상태로 영구히 남는다. 그 상태는 사용자가 다시 담아서 복구할 수도 없다 — 이미 저장된
     * 단어라 SongDetail 이 '담기'가 아니라 '상세로 이동'을 띄우기 때문에 이벤트가 다시 안 뜬다.
     *
     * DML 은 [DeckService] 쪽 REQUIRES_NEW 안에서 일어난다 (CLAUDE.md 규칙).
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onWordSaved(event: WordSavedEvent) {
        retryOnConflict { deckService.linkWordToDefaultDeck(event.userId, event.wordId) }
        event.songId?.let { songId ->
            retryOnConflict { deckService.linkWordToSongDeck(event.userId, songId, event.wordId) }
        }
    }

    /**
     * 같은 유저가 동시에 두 단어를 담으면 두 요청이 각자 deck 을 만들려 하고 한쪽이
     * `UNIQUE(user_id, song_id)` / `UNIQUE(user_id, is_default)` 에 걸린다. 재시도는 새 트랜잭션에서
     * 다시 조회하므로 이긴 쪽이 만든 deck 을 보고 연결만 하고 끝난다.
     */
    private fun retryOnConflict(block: () -> Unit) {
        var lastFailure: DataIntegrityViolationException? = null
        repeat(MAX_CONFLICT_ATTEMPTS) {
            try {
                block()
                return
            } catch (e: DataIntegrityViolationException) {
                lastFailure = e
            }
        }
        throw lastFailure!!
    }

    /**
     * `deck_word` 는 `words` 에 FK 를 갖고 있어 publisher 커밋 전에 정리되어야 한다.
     * 그래서 AFTER_COMMIT 이 아니라 같은 트랜잭션에서 처리한다 — see CLAUDE.md.
     */
    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    fun onWordDeleted(event: WordDeletedEvent) {
        deckWordRepository.deleteByWordId(event.wordId)
    }

    private companion object {
        // 경쟁 상대의 트랜잭션은 INSERT 하나짜리라 짧다. 3회면 충분하다.
        const val MAX_CONFLICT_ATTEMPTS = 3
    }
}
