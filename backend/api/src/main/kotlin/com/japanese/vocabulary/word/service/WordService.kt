package com.japanese.vocabulary.word.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.client.jisho.JishoClient
import com.japanese.vocabulary.word.dto.*
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WordService(
    private val jishoClient: JishoClient,
    private val wordRepository: WordRepository,
    private val songWordRepository: SongWordRepository,
    private val songRepository: SongRepository,
    private val flashcardService: FlashcardService
) {
    @Transactional
    fun batchAddWords(userId: Long, request: BatchAddWordRequest): BatchAddWordResponse {
        var savedCount = 0
        var skippedCount = 0
        for (wordRequest in request.words) {
            val existing = wordRepository.findByUserIdAndJapaneseText(userId, wordRequest.japanese)
            val newMeaning = WordMeaning(text = wordRequest.koreanText, partOfSpeech = wordRequest.partOfSpeech)
            val meaningAlreadyExists = existing != null && existing.meanings.any { it.text == newMeaning.text }
            val songWordExists = existing != null && songWordRepository.existsByWordIdAndSongIdAndLyricLine(
                existing.id!!, wordRequest.songId, wordRequest.lyricLine
            )
            if (meaningAlreadyExists && songWordExists) {
                skippedCount++
            } else {
                addWord(userId, wordRequest)
                savedCount++
            }
        }
        return BatchAddWordResponse(savedCount = savedCount, skippedCount = skippedCount)
    }

    @Transactional
    fun addWord(userId: Long, request: AddWordRequest): Long {
        if (!songRepository.existsById(request.songId)) {
            throw BusinessException(ErrorCode.SONG_NOT_FOUND)
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

        flashcardService.createFlashcard(userId, savedWord.id, request.songId)

        return savedWord.id
    }

    @Transactional
    fun updateWord(userId: Long, wordId: Long, request: UpdateWordRequest): WordDetailResponse {
        val word = wordRepository.findById(wordId)
            .orElseThrow { BusinessException(ErrorCode.WORD_NOT_FOUND) }
        if (word.userId != userId) throw BusinessException(ErrorCode.FORBIDDEN)
        if (request.meanings.isEmpty()) throw BusinessException(ErrorCode.MEANING_REQUIRED)

        word.reading = request.reading
        word.meanings = request.meanings
        wordRepository.save(word)

        if (request.deleteExampleIds.isNotEmpty()) {
            val songWords = songWordRepository.findAllById(request.deleteExampleIds)
            val invalid = songWords.filter { it.wordId != wordId }
            if (invalid.isNotEmpty()) {
                throw BusinessException(ErrorCode.INVALID_EXAMPLES)
            }
            songWordRepository.deleteAll(songWords)
        }

        if (request.resetFlashcard) {
            flashcardService.resetByWordId(wordId)
        }

        return getWord(userId, word.japaneseText)!!
    }

    @Transactional
    fun deleteWord(userId: Long, wordId: Long) {
        val word = wordRepository.findById(wordId)
            .orElseThrow { BusinessException(ErrorCode.WORD_NOT_FOUND) }
        if (word.userId != userId) throw BusinessException(ErrorCode.FORBIDDEN)

        flashcardService.deleteByWordId(wordId)

        songWordRepository.deleteByWordId(wordId)
        wordRepository.delete(word)
    }

    @Transactional(readOnly = true)
    fun getWord(userId: Long, japaneseText: String): WordDetailResponse? {
        val word = wordRepository.findByUserIdAndJapaneseText(userId, japaneseText) ?: return null
        val songWords = songWordRepository.findByWordId(word.id!!)
        val songIds = songWords.map { it.songId }.toSet()
        val songMap = songRepository.findAllById(songIds).associateBy { it.id }

        val examples = songWords.map { sw ->
            ExampleSentence(
                id = sw.id!!,
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
                    id = sw.id!!,
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
