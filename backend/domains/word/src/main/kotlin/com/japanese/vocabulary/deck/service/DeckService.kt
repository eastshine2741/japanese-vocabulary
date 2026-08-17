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
import com.japanese.vocabulary.deck.model.DeckTargets
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
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

/**
 * 단어장은 word 의 부수 개념이지만 **word 보다 오래 산다**. 단어를 담을 때 [linkSavedWord] 로
 * 만들어지고 연결되지만, 안의 단어가 모두 지워져도 단어장은 남고 단어장을 지워도 단어는 남는다.
 * 쓰기 경로는 word 저장 트랜잭션에 합류하므로 여기서 새 트랜잭션을 열지 않는다.
 */
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
     * 단어를 담을 단어장들을 확보한다. **저장 트랜잭션 밖에서, 요청당 한 번** 부른다.
     *
     * 단어장 행 생성을 저장 트랜잭션에서 빼면 두 가지가 좋아진다. 단어마다 반복 조회하지 않게
     * 되고, 같은 유저의 동시 저장이 `decks` UNIQUE 에서 부딪히는 창이 짧아진다. 빼도 되는 이유는
     * 단어장이 단어보다 오래 살기 때문 — 저장이 실패해 빈 단어장만 남아도 그건 정상 상태다.
     */
    @Transactional
    fun resolveDeckTargets(userId: Long, songIds: Collection<Long>): DeckTargets = DeckTargets(
        defaultDeckId = ensureDefaultDeckId(userId),
        songDeckIds = songIds.distinct().associateWith { ensureSongDeckId(userId, it) },
    )

    /**
     * 방금 저장된 단어를 단어장에 연결한다. **word 저장과 같은 트랜잭션에서만** 호출된다 —
     * "모든 단어는 전체 단어장에 속한다"는 불변식이 커밋 단위로 지켜져야 하기 때문이다.
     */
    @Transactional
    fun linkSavedWord(targets: DeckTargets, wordId: Long, songId: Long?) {
        targets.idsFor(songId).forEach { deckId ->
            if (!deckWordRepository.existsByDeckIdAndWordId(deckId, wordId)) {
                deckWordRepository.save(DeckWordEntity(deckId = deckId, wordId = wordId))
            }
        }
    }

    /** 단어 삭제 시 멤버십만 끊는다. 단어장 자체는 비어도 남는다. */
    @Transactional
    fun unlinkWord(wordId: Long) {
        deckWordRepository.deleteByWordId(wordId)
    }

    /**
     * 단어장만 지운다 — 안의 단어와 flashcard 는 그대로 남고, 전체 단어장 연결도 유지된다.
     * 전체 단어장은 "모든 단어는 전체 단어장에 속한다"는 불변식의 담지자라 지울 수 없다.
     */
    @Transactional
    fun deleteDeck(userId: Long, deckId: Long) {
        val deck = loadOwnedDeck(userId, deckId)
        if (deck.isDefault == true) throw BusinessException(ErrorCode.DEFAULT_DECK_NOT_DELETABLE)
        deckWordRepository.deleteByDeckId(deckId)
        deckRepository.delete(deck)
    }

    /**
     * 전체 단어장은 마이그레이션으로 실체화되지만, 이후 가입한 유저를 위해 없으면 만든다.
     *
     * 같은 유저가 동시에 담으면 여기서 `UNIQUE(user_id, is_default)` 에 걸릴 수 있다. 이 예외는
     * 삼키지 않고 트랜잭션을 통째로 롤백시킨 뒤 [com.japanese.vocabulary.word.service.WordService]
     * 가 새 트랜잭션으로 재시도한다 — 재시도의 새 스냅샷에서는 이긴 쪽이 만든 deck 이 보인다.
     */
    private fun ensureDefaultDeckId(userId: Long): Long =
        deckRepository.findByUserIdAndIsDefaultTrue(userId)?.id
            ?: deckRepository.save(
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
                val song = songRepository.findById(songId)
                    .orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
                deckRepository.save(
                    DeckEntity(
                        userId = userId,
                        songId = songId,
                        isDefault = null,
                        title = song.title,
                        description = song.artist,
                    )
                ).id!!
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
