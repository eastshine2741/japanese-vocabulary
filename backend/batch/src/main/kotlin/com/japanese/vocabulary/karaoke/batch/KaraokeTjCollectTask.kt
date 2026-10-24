package com.japanese.vocabulary.karaoke.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.studystats.util.KstClock
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * TJ 일본 신곡 수집과 알림 (docs/karaoke-new-songs.md). TJ 는 등재 목록 한 번과 후보 몇 곡 검색이라 5분마다 돈다.
 * 금영이 넣은 행도 여기서 알린다: 두 task 가 따로 보내면 같은 행을 두 번 알릴 수 있다.
 * `--backfill` 은 첫 배포용: TJ 지난달부터 전부 넣고 알림은 보내지 않는다.
 */
@Component
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class KaraokeTjCollectTask(
    private val collector: KaraokeListingCollector,
    private val notifier: KaraokeNewSongNotifier,
    private val kstClock: KstClock,
) : CronTask {
    private val logger = LoggerFactory.getLogger(KaraokeTjCollectTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val backfill = args.containsOption(BACKFILL_OPTION)
        val now = kstClock.nowKst()
        // TJ 가 실패해도 쌓인 금영 행은 알리고, Job 은 실패로 남긴다.
        val collected = runCatching { collector.collectTj(now.toLocalDate(), backfill) }
        val notified = notifier.notifyPending(now.toInstant(), send = !backfill)
        logger.info("karaokeTjCollect collected={} notified={}", collected, notified)
        collected.getOrThrow()
    }

    companion object {
        const val NAME = "karaoke-tj"
        const val BACKFILL_OPTION = "backfill"
    }
}
