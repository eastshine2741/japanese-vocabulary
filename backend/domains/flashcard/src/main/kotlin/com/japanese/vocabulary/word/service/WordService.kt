package com.japanese.vocabulary.word.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.event.SongWordCreatedEvent
import com.japanese.vocabulary.word.dto.AddWordExampleDto
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordResultDto
import com.japanese.vocabulary.word.model.ExampleSentence
import com.japanese.vocabulary.word.dto.UpdateWordDto
import com.japanese.vocabulary.word.dto.WordDetailDto
import com.japanese.vocabulary.word.dto.WordListDto
import com.japanese.vocabulary.word.dto.WordListItemDto
import com.japanese.vocabulary.word.model.WordMeaning
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional

@Service
class WordService(
    private val wordRepository: WordRepository,
    private val songWordRepository: SongWordRepository,
    private val songRepository: SongRepository,
    private val flashcardService: FlashcardService,
    private val eventPublisher: ApplicationEventPublisher,
) {
    @Transactional
    fun batchAddWords(userId: Long, request: BatchAddWordDto): BatchAddWordResultDto {
        var savedCount = 0
        var skippedCount = 0
        for (wordRequest in request.words) {
            val outcome = addWordInternal(userId, wordRequest)
            if (outcome.changed) {
                savedCount++
            } else {
                skippedCount++
            }
        }
        return BatchAddWordResultDto(savedCount = savedCount, skippedCount = skippedCount)
    }

    @Transactional
    fun addWord(userId: Long, request: AddWordDto): Long {
        return addWordInternal(userId, request).wordId
    }

    private fun addWordInternal(userId: Long, request: AddWordDto): AddWordOutcome {
        val requestedMeanings = request.normalizedMeanings()
        if (requestedMeanings.isEmpty()) throw BusinessException(ErrorCode.MEANING_REQUIRED)

        val requestedExamples = request.normalizedExamples()
        val missingSong = requestedExamples.map { it.songId }.distinct().firstOrNull { !songRepository.existsById(it) }
        if (missingSong != null) throw BusinessException(ErrorCode.SONG_NOT_FOUND)

        val word = wordRepository.findByUserIdAndJapaneseText(userId, request.japanese)

        var wordChanged = false
        val savedWord = if (word != null) {
            val newMeanings = requestedMeanings.filter { newMeaning ->
                word.meanings.none { it.text == newMeaning.text }
            }
            if (newMeanings.isNotEmpty()) {
                word.meanings = word.meanings + newMeanings
                wordRepository.save(word)
                wordChanged = true
            }
            word
        } else {
            wordChanged = true
            wordRepository.save(
                WordEntity(
                    userId = userId,
                    japaneseText = request.japanese,
                    reading = request.reading,
                    meanings = requestedMeanings,
                )
            )
        }

        val savedWordId = savedWord.id!!
        val flashcardId = flashcardService.createFlashcard(userId, savedWordId)
        val createdExampleSongIds = addExamplesWithCap(savedWord, requestedExamples)

        createdExampleSongIds.distinct().forEach { songId ->
            eventPublisher.publishEvent(
                SongWordCreatedEvent(
                    userId = userId,
                    songId = songId,
                    wordId = savedWordId,
                    flashcardId = flashcardId,
                )
            )
        }

        return AddWordOutcome(
            wordId = savedWordId,
            changed = wordChanged || createdExampleSongIds.isNotEmpty(),
        )
    }

    @Transactional
    fun updateWord(userId: Long, wordId: Long, request: UpdateWordDto): WordDetailDto {
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
    fun getWord(userId: Long, japaneseText: String): WordDetailDto? {
        val word = wordRepository.findByUserIdAndJapaneseText(userId, japaneseText) ?: return null
        return buildDetail(word)
    }

    @Transactional(readOnly = true)
    fun getWordById(userId: Long, wordId: Long): WordDetailDto? {
        val word = wordRepository.findById(wordId).orElse(null) ?: return null
        if (word.userId != userId) return null
        return buildDetail(word)
    }

    private fun buildDetail(word: WordEntity): WordDetailDto {
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

        return WordDetailDto(
            id = word.id,
            japanese = word.japaneseText,
            reading = word.reading,
            meanings = word.meanings,
            examples = examples,
        )
    }

    @Transactional(readOnly = true)
    fun getUserWords(userId: Long, cursor: Long?, limit: Int = 20): WordListDto {
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
            WordListItemDto(
                id = word.id!!,
                japanese = word.japaneseText,
                reading = word.reading ?: "",
                meanings = word.meanings,
                examples = examples,
            )
        }

        val nextCursor = if (words.size == limit) words.last().id else null

        return WordListDto(items = items, nextCursor = nextCursor)
    }

    private fun AddWordDto.normalizedMeanings(): List<WordMeaning> {
        val source = meanings.ifEmpty {
            listOf(WordMeaning(text = koreanText, partOfSpeech = partOfSpeech))
        }
        return source
            .filter { it.text.isNotBlank() }
            .distinctBy { it.text }
    }

    private fun AddWordDto.normalizedExamples(): List<AddWordExampleDto> =
        examples.ifEmpty {
            listOf(AddWordExampleDto(songId = songId, lyricLine = lyricLine, koreanLyricLine = koreanLyricLine))
        }

    private fun addExamplesWithCap(word: WordEntity, examples: List<AddWordExampleDto>): List<Long> {
        val wordId = word.id!!
        val existing = songWordRepository.findByWordId(wordId)
        val seenKeys = existing.map { ExampleKey(it.songId, it.lyricLine) }.toMutableSet()
        val createdSongIds = mutableListOf<Long>()
        var exampleCount = existing.size

        for (example in examples) {
            if (exampleCount >= MAX_EXAMPLES_PER_WORD) break

            val key = ExampleKey(example.songId, example.lyricLine)
            if (!seenKeys.add(key)) continue

            songWordRepository.save(
                SongWordEntity(
                    wordId = wordId,
                    songId = example.songId,
                    lyricLine = example.lyricLine,
                    koreanLyricLine = example.koreanLyricLine,
                )
            )
            exampleCount++
            createdSongIds += example.songId
        }

        return createdSongIds
    }

    private data class AddWordOutcome(
        val wordId: Long,
        val changed: Boolean,
    )

    private data class ExampleKey(
        val songId: Long,
        val lyricLine: String?,
    )

    companion object {
        private const val MAX_EXAMPLES_PER_WORD = 10
    }
}
