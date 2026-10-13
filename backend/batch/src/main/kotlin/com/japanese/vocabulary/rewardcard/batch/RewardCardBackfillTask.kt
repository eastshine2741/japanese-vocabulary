package com.japanese.vocabulary.rewardcard.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.deck.dto.SongDeckRefDto
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.service.SongCardGrader
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * 카드 기능 전부터 담아 둔 곡 단어장을 지금 등급까지 등급마다 연출 없이 발급된 카드로 채우고, 카드가 새로 생긴 유저에게 알린다.
 * 새 앱이 충분히 퍼진 뒤 수동으로 한 번 돌린다 — 끝에 모든 카드를 조용히 발급하므로, 다시 돌리면 그 사이 쌓인 연출도 사라진다.
 * 담아 둔 곡이 많은 유저가 다른 곡과 겹치는 단어 하나를 rating 할 때마다 지금 공부하지 않는 곡의 카드가 튀어나오지 않게 미리 채운다.
 */
@Component
class RewardCardBackfillTask(
    private val deckRepository: DeckRepository,
    private val songCardGrader: SongCardGrader,
    private val rewardCardService: RewardCardService,
    private val userRepository: UserRepository,
    private val songRepository: SongRepository,
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
        val newSongs = mutableMapOf<Long, MutableList<SongAchievementDto>>()
        var newSongCards = 0
        var newArtistCards = 0
        var failed = 0
        // 곡 단어장을 만든 순서대로 하나씩 — 같은 곡·등급은 먼저 담은 유저가 앞 순번을 받는다.
        for (deck in decks) {
            try {
                val achievement = songCardGrader.measure(deck.userId, listOf(deck.songId)).singleOrNull() ?: continue
                val created = rewardCardService.backfillSong(deck.userId, achievement)
                if (created.songCards > 0) newSongs.getOrPut(deck.userId) { mutableListOf() } += achievement
                newSongCards += created.songCards
                newArtistCards += created.artistCards
            } catch (e: Exception) {
                failed++
                logger.warn("rewardCardBackfill failed userId={} songId={}", deck.userId, deck.songId, e)
            }
        }
        active.keys.forEach { rewardCardService.issueAllSilently(it) }
        val pushed = if (push) notify(newSongs, active) else 0
        return Result(active.size, newSongCards, newArtistCards, silencedReveals = 0, failed, pushed)
    }

    /** [backfill] 과 같은 대상을 재기만 한다. 순번을 받지 않으므로 rating 과 락을 다투지 않는다. */
    fun dryRun(): Result {
        val (decks, active) = targets()
        val newSongCards = mutableMapOf<Long, Int>()
        // 유저 → 아티스트 → 채운 뒤의 마스터 곡 수에 더해질 곡 수
        val newMasters = mutableMapOf<Long, MutableMap<Long, Int>>()
        var failed = 0
        for (deck in decks) {
            try {
                val achievement = songCardGrader.measure(deck.userId, listOf(deck.songId)).singleOrNull() ?: continue
                val owned = rewardCardService.ownedSongGrades(deck.userId, listOf(deck.songId))[deck.songId].orEmpty()
                val missing = SongCardGrade.entries.count { it <= achievement.grade && it !in owned }
                if (missing > 0) newSongCards.merge(deck.userId, missing, Int::plus)
                val artistId = achievement.artistId ?: continue
                val mastered = achievement.grade == SongCardGrade.MASTER && SongCardGrade.MASTER !in owned
                newMasters.getOrPut(deck.userId) { mutableMapOf() }.merge(artistId, if (mastered) 1 else 0, Int::plus)
            } catch (e: Exception) {
                failed++
                logger.warn("rewardCardBackfill dryRun failed userId={} songId={}", deck.userId, deck.songId, e)
            }
        }
        val newArtistCards = newMasters.entries.sumOf { (userId, added) ->
            val counts = rewardCardService.masterCounts(userId, added.keys)
            val owned = rewardCardService.ownedArtistGrades(userId, added.keys)
            added.entries.sumOf { (artistId, extra) ->
                val target = ArtistCardGrade.forMasterCount((counts[artistId] ?: 0) + extra)
                ArtistCardGrade.entries.count { it <= target && it !in owned[artistId].orEmpty() }
            }
        }
        return Result(
            users = active.size,
            newSongCards = newSongCards.values.sum(),
            newArtistCards = newArtistCards,
            silencedReveals = active.keys.sumOf { rewardCardService.pending(it).size },
            failed = failed,
            pushed = newSongCards.keys.count { deviceTokenRepository.findAllByUserId(it).isNotEmpty() },
        )
    }

    /** 탈퇴하지 않은 유저의 곡 단어장(만든 순서)과 유저별 표시 이름. */
    private fun targets(): Pair<List<SongDeckRefDto>, Map<Long, String>> {
        val decks = deckRepository.findSongDecksInCreationOrder()
        val active = userRepository.findAllById(decks.map { it.userId }.toSet())
            .filter { it.deletedAt == null }
            .associate { it.id!! to it.name }
            .toSortedMap()
        return decks.filter { it.userId in active } to active
    }

    private fun notify(newCards: Map<Long, List<SongAchievementDto>>, names: Map<Long, String>): Int {
        val sender = pushNotificationService.ifAvailable ?: return 0
        val headlines = newCards.mapValues { (_, cards) -> headline(cards) }
        val titles = songRepository.findAllById(headlines.values.toSet()).associate { it.id!! to it.title }
        var sent = 0
        for ((userId, cards) in newCards) {
            val songId = headlines.getValue(userId)
            val body = body(names.getValue(userId), titles.getValue(songId), cards.size - 1)
            val data = mapOf("type" to PUSH_TYPE, "title" to TITLE, "body" to body, "songId" to songId.toString())
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
        const val TITLE = "신기능 출시! 공부할수록 성장하는 최애곡 카드"

        private const val SONG_TITLE_MAX = 20

        /** 알림에 이름을 올릴 곡. 등급이 가장 높고, 같으면 나중에 담은 곡이다. [cards] 는 담은 순서다. */
        fun headline(cards: List<SongAchievementDto>): Long = cards.withIndex()
            .maxWith(compareBy({ it.value.grade }, { it.index })).value.songId

        fun body(name: String, songTitle: String, otherSongs: Int): String {
            val title = if (songTitle.length > SONG_TITLE_MAX) songTitle.take(SONG_TITLE_MAX) + "…" else songTitle
            val songs = if (otherSongs > 0) "「$title」 외 ${otherSongs}곡을 카드로" else "「$title」 카드를"
            return "${name}님께 $songs 만들어드렸어요. 최신 버전으로 업데이트 후 확인해보세요"
        }
    }
}
