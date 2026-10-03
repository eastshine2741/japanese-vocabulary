package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.flashcard.model.FlashcardStudyState
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.dto.songdetail.SongCoverageDto
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierDto
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierKey
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierStudyResponse
import com.japanese.vocabulary.song.dto.songdetail.SongWordTiersDto
import com.japanese.vocabulary.song.dto.songdetail.WordInSongItemDto
import com.japanese.vocabulary.song.dto.songdetail.WordsInSongDto
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.WordService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

@Service
class SongWordTierService(
    private val songDetailQueryService: SongDetailQueryService,
    private val lyricRepository: LyricRepository,
    private val wordRepository: WordRepository,
    private val flashcardRepository: FlashcardRepository,
    private val flashcardService: FlashcardService,
    private val wordService: WordService,
    private val deckService: DeckService,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun tiers(songId: Long, userId: Long): SongWordTiersDto {
        val song = load(songId, userId)
        val now = Instant.now(clock)

        val tiers = SongWordTierKey.current.map { key ->
            val tierWords = song.tiers[key].orEmpty()
            val cards = tierWords.map { song.cardOf(it) }
            val states = cards.filterNotNull().map { FlashcardStudyState.of(it) }
            val memories = cards.map { FlashcardMemory.of(it) }
            // 학습 진입과 같은 집합·순서다. 같은 저장 키로 모이는 단어는 카드 하나라 한 번만 센다.
            val dueWords = tierWords.filter { FlashcardMemory.isDue(song.cardOf(it), now) }.distinctBy { it.addRequest.japanese }
            SongWordTierDto(
                key = key,
                order = key.order,
                name = key.displayName,
                description = key.description(tierWords.size),
                wordJapanese = tierWords.map { it.japanese },
                totalCount = tierWords.size,
                knownCount = states.count { it == FlashcardStudyState.MASTERED },
                learningCount = states.count { it == FlashcardStudyState.STUDYING },
                longTermCount = memories.count { it == FlashcardMemory.LONG_TERM },
                shortTermCount = memories.count { it == FlashcardMemory.SHORT_TERM },
                dueCount = dueWords.size,
                duePreviewWords = dueWords.take(DUE_PREVIEW_SIZE).map { it.japanese },
            )
        }
        return SongWordTiersDto(songId = songId, tiers = tiers)
    }

    /**
     * 이 곡 이해도. tier 단어가 전부 장기기억인 줄이 "이해하는 가사" 다. tier 단어가 없는 줄
     * (간주·기호·조사만 있는 줄)은 분모에서도 뺀다 — 공짜로 채워지는 줄이 이해도를 부풀리지 않게.
     */
    @Transactional(readOnly = true)
    fun coverage(songId: Long, userId: Long): SongCoverageDto {
        val song = load(songId, userId)
        val lines = song.words.lineWordIndexes.values
            .map { indexes -> indexes.map { song.words.words[it] }.filter { it.isTierWord() } }
            .filter { it.isNotEmpty() }
        val knownLines = lines.count { line -> line.all { FlashcardMemory.of(song.cardOf(it)) == FlashcardMemory.LONG_TERM } }
        return SongCoverageDto(songId = songId, totalLines = lines.size, knownLines = knownLines)
    }

    /**
     * 단계 학습 진입. 현재 단계는 due 단어(한 번도 리뷰 안 했거나 due 가 지난 단어)만 연다 —
     * CTA 가 보여 준 `dueCount` 와 카드 수가 같아야 한다. 구버전 단계는 due 와 무관하게 전부 연다.
     *
     * 연 단어는 전부 다시 담는다. upsert 라 안전하고, 다른 곡에서 담은 단어도 이 곡 단어장에 연결된다.
     * [WordService.batchAddWords] 가 트랜잭션 밖에서 재시도하므로 이 메서드는 `@Transactional` 이
     * 아니다([SongStudyBootstrapService] 와 같은 이유).
     */
    fun study(userId: Long, songId: Long, key: SongWordTierKey): SongWordTierStudyResponse {
        val studyWords = if (key.legacy) {
            // 뜻이 없는 단어는 담을 수 없다(MEANING_REQUIRED) — 카드가 될 수 없으니 뺀다.
            legacyTiers(songId, userId)[key].orEmpty().filter { it.addRequest.senses.isNotEmpty() }
        } else {
            val song = load(songId, userId)
            val now = Instant.now(clock)
            song.tiers[key].orEmpty().filter { FlashcardMemory.isDue(song.cardOf(it), now) }
        }
        if (studyWords.isEmpty()) throw BusinessException(ErrorCode.NO_ELIGIBLE_WORDS)

        wordService.batchAddWords(userId, BatchAddWordDto(words = studyWords.map { it.addRequest.toDto() }))

        // 저장 키는 candidate 의 japanese 가 아니라 addRequest 의 japanese 다.
        val savedJapanese = studyWords.map { it.addRequest.japanese }
        val wordIdByJapanese = wordRepository.findByUserIdAndJapaneseTextIn(userId, savedJapanese.distinct())
            .associate { it.japaneseText to it.id!! }
        val cards = flashcardService.getFlashcardsForWords(userId, savedJapanese.mapNotNull { wordIdByJapanese[it] })
        val deckId = deckService.findBySongId(userId, songId)?.id
            ?: throw BusinessException(ErrorCode.DECK_NOT_FOUND)

        return SongWordTierStudyResponse(deckId = deckId, cards = cards.items, totalCount = cards.items.size)
    }

    private class SongTierContext(
        val words: WordsInSongDto,
        val tiers: Map<SongWordTierKey, List<WordInSongItemDto>>,
        private val cardByJapanese: Map<String, FlashcardEntity>,
    ) {
        /** 복습 상태는 유저의 단어 기준이다. 다른 곡에서 담아 익힌 단어도 이 곡에서 아는 단어다. */
        fun cardOf(word: WordInSongItemDto): FlashcardEntity? =
            cardByJapanese[word.addRequest.japanese] ?: cardByJapanese[word.japanese]
    }

    private fun load(songId: Long, userId: Long): SongTierContext {
        val words = songDetailQueryService.words(songId, userId)
        val tierWords = words.words.filter { it.isTierWord() }
        val tiers = SongWordTierClassifier.classifyCurrent(tierWords, rawLines(songId))

        val keys = tierWords.flatMap { listOf(it.japanese, it.addRequest.japanese) }.distinct()
        val savedWords = wordRepository.findByUserIdAndJapaneseTextIn(userId, keys)
        val cardByWordId = flashcardRepository.findByUserIdAndWordIdIn(userId, savedWords.map { it.id!! })
            .associateBy { it.wordId }
        val cardByJapanese = savedWords.mapNotNull { word -> cardByWordId[word.id]?.let { word.japaneseText to it } }.toMap()
        return SongTierContext(words, tiers, cardByJapanese)
    }

    /**
     * tier 단어 = "전체 담기" 와 같은 기본 필터 통과분 중 뜻이 있는 단어. 뜻이 없으면 카드가 될 수 없어
     * 영원히 남음이라, 넣으면 그 단계가 끝나지 않고 그 단어가 든 줄은 이해도에 잡히지 않는다.
     */
    private fun WordInSongItemDto.isTierWord(): Boolean =
        with(songDetailQueryService) { matchesDefaultFilters() } && addRequest.senses.isNotEmpty()

    /** 구버전 4단계. 기본 필터 통과분을 나누며 뜻 없는 단어도 들어 있다(학습 진입에서 뺀다). */
    private fun legacyTiers(songId: Long, userId: Long): Map<SongWordTierKey, List<WordInSongItemDto>> {
        val words = songDetailQueryService.words(songId, userId)
        val eligible = with(songDetailQueryService) { words.words.filter { it.matchesDefaultFilters() } }
        return SongWordTierClassifier.classify(eligible, rawLines(songId))
    }

    // words() 가 곡·가사 존재를 이미 검증했다.
    private fun rawLines(songId: Long) = lyricRepository.findActiveBySongId(songId)?.rawContent.orEmpty()

    private fun AddWordRequest.toDto() = AddWordDto(
        japanese = japanese,
        reading = reading,
        senses = senses,
        songId = songId,
    )

    companion object {
        private const val DUE_PREVIEW_SIZE = 3
    }
}
