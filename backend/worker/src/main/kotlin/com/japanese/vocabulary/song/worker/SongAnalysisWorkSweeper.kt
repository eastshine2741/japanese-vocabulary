package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.messagequeue.SongAnalysisWorkQueuePublisher
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant

/**
 * 원장 행이 진실 원천이라는 전제를 지키는 쪽. 큐가 하는 일은 깨우기뿐이라 메시지가 유실돼도
 * (브로커 재시작, 커밋과 발행 사이의 크래시, 발행 실패) 행은 PENDING 으로 남는다. 여기서 주워
 * 다시 발행하고, 진행이 멈춘 RUNNING 행은 FAILED 로 넘긴다.
 *
 * 30초 폴링을 대체하는 게 아니라 안전망이므로 주기는 느슨해도 된다. 테스트에서는
 * `song-analysis.worker.sweep-enabled=false` 로 끈다.
 */
@Component
@ConditionalOnProperty(name = ["song-analysis.worker.sweep-enabled"], havingValue = "true", matchIfMissing = true)
class SongAnalysisWorkSweeper(
    private val workService: SongAnalysisWorkService,
    private val publisher: SongAnalysisWorkQueuePublisher,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkSweeper::class.java)

    @Scheduled(fixedDelayString = "\${song-analysis.worker.sweep-interval-ms:300000}")
    fun sweep() {
        try {
            val expired = workService.failStaleRunning(
                olderThan = Instant.now().minus(STALE_RUNNING_AGE),
                limit = EXPIRED_BATCH_SIZE,
            )
            if (expired > 0) {
                logger.warn("Marked {} stale song analysis work rows as FAILED", expired)
            }
        } catch (e: Exception) {
            logger.error("Failed to sweep expired song analysis work", e)
        }

        try {
            val stale = workService.findStalePendingIds(
                olderThan = Instant.now().minus(STALE_PENDING_AGE),
                limit = STALE_BATCH_SIZE,
            )
            if (stale.isNotEmpty()) {
                logger.warn("Requeueing {} song analysis work rows whose message was lost: {}", stale.size, stale)
                stale.forEach(publisher::publish)
            }
        } catch (e: Exception) {
            logger.error("Failed to requeue stale pending song analysis work", e)
        }
    }

    private companion object {
        const val EXPIRED_BATCH_SIZE = 20
        const val STALE_BATCH_SIZE = 20

        // updatedAt 이 이만큼 멈춰 있으면 worker 가 죽었다고 본다. 단계 전이마다 갱신되지만
        // ANALYZE_LYRICS 안에서는 쓰기가 없어서, 가장 긴 분석을 덮을 만큼 넉넉해야 한다.
        val STALE_RUNNING_AGE: Duration = Duration.ofMinutes(30)

        // 큐가 살아 있으면 발행 직후 처리되므로, 이 나이를 넘긴 PENDING 은 메시지가 없다고 본다.
        // 모든 consumer 가 바빠서 대기 중인 메시지는 재발행돼도 claim 이 한 번만 성공하므로 안전하다.
        val STALE_PENDING_AGE: Duration = Duration.ofMinutes(5)
    }
}
