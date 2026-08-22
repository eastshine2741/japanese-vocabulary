package com.japanese.vocabulary.word.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.model.DeckTargets
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordResultDto
import com.japanese.vocabulary.word.dto.UpdateWordDto
import com.japanese.vocabulary.word.dto.WordDetailDto
import com.japanese.vocabulary.word.dto.WordListDto
import com.japanese.vocabulary.word.dto.WordListItemDto
import com.japanese.vocabulary.word.model.SenseExample
import com.japanese.vocabulary.word.model.WordSense
import com.japanese.vocabulary.word.model.splitMeanings
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.SenseEnricher.toDtos
import org.slf4j.LoggerFactory
import org.springframework.dao.ConcurrencyFailureException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate

/**
 * 이 모듈의 주인. flashcard 와 deck 은 단어에 딸린 개념이라 수명주기를 여기서 통째로 잡는다.
 *
 * - flashcard 는 word 와 수명주기가 같다: 저장할 때 만들고 삭제할 때 지운다. flashcard 없는
 *   word 는 존재할 수 없다.
 * - deck 은 word 보다 오래 산다: 담을 때 만들어지고 연결되지만, 단어가 지워져도 남는다.
 * - 모든 word 는 전체 단어장에 연결된다.
 *
 * 셋 다 **한 트랜잭션 안에서** 처리한다. 커밋 뒤에 도는 이벤트로 미루면 단어만 저장되고 단어장
 * 연결이 유실된 상태가 남을 수 있는데, `deck_word` 는 단어장 구성의 유일한 기록이라 그 상태는
 * 복구할 방법이 없다.
 */
