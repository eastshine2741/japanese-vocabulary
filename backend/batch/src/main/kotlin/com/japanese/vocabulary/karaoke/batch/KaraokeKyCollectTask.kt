package com.japanese.vocabulary.karaoke.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.karaoke.service.KaraokeSongService
import com.japanese.vocabulary.studystats.util.KstClock
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * 금영 일본 신곡 수집 (docs/karaoke-new-songs.md). 노래책 전체를 1초에 1건씩 훑어 10분 넘게 걸리므로 하루 한 번 돈다.
 * 알림은 5분마다 도는 [KaraokeTjCollectTask] 가 보낸다.
 */
@Component
class KaraokeKyCollectTask(
    private val karaokeSongService: KaraokeSongService,
    private val collector: KaraokeListingCollector,
    private val kstClock: KstClock,
) : CronTask {
    private val logger = LoggerFactory.getLogger(KaraokeKyCollectTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val linked = karaokeSongService.backfillLinks()
        val collected = collector.collectKy(kstClock.nowKst().toLocalDate())
        logger.info("karaokeKyCollect linked={} collected={}", linked, collected)
    }

    companion object {
        const val NAME = "karaoke-ky"
    }
}
