package com.japanese.vocabulary.deck.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.deck.dto.CreateDeckDto
import com.japanese.vocabulary.deck.dto.DeckDto
import com.japanese.vocabulary.deck.dto.DeckDetailDto
import com.japanese.vocabulary.deck.dto.DeckListDto
import com.japanese.vocabulary.deck.dto.DeckSummaryDto
import com.japanese.vocabulary.deck.dto.toDto
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.deck.repository.DeckWordRepository
import com.japanese.vocabulary.flashcard.dto.DueFlashcardsDto
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.word.dto.WordListDto
import com.japanese.vocabulary.word.dto.WordListItemDto
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.SenseEnricher
import com.japanese.vocabulary.word.service.SenseEnricher.toDtos
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

@Service
class DeckService(
    private val deckRepository: DeckRepository,
    private val deckWordRepository: DeckWordRepository,
    private val songRepository: SongRepository,
    private val wordRepository: WordRepository,
    private val flashcardService: FlashcardService,
    private val clock: Clock,
) {

    /**
     * Due cards scoped to one deck. The deck-membership query lives here (outer layer owns the
     * join); response assembly is delegated to the flashcard module.
     */
    @Transactional
    fun getDueFlashcards(userId: Long, deckId: Long): DueFlashcardsDto {
        val ids = deckRepository.findDueFlashcardIds(userId, deckId, Instant.now(clock))
        return flashcardService.getDueFlashcardsByIds(userId, ids)
    }

    /** 전체 단어장은 `/decks/all` 로 따로 노출되므로 목록에서는 뺀다. */
    @Transactional(readOnly = true)
    fun getDeckList(userId: Long, cursor: Long?, limit: Int = DECK_LIST_PAGE_SIZE): DeckListDto {
        val pageable = PageRequest.of(0, limit)
        val decks = if (cursor != null) {
            deckRepository.findByUserIdAndIsDefaultIsNullAndIdLessThanOrderByCreatedAtDesc(userId, cursor, pageable)
        } else {
            deckRepository.findByUserIdAndIsDefaultIsNullOrderByCreatedAtDesc(userId, pageable)
        }

        if (decks.isEmpty()) {
            return DeckListDto(items = emptyList(), nextCursor = null)
        }

        val deckIds = decks.mapNotNull { it.id }
        val statsMap = deckRepository.findDeckStats(userId, deckIds, Instant.now(clock)).associateBy { it.getDeckId() }

        val songIds = decks.mapNotNull { it.songId }.toSet()
        val artworkMap = if (songIds.isEmpty()) emptyMap() else {
            songRepository.findAllById(songIds).associate { it.id!! to it.artworkUrl }
        }

        val items = decks.map { d ->
            val stats = statsMap[d.id]
            DeckSummaryDto(
                deckId = d.id!!,
                songId = d.songId,
                title = d.title,
                artist = d.description,
                artworkUrl = d.songId?.let { artworkMap[it] },
                wordCount = stats?.getWordCount() ?: 0,
                dueCount = stats?.getDueCount() ?: 0,
                masteredCount = stats?.getMasteredCount() ?: 0,
            )
        }

        val nextCursor = if (decks.size == limit) decks.last().id else null
        return DeckListDto(items = items, nextCursor = nextCursor)
    }

    /** Song ids the user has a deck for (i.e. has saved words from). */
    @Transactional(readOnly = true)
    fun getDeckSongIds(userId: Long): Set<Long> =
        deckRepository.findByUserIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
            .mapNotNull { it.songId }
            .toSet()

    @Transactional
    fun createDeck(userId: Long, request: CreateDeckDto): DeckDto {
        val title = request.title.trim()
        if (title.isEmpty()) throw BusinessException(ErrorCode.DECK_TITLE_REQUIRED)
        return deckRepository.save(
            DeckEntity(
                userId = userId,
                songId = null,
                isDefault = null,
                title = title,
                description = request.description.orEmpty().trim(),
            )
        ).toDto()
    }

    /**
     * 전체 단어장 연결. `deck_word` 는 이제 deck 구성의 유일한 기록이라 (song_words 로 재구성할 수
     * 없다) 이 쓰기가 조용히 실패하면 단어가 어느 단어장에도 안 들어간 채로 남는다. 그래서
     * **곡 단어장 연결과 트랜잭션을 분리한다** — 한쪽이 실패해도 다른 쪽은 살아남아야 한다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun linkWordToDefaultDeck(userId: Long, wordId: Long) {
        linkWord(ensureDefaultDeckId(userId), wordId)
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun linkWordToSongDeck(userId: Long, songId: Long, wordId: Long) {
        linkWord(ensureSongDeckId(userId, songId), wordId)
    }

    /** 전체 단어장은 마이그레이션으로 실체화되지만, 이후 가입한 유저를 위해 없으면 만든다. */
    private fun ensureDefaultDeckId(userId: Long): Long =
        deckRepository.findByUserIdAndIsDefaultTrue(userId)?.id
            ?: deckRepository.saveAndFlush(
                DeckEntity(
                    userId = userId,
                    songId = null,
                    isDefault = true,
                    title = DEFAULT_DECK_TITLE,
                    description = "",
                )
            ).id!!

    private fun ensureSongDeckId(userId: Long, songId: Long): Long =
        deckRepository.findByUserIdAndSongId(userId, songId)?.id
            ?: run {
                val song = songRepository.findById(songId).orElseThrow {
                    IllegalStateException("Song $songId not found while creating deck")
                }
                deckRepository.saveAndFlush(
                    DeckEntity(
                        userId = userId,
                        songId = songId,
                        isDefault = null,
                        title = song.title,
                        description = song.artist,
                    )
                ).id!!
            }

    /**
     * saveAndFlush: 제약 위반을 이 트랜잭션 안에서 즉시 드러내야 호출자가 재시도를 판단할 수 있다.
     * 커밋 시점까지 미루면 재시도 훅이 없다.
     */
    private fun linkWord(deckId: Long, wordId: Long) {
        if (deckWordRepository.existsByDeckIdAndWordId(deckId, wordId)) return
        deckWordRepository.saveAndFlush(DeckWordEntity(deckId = deckId, wordId = wordId))
    }

    @Transactional(readOnly = true)
    fun getDeckDetail(userId: Long, deckId: Long): DeckDetailDto {
        val deck = loadOwnedDeck(userId, deckId)
        val stats = deckRepository.findDeckDetailStats(deckId, userId, Instant.now(clock))
        val artworkUrl = deck.songId?.let { songRepository.findById(it).map { s -> s.artworkUrl }.orElse(null) }

        return DeckDetailDto(
            deckId = deck.id,
            songId = deck.songId,
            title = deck.title,
            artist = deck.description,
            artworkUrl = artworkUrl,
            wordCount = stats.getWordCount(),
            dueCount = stats.getDueCount(),
            masteredCount = stats.getMasteredCount(),
            studyingCount = stats.getStudyingCount(),
            newWordCount = stats.getNewWordCount(),
        )
    }

    @Transactional(readOnly = true)
    fun getAllDeckDetail(userId: Long): DeckDetailDto {
        val stats = deckRepository.findAllDeckDetailStats(userId, Instant.now(clock))
        return DeckDetailDto(
            deckId = deckRepository.findByUserIdAndIsDefaultTrue(userId)?.id,
            songId = null,
            title = null,
            artist = null,
            artworkUrl = null,
            wordCount = stats.getWordCount(),
            dueCount = stats.getDueCount(),
            masteredCount = stats.getMasteredCount(),
            studyingCount = stats.getStudyingCount(),
            newWordCount = stats.getNewWordCount(),
        )
    }

    @Transactional(readOnly = true)
    fun findBySongId(userId: Long, songId: Long): DeckDto? =
        deckRepository.findByUserIdAndSongId(userId, songId)?.toDto()

    @Transactional(readOnly = true)
    fun getDeckWords(userId: Long, deckId: Long, cursor: Long?, limit: Int = 20): WordListDto {
        loadOwnedDeck(userId, deckId)
        val pageable = PageRequest.of(0, limit)
        val wordIds = deckWordRepository.findByDeckId(deckId).map { it.wordId }
        if (wordIds.isEmpty()) {
            return WordListDto(items = emptyList(), nextCursor = null)
        }
        val words = if (cursor != null) {
            wordRepository.findByUserIdAndIdInAndIdLessThanOrderByIdDesc(userId, wordIds, cursor, pageable)
        } else {
            wordRepository.findByUserIdAndIdInOrderByIdDesc(userId, wordIds, pageable)
        }
        return toWordList(words, limit)
    }

    @Transactional(readOnly = true)
    fun getAllDeckWords(userId: Long, cursor: Long?, limit: Int = 20): WordListDto {
        val pageable = PageRequest.of(0, limit)
        val words = if (cursor != null) {
            wordRepository.findByUserIdAndIdLessThanOrderByIdDesc(userId, cursor, pageable)
        } else {
            wordRepository.findByUserIdOrderByIdDesc(userId, pageable)
        }
        return toWordList(words, limit)
    }

    private fun toWordList(words: List<WordEntity>, limit: Int): WordListDto {
        val songMap = SenseEnricher.loadSongs(words.flatMap { it.senses }, songRepository)
        val items = words.map { word ->
            WordListItemDto(
                id = word.id!!,
                japanese = word.japaneseText,
                reading = word.reading ?: "",
                senses = word.senses.toDtos(songMap),
            )
        }
        val nextCursor = if (words.size == limit) words.last().id else null
        return WordListDto(items = items, nextCursor = nextCursor)
    }

    private fun loadOwnedDeck(userId: Long, deckId: Long): DeckEntity {
        val deck = deckRepository.findById(deckId)
            .orElseThrow { BusinessException(ErrorCode.DECK_NOT_FOUND) }
        if (deck.userId != userId) throw BusinessException(ErrorCode.FORBIDDEN)
        return deck
    }

    companion object {
        const val DECK_LIST_PAGE_SIZE: Int = 50
        const val DEFAULT_DECK_TITLE: String = "전체 단어장"
    }
}
