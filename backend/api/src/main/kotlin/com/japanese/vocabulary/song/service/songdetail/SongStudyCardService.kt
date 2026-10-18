package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.repository.DeckWordRepository
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.flashcard.service.FlashcardReviewService
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.dto.songdetail.SongStudyCardDto
import com.japanese.vocabulary.song.dto.songdetail.SongStudyCardsResponse
import com.japanese.vocabulary.song.dto.songdetail.SongWordReviewResponse
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.WordSenseDto
import com.japanese.vocabulary.word.dto.songword.WordInSongItemDto
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.SenseEnricher
import com.japanese.vocabulary.word.service.SenseEnricher.toDtos
import com.japanese.vocabulary.word.service.WordService
import com.japanese.vocabulary.word.service.songword.SongWordQueryService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

/**
 * 곡 학습 세션의 카드는 아직 담지 않은 단어도 포함하고, 단어는 rating 을 주는 그 한 장만 담는다.
 * 세션에 들어가는 단어를 미리 담으면 안 본 단어까지 곡 단어장 due 로 쌓여 매일 밀린다.
 */
@Service
class SongStudyCardService(
    private val songWordQueryService: SongWordQueryService,
    private val wordRepository: WordRepository,
    private val deckWordRepository: DeckWordRepository,
    private val songRepository: SongRepository,
    private val wordService: WordService,
    private val flashcardService: FlashcardService,
    private val flashcardReviewService: FlashcardReviewService,
    private val deckService: DeckService,
    private val clock: Clock,
) {
    /**
     * 곡 상세에서 고른 단어(lead) 또는 홈 콜드스타트 추천곡의 세션. lead → 곡 단어장 due → 아직 안 담은 기본 단어
     * (등장순) 순서다. lead 가 없으면 안 담은 기본 단어 중 중요도 1위가 lead 다.
     */
    @Transactional(readOnly = true)
    fun cards(userId: Long, songId: Long, leadJapanese: String?): SongStudyCardsResponse {
        val words = songWordQueryService.words(songId, userId).words
        val deckId = deckService.findBySongId(userId, songId)?.id
        val unsaved = with(songWordQueryService) { words.filter { it.isTierWord() && !it.isSavedForSong } }
        val lead = if (leadJapanese != null) {
            words.findByKey(leadJapanese) ?: throw BusinessException(ErrorCode.WORD_NOT_FOUND)
        } else {
            unsaved.sortedWith(SongWordQueryService.IMPORTANCE_RANKING).firstOrNull()
        }

        val leadCard = lead?.let { assemble(userId, deckId, listOf(it), dueOnly = false).single() }
        val deckDue = deckId?.let { deckService.getDueFlashcards(userId, it).items }.orEmpty()
            .filter { it.wordId != leadCard?.wordId }
            .map { SongStudyCardDto.of(it, inSongDeck = true) }
        val queuedWordIds = (deckDue.map { it.wordId } + leadCard?.wordId).filterNotNull().toSet()
        val rest = assemble(userId, deckId, unsaved.filter { it.addRequest.japanese != lead?.addRequest?.japanese }, dueOnly = true)
            .filter { it.wordId == null || it.wordId !in queuedWordIds }

        val cards = listOfNotNull(leadCard) + deckDue + rest
        return SongStudyCardsResponse(deckId = deckId, cards = cards, totalCount = cards.size)
    }

    /**
     * [words] 순서대로 카드를 만든다. 담긴 단어는 실제 카드, 안 담긴 단어는 새 카드 모양이다.
     * [dueOnly] 면 담긴 단어 중 아직 due 가 아닌 것은 뺀다(안 담긴 단어는 늘 due 다).
     */
    fun assemble(userId: Long, deckId: Long?, words: List<WordInSongItemDto>, dueOnly: Boolean): List<SongStudyCardDto> {
        val unique = words.distinctBy { it.addRequest.japanese }
        if (unique.isEmpty()) return emptyList()
        val keys = unique.flatMap { listOf(it.addRequest.japanese, it.japanese) }.distinct()
        val savedByJapanese = wordRepository.findByUserIdAndJapaneseTextIn(userId, keys).associateBy { it.japaneseText }
        // 저장 키는 candidate 의 japanese 가 아니라 addRequest 의 japanese 다.
        fun savedIdOf(word: WordInSongItemDto) = (savedByJapanese[word.addRequest.japanese] ?: savedByJapanese[word.japanese])?.id
        val cardByWordId = flashcardService.getFlashcardsForWords(userId, unique.mapNotNull { savedIdOf(it) })
            .items.associateBy { it.wordId }
        val deckWordIds = deckId?.let { id -> deckWordRepository.findByDeckId(id).map { it.wordId }.toSet() }.orEmpty()
        val now = Instant.now(clock)
        val newIntervals = flashcardService.newCardIntervals()
        val songs = SenseEnricher.loadSongs(unique.flatMap { it.addRequest.senses }, songRepository)

        return unique.mapNotNull { word ->
            val card = savedIdOf(word)?.let { cardByWordId[it] }
            when {
                card == null -> SongStudyCardDto(
                    id = null,
                    wordId = null,
                    japanese = word.addRequest.japanese,
                    reading = word.addRequest.reading,
                    senses = word.addRequest.senses.toDtos(songs),
                    state = 0,
                    due = now.toString(),
                    intervals = newIntervals,
                    memory = FlashcardMemory.REMAINING,
                    inSongDeck = false,
                )
                dueOnly && card.memory != FlashcardMemory.REMAINING && Instant.parse(card.due) > now -> null
                card.wordId in deckWordIds -> SongStudyCardDto.of(card, inSongDeck = true)
                // 다른 곡에서 담은 단어는 이 곡 예문이 rating 때에야 저장된다 — 그 전에도 보이게 붙인다.
                else -> SongStudyCardDto.of(card, inSongDeck = false)
                    .let { it.copy(senses = it.senses.withSongExamples(word.addRequest.senses.toDtos(songs))) }
            }
        }
    }

    private fun List<WordSenseDto>.withSongExamples(songSenses: List<WordSenseDto>): List<WordSenseDto> {
        val songByMeaning = songSenses.associateBy { it.meaning }
        val merged = map { sense ->
            val song = songByMeaning[sense.meaning] ?: return@map sense
            sense.copy(examples = (song.examples + sense.examples).distinctBy { it.songId to it.lineIndex })
        }
        val savedMeanings = map { it.meaning }.toSet()
        return merged + songSenses.filter { it.meaning !in savedMeanings }
    }

    /**
     * 곡 단어장에 없는 카드의 rating. 그 단어 하나만 담고(곡 단어장이 없으면 만든다) 곧바로 리뷰한다.
     * [WordService.addWord] 가 트랜잭션 밖에서 재시도하므로 `@Transactional` 이 아니다.
     */
    fun review(userId: Long, songId: Long, japanese: String, rating: Int): SongWordReviewResponse {
        // 담은 뒤 리뷰에서 거절되면 단어만 남는다 — 담기 전에 막는다.
        if (rating !in 1..4) throw BusinessException(ErrorCode.INVALID_RATING)
        val word = songWordQueryService.words(songId, userId).words.findByKey(japanese)
            ?: throw BusinessException(ErrorCode.WORD_NOT_FOUND)
        val request = word.addRequest
        val wordId = wordService.addWord(
            userId,
            AddWordDto(japanese = request.japanese, reading = request.reading, senses = request.senses, songId = request.songId),
        )
        val flashcardId = flashcardService.findLeadCandidate(userId, wordId)?.id
            ?: throw BusinessException(ErrorCode.FLASHCARD_NOT_FOUND)
        val reviewed = flashcardReviewService.review(userId, flashcardId, rating)
        val deckId = deckService.findBySongId(userId, songId)?.id
            ?: throw BusinessException(ErrorCode.DECK_NOT_FOUND)
        return SongWordReviewResponse(
            deckId = deckId,
            id = reviewed.id,
            wordId = wordId,
            memory = reviewed.memory,
            rewardCards = reviewed.rewardCards,
        )
    }

    private fun List<WordInSongItemDto>.findByKey(japanese: String): WordInSongItemDto? =
        firstOrNull { it.addRequest.japanese == japanese } ?: firstOrNull { it.japanese == japanese }
}
