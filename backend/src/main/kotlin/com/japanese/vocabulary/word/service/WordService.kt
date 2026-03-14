package com.japanese.vocabulary.word.service

import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.client.jisho.JishoClient
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.WordDefinitionDTO
import com.japanese.vocabulary.word.dto.WordListItem
import com.japanese.vocabulary.word.dto.WordListResponse
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
class WordService(
    private val jishoClient: JishoClient,
    private val wordRepository: WordRepository,
    private val songWordRepository: SongWordRepository,
    private val songRepository: SongRepository,
    private val flashcardService: FlashcardService
) {
    fun lookupWord(word: String): WordDefinitionDTO {
        return jishoClient.lookup(word)
    }

    @Transactional
    fun addWord(userId: Long, request: AddWordRequest): Long {
        if (!songRepository.existsById(request.songId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found: ${request.songId}")
        }

        val word = wordRepository.save(
            WordEntity(
                userId = userId,
                japaneseText = request.japanese,
                reading = request.reading,
                koreanText = request.koreanText
            )
        )

        songWordRepository.save(
            SongWordEntity(
                wordId = word.id!!,
                songId = request.songId,
                lyricLine = request.lyricLine
            )
        )

        flashcardService.createFlashcard(userId, word.id)

        return word.id
    }

    @Transactional(readOnly = true)
    fun getUserWords(userId: Long, cursor: Long?, limit: Int = 20): WordListResponse {
        val pageable = PageRequest.of(0, limit)
        val words = if (cursor != null) {
            wordRepository.findByUserIdAndIdLessThanOrderByIdDesc(userId, cursor, pageable)
        } else {
            wordRepository.findByUserIdOrderByIdDesc(userId, pageable)
        }

        val songWordMap = words.mapNotNull { it.id }
            .flatMap { wordId -> songWordRepository.findByWordId(wordId) }
            .associateBy { it.wordId }

        val songIds = songWordMap.values.map { it.songId }.toSet()
        val songMap = songRepository.findAllById(songIds).associateBy { it.id }

        val items = words.map { word ->
            val songWord = songWordMap[word.id]
            val song = songWord?.let { songMap[it.songId] }
            WordListItem(
                id = word.id!!,
                japanese = word.japaneseText,
                reading = word.reading ?: "",
                koreanText = word.koreanText ?: "",
                songTitle = song?.title,
                lyricLine = songWord?.lyricLine
            )
        }

        val nextCursor = if (words.size == limit) words.last().id else null

        return WordListResponse(words = items, nextCursor = nextCursor)
    }
}
