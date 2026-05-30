package com.japanese.vocabulary.deck.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.dto.*
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

@Service
class DeckService(
    private val deckRepository: DeckRepository,
    private val songRepository: SongRepository,
    private val songWordRepository: SongWordRepository,
    private val wordRepository: WordRepository,
    private val clock: Clock,
) {

    @Transactional(readOnly = true)
    fun getDeckList(userId: Long, cursor: Long?, limit: Int = DECK_LIST_PAGE_SIZE): DeckListResponse {
        val pageable = PageRequest.of(0, limit)
        val decks = if (cursor != null) {
            deckRepository.findByUserIdAndIdLessThanOrderByCreatedAtDesc(userId, cursor, pageable)
        } else {
            deckRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
        }

        if (decks.isEmpty()) {
            return DeckListResponse(songDecks = emptyList(), nextCursor = null)
        }

        val deckIds = decks.mapNotNull { it.id }
        val statsMap = deckRepository.findDeckStats(deckIds, Instant.now(clock)).associateBy { it.getDeckId() }

        val songIds = decks.map { it.songId }.toSet()
        val artworkMap = songRepository.findAllById(songIds).associate { it.id!! to it.artworkUrl }

        val items = decks.map { d ->
            val stats = statsMap[d.id]
            SongDeckSummary(
                deckId = d.id!!,
                songId = d.songId,
                title = d.title,
                artist = d.description,
                artworkUrl = artworkMap[d.songId],
                wordCount = stats?.getWordCount() ?: 0,
                dueCount = stats?.getDueCount() ?: 0,
                masteredCount = stats?.getMasteredCount() ?: 0,
            )
        }

        val nextCursor = if (decks.size == limit) decks.last().id else null
        return DeckListResponse(songDecks = items, nextCursor = nextCursor)
    }

    @Transactional(readOnly = true)
    fun getDeckDetail(userId: Long, deckId: Long): DeckDetailResponse {
        val deck = loadOwnedDeck(userId, deckId)
        val stats = deckRepository.findDeckDetailStats(deckId, userId, Instant.now(clock))
        val artworkUrl = songRepository.findById(deck.songId).map { it.artworkUrl }.orElse(null)

        return DeckDetailResponse(
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
    fun getAllDeckDetail(userId: Long): DeckDetailResponse {
        val stats = deckRepository.findAllDeckDetailStats(userId, Instant.now(clock))
        return DeckDetailResponse(
            deckId = null,
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
    fun findBySongId(userId: Long, songId: Long): DeckEntity? =
        deckRepository.findByUserIdAndSongId(userId, songId)

    @Transactional(readOnly = true)
    fun getDeckWords(userId: Long, deckId: Long, cursor: Long?, limit: Int = 20): DeckWordListResponse {
        val deck = loadOwnedDeck(userId, deckId)
        return loadWordsForSong(userId, deck.songId, cursor, limit)
    }

    @Transactional(readOnly = true)
    fun getAllDeckWords(userId: Long, cursor: Long?, limit: Int = 20): DeckWordListResponse {
        val pageable = PageRequest.of(0, limit)
        val words = if (cursor != null) {
            wordRepository.findByUserIdAndIdLessThanOrderByIdDesc(userId, cursor, pageable)
        } else {
            wordRepository.findByUserIdOrderByIdDesc(userId, pageable)
        }
        return toWordListResponse(words, limit)
    }

    private fun loadWordsForSong(userId: Long, songId: Long, cursor: Long?, limit: Int): DeckWordListResponse {
        val pageable = PageRequest.of(0, limit)
        val songWordIds = songWordRepository.findBySongId(songId).map { it.wordId }.distinct()
        if (songWordIds.isEmpty()) {
            return DeckWordListResponse(words = emptyList(), nextCursor = null)
        }
        val words = if (cursor != null) {
            wordRepository.findByUserIdAndIdInAndIdLessThanOrderByIdDesc(userId, songWordIds, cursor, pageable)
        } else {
            wordRepository.findByUserIdAndIdInOrderByIdDesc(userId, songWordIds, pageable)
        }
        return toWordListResponse(words, limit)
    }

    private fun toWordListResponse(
        words: List<com.japanese.vocabulary.word.entity.WordEntity>,
        limit: Int,
    ): DeckWordListResponse {
        val items = words.map { word ->
            DeckWordItem(
                id = word.id!!,
                japanese = word.japaneseText,
                reading = word.reading ?: "",
                meanings = word.meanings,
            )
        }
        val nextCursor = if (words.size == limit) words.last().id else null
        return DeckWordListResponse(words = items, nextCursor = nextCursor)
    }

    private fun loadOwnedDeck(userId: Long, deckId: Long): DeckEntity {
        val deck = deckRepository.findById(deckId)
            .orElseThrow { BusinessException(ErrorCode.DECK_NOT_FOUND) }
        if (deck.userId != userId) throw BusinessException(ErrorCode.FORBIDDEN)
        return deck
    }

    companion object {
        const val DECK_LIST_PAGE_SIZE: Int = 50
    }
}
