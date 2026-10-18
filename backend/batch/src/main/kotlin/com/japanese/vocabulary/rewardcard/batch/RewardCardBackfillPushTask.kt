package com.japanese.vocabulary.rewardcard.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * [RewardCardBackfillTask] 로 곡 카드가 생긴 유저에게 알린다. 채우기를 마친 뒤 수동으로 한 번 돌린다.
 * 보낸 기록을 남기지 않으므로 다시 돌리면 같은 유저에게 또 간다.
 */
@Component
class RewardCardBackfillPushTask(
    private val rewardCardService: RewardCardService,
    private val userRepository: UserRepository,
    private val songRepository: SongRepository,
    private val deviceTokenRepository: DeviceTokenRepository,
    private val pushNotificationService: ObjectProvider<PushNotificationService>,
) : CronTask {
    private val logger = LoggerFactory.getLogger(RewardCardBackfillPushTask::class.java)

    override val name = NAME

    data class Result(
        /** 기기 토큰이 있어 알림을 받을 유저 수. */
        val users: Int,
        /** dry run 이면 보낼 푸시 수, 아니면 보낸 푸시 수. */
        val pushed: Int,
    )

    /** `--dry-run` 은 보내지 않고 셀 결과만 남긴다. */
    override fun run(args: ApplicationArguments) {
        val dryRun = args.containsOption(DRY_RUN_OPTION)
        val result = push(dryRun)
        logger.info("rewardCardBackfillPush dryRun={} result={}", dryRun, result)
    }

    data class Message(val userId: Long, val songId: Long, val body: String)

    fun push(dryRun: Boolean): Result {
        val sender = if (dryRun) null else checkNotNull(pushNotificationService.ifAvailable) { "push is not configured" }
        var users = 0
        var pushed = 0
        for (message in messages()) {
            val tokens = deviceTokenRepository.findAllByUserId(message.userId)
            if (tokens.isEmpty()) continue
            users++
            if (sender == null) {
                pushed += tokens.size
                continue
            }
            val data = mapOf("type" to PUSH_TYPE, "title" to TITLE, "body" to message.body, "songId" to message.songId.toString())
            for (token in tokens) {
                if (sender.send(message.userId, token.token, TITLE, message.body, data)) pushed++
            }
        }
        return Result(users, pushed)
    }

    /** 탈퇴하지 않았고 채우기로 곡 카드가 생긴 유저마다 한 통. */
    fun messages(): List<Message> {
        val backfilled = rewardCardService.backfilledSongs()
        val names = userRepository.findAllById(backfilled.keys)
            .filter { it.deletedAt == null }
            .associate { it.id!! to it.name }
        val songs = backfilled.filterKeys { it in names }
        val headlines = songs.mapValues { (_, cards) -> headline(cards) }
        val titles = songRepository.findAllById(headlines.values.toSet()).associate { it.id!! to it.title }
        return songs.map { (userId, cards) ->
            val songId = headlines.getValue(userId)
            Message(userId, songId, body(names.getValue(userId), titles.getValue(songId), cards.size - 1))
        }
    }

    companion object {
        const val NAME = "reward-card-backfill-push"
        const val DRY_RUN_OPTION = "dry-run"
        const val PUSH_TYPE = "reward_cards_backfilled"
        const val TITLE = "신기능 출시! 공부할수록 성장하는 최애곡 카드"

        private const val SONG_TITLE_MAX = 20

        /** 알림에 이름을 올릴 곡. 등급이 가장 높고, 같으면 나중에 채운 곡이다. [cards] 는 채운 순서다. */
        fun headline(cards: List<SongAchievementDto>): Long = cards.withIndex()
            .maxWith(compareBy({ it.value.grade }, { it.index })).value.songId

        fun body(name: String, songTitle: String, otherSongs: Int): String {
            val title = if (songTitle.length > SONG_TITLE_MAX) songTitle.take(SONG_TITLE_MAX) + "…" else songTitle
            val songs = if (otherSongs > 0) "「$title」 외 ${otherSongs}곡을 카드로" else "「$title」 카드를"
            return "${name}님께 $songs 만들어드렸어요. 최신 버전으로 업데이트 후 확인해보세요"
        }
    }
}
