package com.japanese.vocabulary.rewardcard.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.deck.dto.SongDeckRefDto
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import com.japanese.vocabulary.rewardcard.service.SongCardGrader
import com.japanese.vocabulary.user.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * 카드 기능 전부터 담아 둔 곡 단어장을 연출 없이 발급된 카드로 채우고, 카드가 새로 생긴 유저에게 알린다.
 * 새 앱이 충분히 퍼진 뒤 수동으로 한 번 돌린다 — 끝에 모든 카드를 조용히 발급하므로, 다시 돌리면 그 사이 쌓인 연출도 사라진다.
 * 담아 둔 곡이 많은 유저가 다른 곡과 겹치는 단어 하나를 rating 할 때마다 지금 공부하지 않는 곡의 카드가 튀어나오지 않게 미리 채운다.
 */
@Component
class RewardCardBackfillTask(
    private val deckRepository: DeckRepository,
    private val songCardGrader: SongCardGrader,
    private val rewardCardService: RewardCardService,
    private val userRepository: UserRepository,
    private val deviceTokenRepository: DeviceTokenRepository,
    private val pushNotificationService: ObjectProvider<PushNotificationService>,
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
        /** dry run 이면 받을 유저 수, 아니면 보낸 푸시 수. */
        val pushed: Int,
    )

    /** `--dry-run` 은 아무것도 쓰거나 보내지 않고 셀 결과만 남긴다. `--no-push` 면 채우기만 한다. */
    override fun run(args: ApplicationArguments) {
        if (args.containsOption(DRY_RUN_OPTION)) {
            logger.info("rewardCardBackfill dryRun result={}", dryRun())
            return
        }
        val result = backfill(push = !args.containsOption(NO_PUSH_OPTION))
        logger.info("rewardCardBackfill result={}", result)
        check(result.failed == 0) { "reward card backfill failed for ${result.failed} song decks" }
    }

    fun backfill(push: Boolean): Result {
        val (decks, active) = targets()
        val newSongCards = mutableMapOf<Long, Int>()
        var newArtistCards = 0
        var failed = 0
        // 곡 단어장을 만든 순서대로 하나씩 — 같은 곡은 먼저 담은 유저가 앞 순번을 받는다.
        for (deck in decks) {
            try {
                val achievement = songCardGrader.measure(deck.userId, listOf(deck.songId)).singleOrNull() ?: continue
                val created = rewardCardService.backfillSong(deck.userId, achievement)
                if (created.song) newSongCards.merge(deck.userId, 1, Int::plus)
                if (created.artist) newArtistCards++
            } catch (e: Exception) {
                failed++
                logger.warn("rewardCardBackfill failed userId={} songId={}", deck.userId, deck.songId, e)
            }
        }
        active.forEach { rewardCardService.issueAllSilently(it) }
        val pushed = if (push) notify(newSongCards) else 0
        return Result(active.size, newSongCards.values.sum(), newArtistCards, silencedReveals = 0, failed, pushed)
    }

    /** [backfill] 과 같은 대상을 재기만 한다. 순번을 받지 않으므로 rating 과 락을 다투지 않는다. */
    fun dryRun(): Result {
        val (decks, active) = targets()
        val newSongCards = mutableMapOf<Long, Int>()
        val artistIdsByUser = mutableMapOf<Long, MutableSet<Long>>()
        var failed = 0
        for (deck in decks) {
            try {
                val achievement = songCardGrader.measure(deck.userId, listOf(deck.songId)).singleOrNull() ?: continue
                if (rewardCardService.songGrades(deck.userId, listOf(deck.songId)).isEmpty()) newSongCards.merge(deck.userId, 1, Int::plus)
                achievement.artistId?.let { artistIdsByUser.getOrPut(deck.userId) { mutableSetOf() } += it }
            } catch (e: Exception) {
                failed++
                logger.warn("rewardCardBackfill dryRun failed userId={} songId={}", deck.userId, deck.songId, e)
            }
        }
        val newArtistCards = artistIdsByUser.entries.sumOf { (userId, artistIds) ->
            (artistIds - rewardCardService.artistCards(userId).map { it.artistId }.toSet()).size
        }
        return Result(
            users = active.size,
            newSongCards = newSongCards.values.sum(),
            newArtistCards = newArtistCards,
            silencedReveals = active.sumOf { rewardCardService.pending(it).size },
            failed = failed,
            pushed = newSongCards.keys.count { deviceTokenRepository.findAllByUserId(it).isNotEmpty() },
        )
    }

    /** 탈퇴하지 않은 유저의 곡 단어장, 만든 순서. */
    private fun targets(): Pair<List<SongDeckRefDto>, Set<Long>> {
        val decks = deckRepository.findSongDecksInCreationOrder()
        val active = userRepository.findAllById(decks.map { it.userId }.toSet())
            .filter { it.deletedAt == null }
            .mapNotNull { it.id }
            .toSortedSet()
        return decks.filter { it.userId in active } to active
    }

    private fun notify(newCards: Map<Long, Int>): Int {
        val sender = pushNotificationService.ifAvailable ?: return 0
        var sent = 0
        for ((userId, count) in newCards) {
            val body = body(count)
            val data = mapOf("type" to PUSH_TYPE, "title" to TITLE, "body" to body)
            for (token in deviceTokenRepository.findAllByUserId(userId)) {
                if (sender.send(userId, token.token, TITLE, body, data)) sent++
            }
        }
        return sent
    }

    companion object {
        const val NAME = "reward-card-backfill"
        const val NO_PUSH_OPTION = "no-push"
        const val DRY_RUN_OPTION = "dry-run"
        const val PUSH_TYPE = "reward_cards_backfilled"
        const val TITLE = "곡 카드가 도착했어요"

        fun body(songCards: Int) = "그동안 공부한 곡으로 카드 ${songCards}장이 생겼어요. 확인해 보세요"
    }
}
