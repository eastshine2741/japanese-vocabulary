package com.japanese.vocabulary.word.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.event.WordDeletedEvent
import com.japanese.vocabulary.word.event.WordSavedEvent
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordResultDto
import com.japanese.vocabulary.word.dto.UpdateWordDto
import com.japanese.vocabulary.word.dto.WordDetailDto
import com.japanese.vocabulary.word.dto.WordListDto
import com.japanese.vocabulary.word.dto.WordListItemDto
import com.japanese.vocabulary.word.model.SenseExample
import com.japanese.vocabulary.word.model.WordSense
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.SenseEnricher.toDtos
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional

@Service
class WordService(
    private val wordRepository: WordRepository,
    private val songRepository: SongRepository,
    private val flashcardService: FlashcardService,
    private val eventPublisher: ApplicationEventPublisher,
) {
    @Transactional
    fun batchAddWords(userId: Long, request: BatchAddWordDto): BatchAddWordResultDto {
        var savedCount = 0
        var skippedCount = 0
        for (wordRequest in request.words) {
            if (addWordInternal(userId, wordRequest).changed) savedCount++ else skippedCount++
        }
        return BatchAddWordResultDto(savedCount = savedCount, skippedCount = skippedCount)
    }

    @Transactional
    fun addWord(userId: Long, request: AddWordDto): Long = addWordInternal(userId, request).wordId

    private fun addWordInternal(userId: Long, request: AddWordDto): AddWordOutcome {
        val requestedSenses = request.senses.normalized()
        if (requestedSenses.isEmpty()) throw BusinessException(ErrorCode.MEANING_REQUIRED)

        requireExistingSongs(requestedSenses, request.songId)

        val existing = wordRepository.findByUserIdAndJapaneseText(userId, request.japanese)
        val word = existing ?: WordEntity(
            userId = userId,
            japaneseText = request.japanese,
            reading = request.reading,
        )

        val mergedSenses = merge(word.senses, requestedSenses)
        val changed = existing == null || mergedSenses != word.senses
        if (changed) {
            word.senses = mergedSenses
            wordRepository.save(word)
        }

        val wordId = word.id!!
        flashcardService.createFlashcard(userId, wordId)
        // 담을 때마다 발행한다 — sense 가 이미 다 있어도 deck 연결은 보장되어야 한다.
        eventPublisher.publishEvent(WordSavedEvent(userId = userId, wordId = wordId, songId = request.songId))

        return AddWordOutcome(wordId = wordId, changed = changed)
    }

    @Transactional
    fun updateWord(userId: Long, wordId: Long, request: UpdateWordDto): WordDetailDto {
        val word = wordRepository.findById(wordId)
            .orElseThrow { BusinessException(ErrorCode.WORD_NOT_FOUND) }
        if (word.userId != userId) throw BusinessException(ErrorCode.FORBIDDEN)

        val senses = request.senses.normalized()
        if (senses.isEmpty()) throw BusinessException(ErrorCode.MEANING_REQUIRED)
        // 저장 경로와 같은 검증 — 없는 곡을 가리키는 예문이 들어오면 곡 제목이 빈 채로 렌더된다.
        requireExistingSongs(senses, songId = null)

        word.reading = request.reading
        word.senses = senses
        wordRepository.save(word)

        if (request.resetFlashcard) {
            flashcardService.resetByWordId(wordId)
        }

        return buildDetail(word)
    }

    @Transactional
    fun deleteWord(userId: Long, wordId: Long) {
        val word = wordRepository.findById(wordId)
            .orElseThrow { BusinessException(ErrorCode.WORD_NOT_FOUND) }
        if (word.userId != userId) throw BusinessException(ErrorCode.FORBIDDEN)

        flashcardService.deleteByWordId(wordId)
        // deck_word 는 words 에 FK 를 가지므로 같은 트랜잭션에서 먼저 정리되어야 한다.
        eventPublisher.publishEvent(WordDeletedEvent(wordId))
        wordRepository.delete(word)
    }

    @Transactional(readOnly = true)
    fun getWord(userId: Long, japaneseText: String): WordDetailDto? =
        wordRepository.findByUserIdAndJapaneseText(userId, japaneseText)?.let { buildDetail(it) }

    @Transactional(readOnly = true)
    fun getWordById(userId: Long, wordId: Long): WordDetailDto? {
        val word = wordRepository.findById(wordId).orElse(null) ?: return null
        if (word.userId != userId) return null
        return buildDetail(word)
    }

    private fun buildDetail(word: WordEntity): WordDetailDto = WordDetailDto(
        id = word.id!!,
        japanese = word.japaneseText,
        reading = word.reading,
        senses = word.senses.toDtos(songRepository),
    )

    @Transactional(readOnly = true)
    fun getUserWords(userId: Long, cursor: Long?, limit: Int = 20): WordListDto {
        val pageable = PageRequest.of(0, limit)
        val words = if (cursor != null) {
            wordRepository.findByUserIdAndIdLessThanOrderByIdDesc(userId, cursor, pageable)
        } else {
            wordRepository.findByUserIdOrderByIdDesc(userId, pageable)
        }
        return words.toListDto(limit)
    }

    /** 여러 word 의 sense 를 곡 메타데이터와 함께 조립한다 — 곡 조회는 페이지당 1회로 묶인다. */
    private fun List<WordEntity>.toListDto(limit: Int): WordListDto {
        val songMap = SenseEnricher.loadSongs(flatMap { it.senses }, songRepository)
        val items = map { word ->
            WordListItemDto(
                id = word.id!!,
                japanese = word.japaneseText,
                reading = word.reading ?: "",
                senses = word.senses.toDtos(songMap),
            )
        }
        return WordListDto(items = items, nextCursor = if (size == limit) last().id else null)
    }

    private fun requireExistingSongs(senses: List<WordSense>, songId: Long?) {
        val referenced = (senses.flatMap { it.examples }.mapNotNull { it.songId } + listOfNotNull(songId)).distinct()
        if (referenced.any { !songRepository.existsById(it) }) {
            throw BusinessException(ErrorCode.SONG_NOT_FOUND)
        }
    }

    /** 빈 뜻 제거, 뜻 텍스트 기준 중복 제거, sense 별 예문 상한 적용. */
    private fun List<WordSense>.normalized(): List<WordSense> =
        filter { it.meaning.isNotBlank() }
            .distinctBy { it.meaning }
            .map { it.copy(examples = it.examples.distinctBy(::exampleKey).take(MAX_EXAMPLES_PER_SENSE)) }

    /** 기존 sense 는 보존하고 누락된 sense 만 추가한다. 같은 뜻이면 예문만 상한까지 덧붙인다. */
    private fun merge(current: List<WordSense>, incoming: List<WordSense>): List<WordSense> {
        val result = current.toMutableList()
        for (sense in incoming) {
            val index = result.indexOfFirst { it.meaning == sense.meaning }
            if (index < 0) {
                result += sense
                continue
            }
            val existing = result[index]
            result[index] = existing.copy(
                jlpt = existing.jlpt ?: sense.jlpt,
                examples = appendExamples(existing.examples, sense.examples),
            )
        }
        return result
    }

    private fun appendExamples(current: List<SenseExample>, incoming: List<SenseExample>): List<SenseExample> {
        if (current.size >= MAX_EXAMPLES_PER_SENSE) return current
        val seen = current.map(::exampleKey).toMutableSet()
        val result = current.toMutableList()
        for (example in incoming) {
            if (result.size >= MAX_EXAMPLES_PER_SENSE) break
            if (seen.add(exampleKey(example))) result += example
        }
        return result
    }

    private data class AddWordOutcome(val wordId: Long, val changed: Boolean)

    companion object {
        const val MAX_EXAMPLES_PER_SENSE = 5

        private fun exampleKey(example: SenseExample) =
            Triple(example.songId, example.lineIndex, example.text)
    }
}
