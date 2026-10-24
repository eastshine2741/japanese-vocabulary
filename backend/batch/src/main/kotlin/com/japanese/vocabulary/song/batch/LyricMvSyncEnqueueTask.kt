package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.song.service.LyricMvSyncService
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * 곡의 지금 (active 가사, MV) 조합 중 가사 싱크 대기열에 없는 것을 넣는다. 배포 중 옛 pod 가 끝낸 분석처럼
 * 분석 완료·제보 승인 경로가 넣지 못한 조합을 메운다.
 */
@Component
class LyricMvSyncEnqueueTask(
    private val lyricMvSyncService: LyricMvSyncService,
) : CronTask {
    private val logger = LoggerFactory.getLogger(LyricMvSyncEnqueueTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        logger.info("lyricMvSyncEnqueue added={}", lyricMvSyncService.enqueueMissing())
    }

    companion object {
        const val NAME = "lyric-mv-sync-enqueue"
    }
}
