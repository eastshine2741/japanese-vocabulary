package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.messagequeue.SongAnalysisQueue
import com.japanese.vocabulary.messagequeue.SongAnalysisWorkMessage
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Component
import java.net.InetAddress
import java.time.Duration
import java.time.Instant

/**
 * 곡 분석 작업 하나를 처리한다. 메시지는 workId 만 싣고, 처리 여부는 원장 행이 정한다.
 *
 * - 같은 메시지가 두 번 와도 [SongAnalysisWorkService.claim] 이 PENDING 인 행만 잡으므로 한 번만 처리된다.
 * - 파이프라인 실패는 [SongAnalysisWorkProcessor] 가 원장에 FAILED 로 적고 메시지는 ack 한다.
 * - 예외를 던지는 경우는 DB 접근 불가 같은 인프라 장애뿐이고, 그때만 DLQ 로 간다.
 * - 리스너 스레드를 블로킹해야 ack 가 처리 완료 뒤에 나간다. 동시 처리량은 concurrency 로 조절한다.
 */
@Component
class SongAnalysisWorkListener(
    private val workService: SongAnalysisWorkService,
    private val processor: SongAnalysisWorkProcessor,
    private val meterRegistry: MeterRegistry,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkListener::class.java)
    private val workerId = "${InetAddress.getLocalHost().hostName}-${ProcessHandle.current().pid()}"

    @RabbitListener(
        queues = [SongAnalysisQueue.QUEUE],
        concurrency = "\${song-analysis.worker.concurrency:3}",
    )
    fun onMessage(message: SongAnalysisWorkMessage) {
        val work = workService.claim(
            workId = message.workId,
            workerId = workerId,
            lockUntil = Instant.now().plus(LOCK_DURATION),
        )
        if (work == null) {
            logger.info("Song analysis work workId={} is not claimable, skipping", message.workId)
            return
        }
        process(work)
    }

    private fun process(work: SongAnalysisWorkEntity) {
        val sample = Timer.start(meterRegistry)
        var outcome = "success"
        try {
            if (!runBlocking { processor.process(work) }) outcome = "failed"
        } catch (e: Exception) {
            outcome = "failed"
            logger.error("[workId={}] Song analysis processor crashed", work.id, e)
        } finally {
            sample.stop(
                Timer.builder(MetricNames.SONG_ANALYSIS_WORK_DURATION)
                    .tag("outcome", outcome)
                    .publishPercentileHistogram()
                    .register(meterRegistry),
            )
        }
    }

    private companion object {
        val LOCK_DURATION: Duration = Duration.ofMinutes(30)
    }
}
