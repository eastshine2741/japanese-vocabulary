package com.japanese.vocabulary.deck.service

import com.japanese.vocabulary.deck.dto.*
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DeckService(
    private val deckRepository: DeckRepository,
    private val songRepository: SongRepository,
    private val songWordRepository: SongWordRepository,
    private val wordRepository: WordRepository
) {

    @Transactional(readOnly = true)
    fun getDeckList(userId: Long): DeckListResponse {
        val songDecks = deckRepository.findSongDeckSummaries(userId).map {
            SongDeckSummary(
                songId = it.getSongId(),
                title = it.getTitle(),
                artist = it.getArtist(),
                artworkUrl = it.getArtworkUrl(),
                wordCount = it.getWordCount(),
                avgRetrievability = it.getAvgRetrievability()
            )
        }

        val allStats = deckRepository.findAllDeckStats(userId)
        val allDeck = AllDeckSummary(
            wordCount = allStats.getWordCount(),
            avgRetrievability = allStats.getAvgRetrievability()
        )

        return DeckListResponse(allDeck = allDeck, songDecks = songDecks)
    }

    @Transactional(readOnly = true)
    fun getDeckDetail(userId: Long, songId: Long?): DeckDetailResponse {
        val stats = if (songId != null) {
            deckRepository.findSongDeckDetailStats(userId, songId)
        } else {
            deckRepository.findAllDeckDetailStats(userId)
        }

        var title: String? = null
        var artist: String? = null
        var artworkUrl: String? = null
        if (songId != null) {
            songRepository.findById(songId).orElse(null)?.let { song ->
                title = song.title
                artist = song.artist
                artworkUrl = song.artworkUrl
            }
        }

        return DeckDetailResponse(
            songId = songId,
            title = title,
            artist = artist,
            artworkUrl = artworkUrl,
            wordCount = stats.getWordCount(),
            dueCount = stats.getDueCount(),
            stateCounts = StateCounts(
                new = stats.getNewCount(),
                learning = stats.getLearningCount(),
                review = stats.getReviewCount(),
                relearning = stats.getRelearningCount()
            ),
            avgRetrievability = stats.getAvgRetrievability()
        )
    }

    @Transactional(readOnly = true)
    fun getDeckWords(userId: Long, songId: Long?, cursor: Long?, limit: Int = 20): DeckWordListResponse {
        val pageable = PageRequest.of(0, limit)

        val words = if (songId != null) {
            val songWordIds = songWordRepository.findBySongId(songId).map { it.wordId }.distinct()
            if (songWordIds.isEmpty()) {
                emptyList()
            } else if (cursor != null) {
                wordRepository.findByUserIdAndIdInAndIdLessThanOrderByIdDesc(userId, songWordIds, cursor, pageable)
            } else {
                wordRepository.findByUserIdAndIdInOrderByIdDesc(userId, songWordIds, pageable)
            }
        } else {
            if (cursor != null) {
                wordRepository.findByUserIdAndIdLessThanOrderByIdDesc(userId, cursor, pageable)
            } else {
                wordRepository.findByUserIdOrderByIdDesc(userId, pageable)
            }
        }

        val items = words.map { word ->
            DeckWordItem(
                id = word.id!!,
                japanese = word.japaneseText,
                reading = word.reading ?: "",
                meanings = word.meanings
            )
        }

        val nextCursor = if (words.size == limit) words.last().id else null
        return DeckWordListResponse(words = items, nextCursor = nextCursor)
    }
}
