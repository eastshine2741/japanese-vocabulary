package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.batch.CronTask
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * 정기 실행이 아니라 손으로 돌리는 백필. 뜻을 하나만 만들기 전에 분석된 가사를 고친다.
 * 한 페이지씩 커밋하니 중간에 실패해도 다시 돌리면 남은 곳만 바뀐다.
 */
@Component
class LyricMeaningBackfillTask(
    private val backfillService: LyricMeaningBackfillService,
) : CronTask {
    private val logger = LoggerFactory.getLogger(LyricMeaningBackfillTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val dryRun = args.getOptionValues("dryRun")?.firstOrNull().toBoolean()
        var page = 0
        var scanned = 0
        var changedLyrics = 0
        var changedTokens = 0
        while (true) {
            val result = backfillService.backfillPage(page++, PAGE_SIZE, dryRun)
            scanned += result.scannedLyrics
            changedLyrics += result.changedLyrics
            changedTokens += result.changedTokens
            if (result.scannedLyrics < PAGE_SIZE) break
        }
        logger.info(
            "lyricMeaningBackfill dryRun={} scanned={} changedLyrics={} changedTokens={}",
            dryRun, scanned, changedLyrics, changedTokens,
        )
    }

    companion object {
        const val NAME = "lyric-meaning-backfill"
        private const val PAGE_SIZE = 50
    }
}
