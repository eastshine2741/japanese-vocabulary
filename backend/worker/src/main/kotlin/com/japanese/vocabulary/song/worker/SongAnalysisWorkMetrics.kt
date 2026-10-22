package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import io.micrometer.core.instrument.DistributionSummary
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant

/** 작업 한 실행이 끝났을 때의 지표. 리스너(성공·실패)와 sweeper(시간 초과)가 같은 태그 집합으로 남긴다. */
@Component
class SongAnalysisWorkMetrics(
    private val meterRegistry: MeterRegistry,
) {
    /** 요청부터가 아니라 이번 실행이 시작된 뒤부터다. 관리자가 이어 돌린 작업도 그 실행만 잰다. */
    fun recordFinished(
        outcome: String,
        failedStage: SongAnalysisWorkStage?,
        errorCode: String?,
        triggerSource: SongAnalysisTriggerSource,
        startedAt: Instant,
        llmCostUsd: Double,
    ) {
        Timer.builder(MetricNames.SONG_ANALYSIS_WORK_DURATION)
            .tag("outcome", outcome)
            .tag("failed_stage", failedStage?.name ?: "none")
            .tag("error_code", errorCode ?: "none")
            .tag("trigger_source", triggerSource.name)
            .publishPercentileHistogram()
            .maximumExpectedValue(HISTOGRAM_MAX)
            .register(meterRegistry)
            .record(Duration.between(startedAt, Instant.now()))
        DistributionSummary.builder(MetricNames.SONG_ANALYSIS_WORK_COST)
            .tag("outcome", outcome)
            .tag("trigger_source", triggerSource.name)
            // 기본 히스토그램 버킷은 1 부터라 1달러 아래인 곡 비용이 한 버킷에 몰린다.
            .serviceLevelObjectives(*COST_BUCKETS_USD)
            .register(meterRegistry)
            .record(llmCostUsd)
    }

    companion object {
        // 타이머 버킷 기본 상한이 30초라, 시간 초과 판정(10분)까지 연다.
        val HISTOGRAM_MAX: Duration = Duration.ofMinutes(10)

        private val COST_BUCKETS_USD = doubleArrayOf(0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5)
    }
}
