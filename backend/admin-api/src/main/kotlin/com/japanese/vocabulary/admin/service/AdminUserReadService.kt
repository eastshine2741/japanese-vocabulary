package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminUserDeckResponse
import com.japanese.vocabulary.admin.dto.AdminUserDetailResponse
import com.japanese.vocabulary.admin.dto.AdminUserLearningResponse
import com.japanese.vocabulary.admin.dto.AdminUserResponse
import com.japanese.vocabulary.admin.dto.AdminUserWordResponse
import com.japanese.vocabulary.admin.dto.AdminWordExampleResponse
import com.japanese.vocabulary.admin.dto.AdminWordFlashcardResponse
import com.japanese.vocabulary.admin.dto.AdminWordSenseResponse
import com.japanese.vocabulary.admin.dto.AdminWordSongRefResponse
import com.japanese.vocabulary.admin.repository.AdminDeckRepository
import com.japanese.vocabulary.admin.repository.AdminFlashcardRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.admin.repository.AdminUserRepository
import com.japanese.vocabulary.admin.repository.AdminWordRepository
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.entity.WordEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * 유저 단위 학습 가시성. 유저가 담은 단어·단어장·복습 상태를 읽기만 한다.
 *
 * 복습 상태 분포와 단어장 통계는 도메인 [DeckRepository] 의 집계 쿼리를 그대로 써서
 * 앱이 유저에게 보여 주는 숫자와 어긋나지 않게 한다.
 */
