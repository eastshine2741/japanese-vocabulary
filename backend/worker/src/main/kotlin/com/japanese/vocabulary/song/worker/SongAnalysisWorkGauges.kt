package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.binder.MeterBinder
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/**
 * 대기 중·실행 중인 작업 수와 가장 오래 기다린 PENDING 작업의 대기 시간(없으면 0). 값은 30초마다 원장에서 센다 — status 로 시작하는 V33 인덱스를 탄다.
 * 끝난 상태(COMPLETED/FAILED)는 늘기만 하는 누적값이라 세지 않는다. 실패는 단계 타이머의 outcome 으로 본다.
 * worker 가 여러 개면 모두 같은 값을 내므로 대시보드는 max 로 읽는다.
 */
@Component
class SongAnalysisWorkGauges(
    private val workService: SongAnalysisWorkService,
    private val clock: Clock,
) : MeterBinder {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkGauges::class.java)
    private val counts = STATUSES.associateWith { AtomicLong() }
    private val oldestPendingSince = AtomicReference<Instant?>()

    override fun bindTo(registry: MeterRegistry) {
        for ((status, count) in counts) {
            Gauge.builder(MetricNames.SONG_ANALYSIS_WORKS) { count.get().toDouble() }
                .tag("status", status.name)
                .register(registry)
        }
        // updated_at 은 JPA auditing 이 Clock 으로 찍으므로 같은 Clock 으로 잰다. 시각만 캐시해 나이는 스크레이프 시점 기준이다.
        Gauge.builder(MetricNames.SONG_ANALYSIS_OLDEST_PENDING_AGE) {
            val since = oldestPendingSince.get() ?: return@builder 0.0
            Duration.between(since, Instant.now(clock)).toMillis().coerceAtLeast(0) / 1000.0
        }
            .baseUnit("seconds")
            .register(registry)
    }

    // 스크레이프 스레드에서 DB 를 치면 DB 가 느릴 때 /actuator/prometheus 전체가 늦어진다.
    @Scheduled(fixedDelay = REFRESH_INTERVAL_MS)
    fun refresh() {
        try {
            counts.forEach { (status, count) -> count.set(workService.countByStatus(status)) }
            oldestPendingSince.set(workService.oldestPendingSince())
        } catch (e: Exception) {
            logger.warn("Failed to refresh song analysis work gauges; keeping the last values", e)
        }
    }

    private companion object {
        val STATUSES = listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING)
        const val REFRESH_INTERVAL_MS = 30_000L
    }
}
