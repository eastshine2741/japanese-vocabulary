package com.japanese.vocabulary.karaoke.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.karaoke.service.KaraokeSongService
import com.japanese.vocabulary.studystats.util.KstClock
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * 노래방 일본 신곡 수집과 알림 (docs/karaoke-new-songs.md). 원장에 넣고 → 분석을 요청하고 → 알린다.
 * `--backfill` 은 첫 배포용: TJ 지난달부터 전부 넣고 알림은 보내지 않는다.
 */
@Component
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class KaraokeCollectTask(
    private val karaokeSongService: KaraokeSongService,
    private val collector: KaraokeListingCollector,
    private val notifier: KaraokeNewSongNotifier,
    private val kstClock: KstClock,
) : CronTask {
    private val logger = LoggerFactory.getLogger(KaraokeCollectTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val backfill = args.containsOption(BACKFILL_OPTION)
        val now = kstClock.nowKst()
        val linked = karaokeSongService.backfillLinks()
        val collected = collector.collect(now.toLocalDate(), backfill)
        val notified = notifier.notifyPending(now.toInstant(), send = !backfill)
        logger.info("karaokeCollect linked={} collected={} notified={}", linked, collected, notified)
        // 한쪽 노래방이 실패해도 다른 쪽은 넣고 알린 뒤, Job 은 실패로 남겨 눈에 띄게 한다.
        check(collected.failedVendors.isEmpty()) { "karaoke vendors failed: ${collected.failedVendors}" }
    }

    companion object {
        const val NAME = "karaoke-collect"
        const val BACKFILL_OPTION = "backfill"
    }
}
