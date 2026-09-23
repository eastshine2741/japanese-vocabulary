package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.flashcard.model.FlashcardStudyState
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierDto
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierKey
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierStudyResponse
import com.japanese.vocabulary.song.dto.songdetail.SongWordTiersDto
import com.japanese.vocabulary.song.dto.songdetail.WordInSongItemDto
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.WordService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongWordTierService(
    private val songDetailQueryService: SongDetailQueryService,
    private val lyricRepository: LyricRepository,
    private val wordRepository: WordRepository,
    private val flashcardRepository: FlashcardRepository,
    private val flashcardService: FlashcardService,
    private val wordService: WordService,
    private val deckService: DeckService,
) {
    @Transactional(readOnly = true)
    fun tiers(songId: Long, userId: Long): SongWordTiersDto {
        val (eligible, classified) = classify(songId, userId)

        // 복습 상태는 유저의 단어 기준이다. 다른 곡에서 담아 익힌 단어도 이 곡에서 아는 단어다.
        val savedWords = wordRepository.findByUserIdAndJapaneseTextIn(userId, eligible.map { it.japanese })
        val wordIdByJapanese = savedWords.associate { it.japaneseText to it.id!! }
        val stateByWordId = flashcardRepository.findByUserIdAndWordIdIn(userId, wordIdByJapanese.values)
            .associate { it.wordId to FlashcardStudyState.of(it) }

        val tiers = SongWordTierKey.entries.sortedBy { it.order }.map { key ->
            val tierWords = classified[key].orEmpty()
            val states = tierWords.mapNotNull { word -> wordIdByJapanese[word.japanese]?.let { stateByWordId[it] } }
            SongWordTierDto(
                key = key,
                order = key.order,
                name = key.displayName,
                description = key.description,
                wordJapanese = tierWords.map { it.japanese },
                totalCount = tierWords.size,
                knownCount = states.count { it == FlashcardStudyState.MASTERED },
                learningCount = states.count { it == FlashcardStudyState.STUDYING },
            )
        }
        return SongWordTiersDto(songId = songId, tiers = tiers)
    }

    /**
     * 단계 학습 진입. due·복습 상태와 무관하게 그 단계 단어 전부를 카드로 연다 — 곡 덱의 due
     * 큐를 열면 다른 단계 단어가 섞이고, 이미 익힌 단어는 빠져서 진행 바 숫자와 어긋난다.
     *
     * 이미 담긴 단어까지 전부 다시 담는다. upsert 라 안전하고, 다른 곡에서 담은 단어도 이 곡
     * 단어장에 연결된다. [WordService.batchAddWords] 가 트랜잭션 밖에서 재시도하므로 이 메서드는
     * `@Transactional` 이 아니다([SongStudyBootstrapService] 와 같은 이유).
     */
    fun study(userId: Long, songId: Long, key: SongWordTierKey): SongWordTierStudyResponse {
        // 뜻이 없는 단어는 담을 수 없다(MEANING_REQUIRED) — 카드가 될 수 없으니 뺀다.
        val tierWords = classify(songId, userId).second[key].orEmpty().filter { it.addRequest.senses.isNotEmpty() }
        if (tierWords.isEmpty()) throw BusinessException(ErrorCode.NO_ELIGIBLE_WORDS)

        wordService.batchAddWords(userId, BatchAddWordDto(words = tierWords.map { it.addRequest.toDto() }))

        // 저장 키는 candidate 의 japanese 가 아니라 addRequest 의 japanese 다.
        val savedJapanese = tierWords.map { it.addRequest.japanese }
        val wordIdByJapanese = wordRepository.findByUserIdAndJapaneseTextIn(userId, savedJapanese.distinct())
            .associate { it.japaneseText to it.id!! }
        val cards = flashcardService.getFlashcardsForWords(userId, savedJapanese.mapNotNull { wordIdByJapanese[it] })
        val deckId = deckService.findBySongId(userId, songId)?.id
            ?: throw BusinessException(ErrorCode.DECK_NOT_FOUND)

        return SongWordTierStudyResponse(deckId = deckId, cards = cards.items, totalCount = cards.items.size)
    }

    /**
     * 단계는 "전체 담기" 와 같은 단어 집합(기본 필터 통과분)을 나눈다. 필터 밖 단어(대명사·접속사 등)는
     * 어느 단계에도 없다 — 단어 탭에서 개별로 담는 길은 그대로다.
     */
    private fun classify(songId: Long, userId: Long): Pair<List<WordInSongItemDto>, Map<SongWordTierKey, List<WordInSongItemDto>>> {
        val words = songDetailQueryService.words(songId, userId)
        val eligible = with(songDetailQueryService) { words.words.filter { it.matchesDefaultFilters() } }
        // words() 가 곡·가사 존재를 이미 검증했다.
        val rawLines = lyricRepository.findActiveBySongId(songId)?.rawContent.orEmpty()
        return eligible to SongWordTierClassifier.classify(eligible, rawLines)
    }

    private fun AddWordRequest.toDto() = AddWordDto(
        japanese = japanese,
        reading = reading,
        senses = senses,
        songId = songId,
    )
}
