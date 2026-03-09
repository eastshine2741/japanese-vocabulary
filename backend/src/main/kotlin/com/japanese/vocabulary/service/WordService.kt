package com.japanese.vocabulary.service

import com.japanese.vocabulary.client.JishoClient
import com.japanese.vocabulary.entity.SongWordEntity
import com.japanese.vocabulary.entity.WordEntity
import com.japanese.vocabulary.model.AddWordRequest
import com.japanese.vocabulary.model.WordDefinitionDTO
import com.japanese.vocabulary.model.WordListItem
import com.japanese.vocabulary.model.WordListResponse
import com.japanese.vocabulary.repository.SongRepository
import com.japanese.vocabulary.repository.SongWordRepository
import com.japanese.vocabulary.repository.WordRepository
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
    private val songRepository: SongRepository
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
