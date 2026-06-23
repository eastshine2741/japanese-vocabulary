package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.song.service.SongAnalysisWorkService
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.net.InetAddress
import java.time.Duration
import java.time.Instant

@Component
class SongAnalysisWorkScheduler(
    private val workService: SongAnalysisWorkService,
    private val processor: SongAnalysisWorkProcessor,
    private val meterRegistry: MeterRegistry,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkScheduler::class.java)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val workerId = "${InetAddress.getLocalHost().hostName}-${ProcessHandle.current().pid()}"

    @Scheduled(fixedRate = 30_000)
    fun run() {
        logger.info("Polling for song analysis work...")
        val batch = try {
            val expired = workService.failExpiredRunning(EXPIRED_BATCH_SIZE)
            if (expired > 0) {
                logger.warn("Marked {} expired song analysis work rows as FAILED", expired)
            }
            workService.claimPending(
                limit = BATCH_SIZE,
                workerId = workerId,
                lockUntil = Instant.now().plus(LOCK_DURATION),
            )
        } catch (e: Exception) {
            logger.error("Song analysis work claim failed", e)
            return
        }

        if (batch.isEmpty()) {
            logger.info("No pending song analysis work found")
            return
        }

        logger.info("Found {} song analysis work rows, dispatching to IO", batch.size)
        scope.launch {
            val results = batch.map { work ->
                async { processOne(work) }
            }.awaitAll()
            val succeeded = results.count { it }
            val failed = results.size - succeeded
            logger.info(
                "Song analysis batch complete: {} succeeded, {} failed out of {} total",
                succeeded, failed, results.size,
            )
        }
    }

    private suspend fun processOne(work: com.japanese.vocabulary.song.entity.SongAnalysisWorkEntity): Boolean {
        val sample = Timer.start(meterRegistry)
        var outcome = "success"
        return try {
            processor.process(work).also { if (!it) outcome = "failed" }
        } catch (e: Exception) {
            outcome = "failed"
            logger.error("[workId={}] Song analysis processor crashed", work.id, e)
            false
        }.also {
            sample.stop(
                Timer.builder(MetricNames.SONG_ANALYSIS_WORK_DURATION)
                    .tag("outcome", outcome)
                    .publishPercentileHistogram()
                    .register(meterRegistry),
            )
        }
    }

    private companion object {
        const val BATCH_SIZE = 5
        const val EXPIRED_BATCH_SIZE = 20
        val LOCK_DURATION: Duration = Duration.ofMinutes(30)
    }
}
