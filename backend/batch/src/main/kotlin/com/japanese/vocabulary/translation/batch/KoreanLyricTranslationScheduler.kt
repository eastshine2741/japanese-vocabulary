package com.japanese.vocabulary.translation.batch

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.translation.service.KoreanLyricTranslationService
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
import org.springframework.transaction.support.TransactionTemplate

/**
 * Owns the lyric translation batch flow: polling cadence, batch sizing, atomic claim, coroutine
 * dispatch, and retry policy. Per-entry domain operations (find/markProcessing/runPipeline/
 * markCompleted/recordRetryAttempt/markFailed) are delegated to [KoreanLyricTranslationService].
 *
 * Lives in the batch module so the @Scheduled trigger never fires in the api JVM.
 */
@Component
class KoreanLyricTranslationScheduler(
    private val service: KoreanLyricTranslationService,
    private val transactionTemplate: TransactionTemplate,
    private val meterRegistry: MeterRegistry,
) {
    private val logger = LoggerFactory.getLogger(KoreanLyricTranslationScheduler::class.java)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @Scheduled(fixedRate = 30_000)
    fun run() {
        logger.info("Polling for next translation batch...")
        val batch = try {
            claim()
        } catch (e: Exception) {
            logger.error("KoreanLyricTranslation claim failed", e)
            return
        }
        if (batch.isEmpty()) {
            logger.info("No pending translations found")
            return
        }
        logger.info("Found {} songs to translate, dispatching to IO", batch.size)
        scope.launch {
            val results = batch.map { entity ->
                async { processOne(entity) }
            }.awaitAll()
            val succeeded = results.count { it }
            val failed = results.size - succeeded
            logger.info(
                "Batch complete: {} succeeded, {} failed out of {} total",
                succeeded, failed, results.size,
            )
        }
    }

    /**
     * Atomic check-out of up to [BATCH_SIZE] pending entries. Wrapped in a single transaction so
     * concurrent schedulers cannot claim the same row.
     */
    fun claim(): List<LyricEntity> = transactionTemplate.execute {
        val pending = service.findPendingLyrics(BATCH_SIZE)
        if (pending.isNotEmpty()) service.markProcessing(pending)
        pending
    } ?: emptyList()

    suspend fun processOne(entity: LyricEntity): Boolean {
        val sample = Timer.start(meterRegistry)
        var outcome = "success"
        return try {
            val lines = service.runPipeline(entity)
            service.markCompleted(entity, lines)
            true
        } catch (e: Exception) {
            val attempts = service.recordRetryAttempt(entity)
            if (attempts >= MAX_RETRIES) {
                outcome = "failed"
                service.markFailed(entity)
                logger.error(
                    "[songId={}] Translation failed permanently (attempt {}/{}): {}",
                    entity.songId, attempts, MAX_RETRIES, e.message, e,
                )
            } else {
                outcome = "retry"
                logger.error(
                    "[songId={}] Translation failed (attempt {}/{}), will retry: {}",
                    entity.songId, attempts, MAX_RETRIES, e.message, e,
                )
            }
            false
        }.also {
            sample.stop(
                Timer.builder(MetricNames.LYRIC_TRANSLATION_DURATION)
                    .tag("outcome", outcome)
                    .publishPercentileHistogram()
                    .register(meterRegistry),
            )
        }
    }

    private companion object {
        const val MAX_RETRIES = 3
        const val BATCH_SIZE = 5
    }
}
