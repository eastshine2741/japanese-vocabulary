package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.dto.songdetail.SongStudyBootstrapResponse
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.service.WordService
import org.springframework.stereotype.Service

/**
 * 홈탭 콜드스타트: 오늘 due 가 하나도 없을 때 추천곡 미리보기 단어에 rating 을 주면 그 곡을
 * 통째로 담고("전체 담기"와 같은 기준) 그 단어를 곧바로 리뷰한다.
 *
 * [WordService.batchAddWords] 는 트랜잭션 밖에서 재시도한다(그 클래스 주석 참고 — 이미 열린
 * 트랜잭션 안에서 부르면 rollback-only 상태라 재시도가 깨진다). 그래서 이 메서드는 전체를
 * 하나의 `@Transactional` 로 감싸지 않는다 — 각 단계가 자기 트랜잭션을 그대로 쓴다. 중간에
 * 실패해도 이미 담긴 단어는 다음 홈 진입에서 정상적으로 due 로 잡히므로 스스로 복구된다.
 */
@Service
class SongStudyBootstrapService(
    private val songDetailQueryService: SongDetailQueryService,
    private val wordService: WordService,
    private val flashcardService: FlashcardService,
    private val deckService: DeckService,
) {
    fun bootstrap(userId: Long, songId: Long, rating: Int): SongStudyBootstrapResponse {
        val words = songDetailQueryService.words(songId, userId)
        val eligible = with(songDetailQueryService) {
            words.words.filter { it.matchesDefaultFilters() && !it.isSavedForSong }
        }
        val lead = eligible.sortedWith(SongDetailQueryService.IMPORTANCE_RANKING).firstOrNull()
            ?: throw BusinessException(ErrorCode.NO_ELIGIBLE_WORDS)

        wordService.batchAddWords(
            userId,
            BatchAddWordDto(words = eligible.map { it.addRequest.toDto() }),
        )

        val wordId = wordService.getWord(userId, lead.japanese)?.id
            ?: throw BusinessException(ErrorCode.WORD_NOT_FOUND)
        val flashcardId = flashcardService.findLeadCandidate(userId, wordId)?.id
            ?: throw BusinessException(ErrorCode.FLASHCARD_NOT_FOUND)
        flashcardService.reviewCard(userId, flashcardId, rating)

        val deckId = deckService.findBySongId(userId, songId)?.id
            ?: throw BusinessException(ErrorCode.DECK_NOT_FOUND)
        val due = deckService.getDueFlashcards(userId, deckId, limit = DUE_PAGE_SIZE)

        return SongStudyBootstrapResponse(
            deckId = deckId,
            cards = due.items,
            totalCount = due.totalCount,
            nextDueAt = due.nextDueAt,
        )
    }

    private fun AddWordRequest.toDto() = AddWordDto(
        japanese = japanese,
        reading = reading,
        senses = senses,
        songId = songId,
    )

    companion object {
        private const val DUE_PAGE_SIZE = 20
    }
}
