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
 * (브로커 재시작, 커밋과 발행 사이의 크래시, 발행 실패) 행은 멈춘 채 남는다. 여기서 주워 기다리는
 * 단계를 다시 발행하고, 진행이 멈춘 RUNNING 행은 FAILED 로 넘긴다.
 *
 * worker 가 죽은 경우는 브로커가 메시지를 다시 배달해 다른 worker 가 넘겨받으므로 여기 오지 않는다.
 * 테스트에서는 `song-analysis.worker.sweep-enabled=false` 로 끈다.
 */
@Component
@ConditionalOnProperty(name = ["song-analysis.worker.sweep-enabled"], havingValue = "true", matchIfMissing = true)
class SongAnalysisWorkSweeper(
    private val workService: SongAnalysisWorkService,
    private val publisher: SongAnalysisWorkQueuePublisher,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkSweeper::class.java)

    @Scheduled(fixedDelayString = "\${song-analysis.worker.sweep-interval-ms:60000}")
    fun sweep() {
        try {
            val expired = workService.failStaleRunning(
                olderThan = Instant.now().minus(STALE_RUNNING_AGE),
                limit = BATCH_SIZE,
            )
            if (expired > 0) {
                logger.warn("Marked {} stale song analysis work rows as FAILED", expired)
            }
        } catch (e: Exception) {
            logger.error("Failed to sweep expired song analysis work", e)
        }

        try {
            val lost = workService.findLostMessages(
                olderThan = Instant.now().minus(LOST_MESSAGE_AGE),
                limit = BATCH_SIZE,
            )
            if (lost.isNotEmpty()) {
                logger.warn("Requeueing {} song analysis stages whose message was lost: {}", lost.size, lost)
                lost.forEach { publisher.publish(it.workId, it.stage) }
            }
        } catch (e: Exception) {
            logger.error("Failed to requeue song analysis work with lost messages", e)
        }
    }

    private companion object {
        const val BATCH_SIZE = 20

        // updatedAt 이 이만큼 멈춰 있으면 worker 가 죽고 재배달도 못 받았다고 본다. 단계 전이와
        // 가사 분석의 갈래 완료마다 갱신된다. 가장 긴 무소식 구간은 한 갈래 안의 Gemini 호출들인데,
        // 재시도는 시간 예산(5분)을 넘겨 기다리지 않으므로 예산과 호출 타임아웃 하나를 더한 정도다.
        val STALE_RUNNING_AGE: Duration = Duration.ofMinutes(10)

        // 이만큼 멈춘 PENDING 이나 다음 단계가 돌지 않는 RUNNING 은 메시지가 없다고 본다. 큐에서 기다리는
        // 메시지는 updated_at 을 움직이지 않으므로, consumer 가 모두 바쁠 때 멀쩡한 메시지까지 다시
        // 발행된다(claim 이 하나만 잡으므로 안전하지만 큐가 불어난다). 가사 분석 단계가 1분을 넘기는 일이
        // 흔해서, 그보다 넉넉히 잡는다.
        val LOST_MESSAGE_AGE: Duration = Duration.ofMinutes(3)
    }
}