@Service
@Transactional(readOnly = true)
class AdminUserReadService(
    private val userRepository: AdminUserRepository,
    private val wordRepository: AdminWordRepository,
    private val deckRepository: AdminDeckRepository,
    private val flashcardRepository: AdminFlashcardRepository,
    private val songRepository: AdminSongRepository,
    private val deckStatsRepository: DeckRepository,
    private val clock: Clock,
) {
    fun listUsers(query: String?, pageable: Pageable): Page<AdminUserResponse> {
        val sorted = PageRequest.of(pageable.pageNumber, pageable.pageSize, Sort.by(Sort.Direction.DESC, "id"))
        val page = query?.trim()?.takeIf { it.isNotEmpty() }
            ?.let {
                userRepository.findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrNameContainingIgnoreCase(
                    it,
                    it,
                    it,
                    sorted,
                )
            }
            ?: userRepository.findAll(sorted)
        val activities = activitiesFor(page.content.mapNotNull { it.id })
        return page.map { it.toResponse(activities[it.id] ?: UserActivity.EMPTY) }
    }

    fun getUser(id: Long): AdminUserDetailResponse {
        val user = userRepository.findById(id).orElseThrow { NoSuchElementException("User not found") }
        val activity = activitiesFor(listOf(id))[id] ?: UserActivity.EMPTY
        val now = Instant.now(clock)

        val stats = deckStatsRepository.findAllDeckDetailStats(id, now)
        val recent = userRepository.summarizeRecentStudy(id, studyDate(now).minusDays(RECENT_STUDY_DAYS - 1))
        val learning = AdminUserLearningResponse(
            wordCount = activity.wordCount,
            dueCount = stats.getDueCount().toLong(),
            newCount = stats.getNewWordCount().toLong(),
            studyingCount = stats.getStudyingCount().toLong(),
            masteredCount = stats.getMasteredCount().toLong(),
            lastWordSavedAt = activity.lastWordSavedAt,
            lastReviewedAt = activity.lastReviewedAt,
            reviewDaysLast30 = recent.getReviewDays(),
            reviewCountLast30 = recent.getReviewCount(),
        )

        return AdminUserDetailResponse(
            user = user.toResponse(activity),
            learning = learning,
            decks = decksOf(id, now),
        )
    }

    fun listWords(userId: Long, deckId: Long?, query: String?, pageable: Pageable): Page<AdminUserWordResponse> {
        if (!userRepository.existsById(userId)) throw NoSuchElementException("User not found")
        val sorted = PageRequest.of(pageable.pageNumber, pageable.pageSize, Sort.by(Sort.Direction.DESC, "id"))
        val page = wordRepository.search(userId, deckId, query?.trim().orEmpty(), sorted)

        val wordIds = page.content.mapNotNull { it.id }
        val flashcards = if (wordIds.isEmpty()) emptyMap() else {
            flashcardRepository.findByWordIdIn(wordIds).associateBy { it.wordId }
        }
        val songIds = page.content.flatMap { word -> word.senses.flatMap { s -> s.examples.mapNotNull { it.songId } } }.toSet()
        val songs = songsById(songIds)

        return page.map { word -> word.toResponse(flashcards[word.id], songs) }
    }

    private fun decksOf(userId: Long, now: Instant): List<AdminUserDeckResponse> {
        val decks = deckRepository.findByUserIdOrderByIdDesc(userId)
        if (decks.isEmpty()) return emptyList()
        val stats = deckStatsRepository.findDeckStats(userId, decks.mapNotNull { it.id }, now).associateBy { it.getDeckId() }
        val songs = songsById(decks.mapNotNull { it.songId }.toSet())
        return decks.map { deck ->
            val stat = stats[deck.id]
            val song = deck.songId?.let { songs[it] }
            AdminUserDeckResponse(
                id = requireNotNull(deck.id),
                kind = deck.kind(),
                title = deck.title,
                description = deck.description,
                songId = deck.songId,
                songTitle = song?.title,
                songArtist = song?.artist,
                wordCount = stat?.getWordCount()?.toLong() ?: 0,
                dueCount = stat?.getDueCount()?.toLong() ?: 0,
                newCount = stat?.getNewWordCount()?.toLong() ?: 0,
                studyingCount = stat?.getStudyingCount()?.toLong() ?: 0,
                masteredCount = stat?.getMasteredCount()?.toLong() ?: 0,
                createdAt = deck.createdAt,
            )
        }
    }

    private fun songsById(songIds: Set<Long>): Map<Long, SongEntity> =
        if (songIds.isEmpty()) emptyMap() else songRepository.findAllById(songIds).associateBy { requireNotNull(it.id) }

    private fun activitiesFor(userIds: List<Long>): Map<Long, UserActivity> {
        if (userIds.isEmpty()) return emptyMap()
        val words = wordRepository.summarizeByUserIds(userIds).associateBy { it.getUserId() }
        val decks = deckRepository.summarizeByUserIds(userIds).associateBy { it.getUserId() }
        val flashcards = flashcardRepository.summarizeByUserIds(userIds).associateBy { it.getUserId() }
        return userIds.associateWith { id ->
            UserActivity(
                wordCount = words[id]?.getWordCount() ?: 0,
                songDeckCount = decks[id]?.getSongDeckCount() ?: 0,
                customDeckCount = decks[id]?.getCustomDeckCount() ?: 0,
                lastWordSavedAt = words[id]?.getLastSavedAt(),
                lastReviewedAt = flashcards[id]?.getLastReviewedAt(),
            )
        }
    }

    /** studystats 의 KstClock 과 같은 04:00 KST 경계로 학습일을 계산한다. */
    private fun studyDate(now: Instant): LocalDate =
        now.atZone(KST).minusHours(STUDY_DAY_START_HOUR).toLocalDate()

    private data class UserActivity(
        val wordCount: Long,
        val songDeckCount: Long,
        val customDeckCount: Long,
        val lastWordSavedAt: Instant?,
        val lastReviewedAt: Instant?,
    ) {
        companion object {
            val EMPTY = UserActivity(0, 0, 0, null, null)
        }
    }

    private fun UserEntity.toResponse(activity: UserActivity): AdminUserResponse = AdminUserResponse(
        id = requireNotNull(id),
        provider = provider,
        username = username,
        email = email,
        name = name,
        createdAt = createdAt,
        deletedAt = deletedAt,
        wordCount = activity.wordCount,
        songDeckCount = activity.songDeckCount,
        customDeckCount = activity.customDeckCount,
        lastWordSavedAt = activity.lastWordSavedAt,
        lastReviewedAt = activity.lastReviewedAt,
    )

    private fun DeckEntity.kind(): String = when {
        isDefault == true -> "DEFAULT"
        songId != null -> "SONG"
        else -> "CUSTOM"
    }

    private fun WordEntity.toResponse(flashcard: FlashcardEntity?, songs: Map<Long, SongEntity>): AdminUserWordResponse {
        val sourceSongIds = senses.flatMap { s -> s.examples.mapNotNull { it.songId } }.distinct()
        return AdminUserWordResponse(
            id = requireNotNull(id),
            japaneseText = japaneseText,
            reading = reading,
            senses = senses.map { sense ->
                AdminWordSenseResponse(
                    meaning = sense.meaning,
                    partOfSpeech = sense.partOfSpeech,
                    jlpt = sense.jlpt,
                    examples = sense.examples.map {
                        AdminWordExampleResponse(text = it.text, translation = it.translation, songId = it.songId, lineIndex = it.lineIndex)
                    },
                )
            },
            sourceSongs = sourceSongIds.mapNotNull { songId ->
                songs[songId]?.let { AdminWordSongRefResponse(id = songId, title = it.title, artist = it.artist) }
            },
            flashcard = flashcard?.let {
                AdminWordFlashcardResponse(
                    status = it.status(),
                    fsrsState = it.state,
                    due = it.due,
                    lastReview = it.lastReview,
                )
            },
            createdAt = createdAt,
        )
    }

    // DeckRepository.findDeckStats 의 CASE 식과 같은 판정.
    private fun FlashcardEntity.status(): String = when {
        state == 1 -> "MASTERED"
        state == 2 || lastReview != null -> "STUDYING"
        else -> "NEW"
    }

    companion object {
        private val KST: ZoneId = ZoneId.of("Asia/Seoul")
        private const val STUDY_DAY_START_HOUR = 4L
        private const val RECENT_STUDY_DAYS = 30L
    }
}