@Service
class WordService(
    private val wordRepository: WordRepository,
    private val songRepository: SongRepository,
    private val flashcardService: FlashcardService,
    private val deckService: DeckService,
    transactionManager: PlatformTransactionManager,
) {
    /**
     * 저장 경로만 `@Transactional` 대신 템플릿으로 트랜잭션을 직접 연다 — [retryingSave] 가
     * 트랜잭션 **밖**에서 감싸야 하기 때문이다. 나머지 메서드는 그대로 `@Transactional` 이다.
     */
    private val saveTx = TransactionTemplate(transactionManager)

    fun batchAddWords(userId: Long, request: BatchAddWordDto): BatchAddWordResultDto = retryingSave {
        val targets = validateAndResolveDecks(userId, request.words)
        saveTx.execute {
            var savedCount = 0
            var skippedCount = 0
            for (wordRequest in request.words) {
                if (addWordInternal(userId, wordRequest, targets).changed) savedCount++ else skippedCount++
            }
            BatchAddWordResultDto(savedCount = savedCount, skippedCount = skippedCount)
        }!!
    }

    fun addWord(userId: Long, request: AddWordDto): Long = retryingSave {
        val targets = validateAndResolveDecks(userId, listOf(request))
        saveTx.execute { addWordInternal(userId, request, targets).wordId }!!
    }

    /**
     * 검증과 단어장 확보를 저장 트랜잭션 **앞에서, 요청당 한 번** 끝낸다. 단어마다 반복하면
     * 배치 저장이 단어 수에 비례해 `decks` 를 잠그게 되고, 그게 바로 재시도가 흡수해야 하는
     * 경합을 키운다.
     */
    private fun validateAndResolveDecks(userId: Long, words: List<AddWordDto>): DeckTargets {
        val senses = words.map { it.senses.forSave() }
        if (senses.any { it.isEmpty() }) throw BusinessException(ErrorCode.MEANING_REQUIRED)
        requireExistingSongs(senses.flatten().flatMap { it.examples }.mapNotNull { it.songId })
        return deckService.resolveDeckTargets(userId, words.mapNotNull { it.songId })
    }

    /**
     * 단어장 생성이 저장 트랜잭션에 맞물려 있어서, 같은 유저가 동시에 담으면 `decks` 나 `words`
     * 의 UNIQUE 에 걸리거나 데드락이 난다. 롤백된 뒤 통째로 다시 돌리면 이긴 쪽이 만든 단어장을
     * 찾아 쓴다. 저장 경로가 전부 upsert 라 재실행이 안전하다.
     *
     * 재시도는 트랜잭션 **밖**이어야 한다 — 안에서는 이미 rollback-only 이고, REPEATABLE READ
     * 스냅샷도 그대로라 방금 커밋된 단어장이 보이지 않는다.
     */
    private fun <T> retryingSave(block: () -> T): T {
        repeat(MAX_SAVE_ATTEMPTS - 1) { attempt ->
            try {
                return block()
            } catch (e: DataIntegrityViolationException) {
                logRetry(attempt, e)
            } catch (e: ConcurrencyFailureException) {
                logRetry(attempt, e)
            }
        }
        return block()
    }

    // 이 경로가 조용히 재시도만 반복하고 있으면 알 수 있어야 한다.
    private fun logRetry(attempt: Int, cause: Exception) {
        log.info("word save conflict, retrying ({}/{}): {}", attempt + 1, MAX_SAVE_ATTEMPTS, cause.message)
    }

    /** 호출 전에 [validateAndResolveDecks] 가 끝나 있어야 한다. */
    private fun addWordInternal(userId: Long, request: AddWordDto, targets: DeckTargets): AddWordOutcome {
        val requestedSenses = request.senses.forSave()

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
        // sense 가 이미 다 있어 word 자체는 안 바뀌었어도 아래 둘은 매번 보장한다.
        flashcardService.createFlashcard(userId, wordId)
        deckService.linkSavedWord(targets, wordId, request.songId)

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
        requireExistingSongs(senses.flatMap { it.examples }.mapNotNull { it.songId })

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

        // words 를 FK 로 참조하는 쪽부터 정리한다. 단어장 자체는 비어도 남는다 — word 보다 오래 산다.
        flashcardService.deleteByWordId(wordId)
        deckService.unlinkWord(wordId)
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

    private fun requireExistingSongs(songIds: Collection<Long>) {
        if (songIds.distinct().any { !songRepository.existsById(it) }) {
            throw BusinessException(ErrorCode.SONG_NOT_FOUND)
        }
    }

    /**
     * 담기 경로의 정규화. 곡이 주는 뜻은 "사랑, 애정" 같은 한 문자열이라 조각마다 sense 를 만든다.
     * 쪼갠 뒤 [merge] 가 문자열 일치로 판정하므로, 이미 담은 조각에는 예문만 붙고 처음 보는
     * 조각만 새 sense 로 들어간다.
     */
    private fun List<WordSense>.forSave(): List<WordSense> = splitMeanings().normalized()

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
        return result.dedupExamples()
    }

    /**
     * 예문 중복 제거는 **단어 전체** 기준이다. 후렴처럼 같은 가사 줄이 곡 안에서 반복되면 줄
     * 번호만 다른 같은 문장이 sense 마다·여러 번 담기는데, 예문으로서는 완전히 같은 것이라
     * 처음 하나만 남긴다. sense 를 가로지르는 것도 같다 — 한 가사 줄은 뜻 하나에만 붙는다.
     *
     * 이미 중복이 저장된 단어도 다시 담길 때 이 경로를 타면서 정리된다.
     */
    private fun List<WordSense>.dedupExamples(): List<WordSense> {
        val seen = mutableSetOf<String>()
        return map { sense ->
            sense.copy(
                examples = sense.examples
                    .filter { seen.add(exampleKey(it)) }
                    .take(MAX_EXAMPLES_PER_SENSE),
            )
        }
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

        // 경쟁 상대의 트랜잭션은 곧 끝나고, 두 번째 시도는 이미 만들어진 단어장을 찾기만 한다.
        private const val MAX_SAVE_ATTEMPTS = 3

        private val log = LoggerFactory.getLogger(WordService::class.java)

        /**
         * 예문의 동일성은 **문장 텍스트**다. 같은 줄이 곡 안에서 반복되면 `lineIndex` 는
         * 다르지만 예문으로는 구별되지 않으므로, 줄 번호나 곡을 키에 넣지 않는다.
         */
        private fun exampleKey(example: SenseExample) = example.text.trim().replace(WHITESPACE, " ")

        private val WHITESPACE = Regex("\\s+")
    }
}
