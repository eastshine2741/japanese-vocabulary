package com.japanese.vocabulary.word.service

import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.client.jisho.JishoClient
import com.japanese.vocabulary.word.dto.*
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.event.WordAddedEvent
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.context.ApplicationEventPublisher
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
    private val eventPublisher: ApplicationEventPublisher
) {
    @Transactional
    fun addWord(userId: Long, request: AddWordRequest): Long {
        if (!songRepository.existsById(request.songId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Song not found: ${request.songId}")
        }

        val word = wordRepository.findByUserIdAndJapaneseText(userId, request.japanese)

        val savedWord = if (word != null) {
            // Append meaning if not duplicate
            val newMeaning = WordMeaning(text = request.koreanText, partOfSpeech = request.partOfSpeech)
            if (word.meanings.none { it.text == newMeaning.text }) {
                word.meanings = word.meanings + newMeaning
                wordRepository.save(word)
            }
            word
        } else {
            wordRepository.save(
                WordEntity(
                    userId = userId,
                    japaneseText = request.japanese,
                    reading = request.reading,
                    meanings = listOf(WordMeaning(text = request.koreanText, partOfSpeech = request.partOfSpeech))
                )
            )
        }

        if (!songWordRepository.existsByWordIdAndSongIdAndLyricLine(savedWord.id!!, request.songId, request.lyricLine)) {
            songWordRepository.save(
                SongWordEntity(
                    wordId = savedWord.id,
                    songId = request.songId,
                    lyricLine = request.lyricLine,
                    koreanLyricLine = request.koreanLyricLine
                )
            )
        }

        eventPublisher.publishEvent(WordAddedEvent(userId, savedWord.id!!, request.songId))

        return savedWord.id
    }

    @Transactional(readOnly = true)
    fun getWord(userId: Long, japaneseText: String): WordDetailResponse? {
        val word = wordRepository.findByUserIdAndJapaneseText(userId, japaneseText) ?: return null
        val songWords = songWordRepository.findByWordId(word.id!!)
        val songIds = songWords.map { it.songId }.toSet()
        val songMap = songRepository.findAllById(songIds).associateBy { it.id }

        val examples = songWords.map { sw ->
            ExampleSentence(
                songId = sw.songId,
                songTitle = songMap[sw.songId]?.title,
                lyricLine = sw.lyricLine,
                koreanLyricLine = sw.koreanLyricLine,
                artworkUrl = songMap[sw.songId]?.artworkUrl
            )
        }

        return WordDetailResponse(
            id = word.id,
            japanese = word.japaneseText,
            reading = word.reading,
            meanings = word.meanings,
            examples = examples
        )
    }

    @Transactional(readOnly = true)
    fun getUserWords(userId: Long, cursor: Long?, limit: Int = 20): WordListResponse {
        val pageable = PageRequest.of(0, limit)
        val words = if (cursor != null) {
            wordRepository.findByUserIdAndIdLessThanOrderByIdDesc(userId, cursor, pageable)
        } else {
            wordRepository.findByUserIdOrderByIdDesc(userId, pageable)
        }

        val wordIds = words.mapNotNull { it.id }
        val songWordMap = songWordRepository.findByWordIdIn(wordIds).groupBy { it.wordId }

        val songIds = songWordMap.values.flatten().map { it.songId }.toSet()
        val songMap = songRepository.findAllById(songIds).associateBy { it.id }

        val items = words.map { word ->
            val songWords = songWordMap[word.id] ?: emptyList()
            val examples = songWords.map { sw ->
                ExampleSentence(
                    songId = sw.songId,
                    songTitle = songMap[sw.songId]?.title,
                    lyricLine = sw.lyricLine,
                    koreanLyricLine = sw.koreanLyricLine
                )
            }
            WordListItem(
                id = word.id!!,
                japanese = word.japaneseText,
                reading = word.reading ?: "",
                meanings = word.meanings,
                examples = examples
            )
        }

        val nextCursor = if (words.size == limit) words.last().id else null

        return WordListResponse(words = items, nextCursor = nextCursor)
    }
}
