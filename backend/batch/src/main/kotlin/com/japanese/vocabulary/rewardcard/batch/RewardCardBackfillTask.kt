package com.japanese.vocabulary.rewardcard.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.deck.dto.SongDeckRefDto
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import com.japanese.vocabulary.rewardcard.service.SongCardGrader
import com.japanese.vocabulary.user.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * 카드 기능 전부터 담아 둔 곡 단어장을 지금 등급까지 등급마다 연출 없이 발급된 카드로 채운다. 알림은 [RewardCardBackfillPushTask] 가 따로 보낸다.
 * 등급은 플래그와 상관없이 출시 기준인 14일 장기기억으로 잰다.
 * 새 앱이 충분히 퍼진 뒤 수동으로 한 번 돌린다 — 끝에 모든 카드를 조용히 발급하므로, 다시 돌리면 그 사이 쌓인 연출도 사라진다.
 * 담아 둔 곡이 많은 유저가 다른 곡과 겹치는 단어 하나를 rating 할 때마다 지금 공부하지 않는 곡의 카드가 튀어나오지 않게 미리 채운다.
 */
@Component
class RewardCardBackfillTask(
    private val deckRepository: DeckRepository,
    private val songCardGrader: SongCardGrader,
    private val rewardCardService: RewardCardService,
    private val userRepository: UserRepository,
) : CronTask {
    private val logger = LoggerFactory.getLogger(RewardCardBackfillTask::class.java)

    override val name = NAME

    data class Result(
        val users: Int,
        val newSongCards: Int,
        val newArtistCards: Int,
        /** 조용히 발급돼 연출이 사라지는 대기 카드 수. 실제 실행은 세지 않는다. */
        val silencedReveals: Int,
        val failed: Int,
    )

    /** `--dry-run` 은 아무것도 쓰지 않고 셀 결과만 남긴다. */
    override fun run(args: ApplicationArguments) {
        if (args.containsOption(DRY_RUN_OPTION)) {
            logger.info("rewardCardBackfill dryRun result={}", dryRun())
            return
        }
        val result = backfill()
        logger.info("rewardCardBackfill result={}", result)
        check(result.failed == 0) { "reward card backfill failed for ${result.failed} song decks" }
    }

    fun backfill(): Result {
        val (decks, users) = targets()
        var newSongCards = 0
        var newArtistCards = 0
        var failed = 0
        // 곡 단어장을 만든 순서대로 하나씩 — 같은 곡·등급은 먼저 담은 유저가 앞 순번을 받는다.
        for (deck in decks) {
            try {
                val achievement = songCardGrader.measure(deck.userId, listOf(deck.songId), FlashcardMemory.LONG_TERM_STABILITY_DAYS).singleOrNull() ?: continue
                val created = rewardCardService.backfillSong(deck.userId, achievement)
                newSongCards += created.songCards
                newArtistCards += created.artistCards
            } catch (e: Exception) {
                failed++
                logger.warn("rewardCardBackfill failed userId={} songId={}", deck.userId, deck.songId, e)
            }
        }
        users.forEach { rewardCardService.issueAllSilently(it) }
        return Result(users.size, newSongCards, newArtistCards, silencedReveals = 0, failed)
    }

    /** [backfill] 과 같은 대상을 재기만 한다. 순번을 받지 않으므로 rating 과 락을 다투지 않는다. */
    fun dryRun(): Result {
        val (decks, users) = targets()
        var newSongCards = 0
        // 유저 → 채우는 곡의 아티스트
        val artistsByUser = mutableMapOf<Long, MutableSet<Long>>()
        var failed = 0
        for (deck in decks) {
            try {
                val achievement = songCardGrader.measure(deck.userId, listOf(deck.songId), FlashcardMemory.LONG_TERM_STABILITY_DAYS).singleOrNull() ?: continue
                val owned = rewardCardService.ownedSongGrades(deck.userId, listOf(deck.songId))[deck.songId].orEmpty()
                val missing = SongCardGrade.entries.count { it <= achievement.grade && it !in owned }
                newSongCards += missing
                val artistId = achievement.artistId ?: continue
                artistsByUser.getOrPut(deck.userId) { mutableSetOf() } += artistId
            } catch (e: Exception) {
                failed++
                logger.warn("rewardCardBackfill dryRun failed userId={} songId={}", deck.userId, deck.songId, e)
            }
        }
        // 아티스트 카드는 아티스트마다 한 장이라 아직 없는 아티스트만 센다. 강화는 카드 수를 늘리지 않는다.
        val newArtistCards = artistsByUser.entries.sumOf { (userId, artistIds) ->
            val owned = rewardCardService.artistGrades(userId, artistIds)
            artistIds.count { it !in owned }
        }
        return Result(
            users = users.size,
            newSongCards = newSongCards,
            newArtistCards = newArtistCards,
            silencedReveals = users.sumOf { rewardCardService.pending(it).size },
            failed = failed,
        )
    }

    /** 탈퇴하지 않은 유저의 곡 단어장(만든 순서)과 그 유저들. */
    private fun targets(): Pair<List<SongDeckRefDto>, Set<Long>> {
        val decks = deckRepository.findSongDecksInCreationOrder()
        val users = userRepository.findAllById(decks.map { it.userId }.toSet())
            .filter { it.deletedAt == null }
            .mapTo(sortedSetOf()) { it.id!! }
        return decks.filter { it.userId in users } to users
    }

    companion object {
        const val NAME = "reward-card-backfill"
        const val DRY_RUN_OPTION = "dry-run"
    }
}
