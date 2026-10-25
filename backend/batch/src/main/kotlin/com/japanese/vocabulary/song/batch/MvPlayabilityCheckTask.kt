package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubePlayability
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeUnplayable
import com.japanese.vocabulary.song.entity.MvUnavailableReason
import com.japanese.vocabulary.song.model.YoutubeVideoId
import com.japanese.vocabulary.song.repository.SongRepository
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate

/**
 * 곡 MV 가 앱에서 재생되는지 YouTube Data API 로 보고 [com.japanese.vocabulary.song.entity.SongEntity.mvUnavailableReason] 를
 * 채우거나 비운다. MV 를 고른 뒤 연령 제한이 걸리거나 삭제되는 일을 잡는다. 못 쓰는 MV 를 바꾸지는 않는다.
 * `videos.list` 는 id 50개에 1 unit 이라 곡 700개가 15 unit 남짓이다.
 */
@Component
class MvPlayabilityCheckTask(
    private val songRepository: SongRepository,
    private val youtubeClient: YoutubeClient,
    private val transactionTemplate: TransactionTemplate,
) : CronTask {
    private val logger = LoggerFactory.getLogger(MvPlayabilityCheckTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val videoIdBySongId = songRepository.findByYoutubeUrlIsNotNull()
            .mapNotNull { song -> YoutubeVideoId.parse(song.youtubeUrl)?.let { song.id!! to it } }
            .toMap()
        // 호출이 실패하면 예외로 끝낸다. 빈 응답으로 보고 전부 UNAVAILABLE 로 찍으면 안 된다.
        val itemsById = youtubeClient.listVideoContentDetails(videoIdBySongId.values.distinct()).associateBy { it.id }
        val reasonBySongId = videoIdBySongId.mapValues { (_, videoId) ->
            // 삭제·비공개 영상은 응답에서 빠진다.
            val unplayable = itemsById[videoId]?.let { YoutubePlayability.unplayable(it) } ?: if (videoId in itemsById) null else YoutubeUnplayable.NOT_FOUND
            unplayable?.let { if (it == YoutubeUnplayable.AGE_RESTRICTED) MvUnavailableReason.AGE_RESTRICTED else MvUnavailableReason.UNAVAILABLE }
        }

        var changed = 0
        transactionTemplate.executeWithoutResult {
            for ((songId, reason) in reasonBySongId) {
                val song = songRepository.findById(songId).orElse(null) ?: continue
                // 확인하는 사이 MV 가 바뀐 곡은 새 MV 를 다음 실행이 본다.
                if (YoutubeVideoId.parse(song.youtubeUrl) != videoIdBySongId[songId]) continue
                if (song.mvUnavailableReason == reason) continue
                song.mvUnavailableReason = reason
                changed++
            }
        }
        logger.info(
            "mvPlayabilityCheck songs={} unavailable={} changed={}",
            reasonBySongId.size, reasonBySongId.values.count { it != null }, changed,
        )
    }

    companion object {
        const val NAME = "mv-playability-check"
    }
}
