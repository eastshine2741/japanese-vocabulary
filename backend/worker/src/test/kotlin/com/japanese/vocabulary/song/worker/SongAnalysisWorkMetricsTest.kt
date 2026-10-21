package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant

class SongAnalysisWorkMetricsTest {

    private val meterRegistry = SimpleMeterRegistry()
    private val metrics = SongAnalysisWorkMetrics(meterRegistry)

    /** 성공도 실패와 같은 태그 키를 가져야 Prometheus 에서 한 시계열 묶음으로 읽힌다. */
    @Test
    fun `a successful work carries none for its failure tags`() {
        metrics.recordFinished("success", null, null, SongAnalysisTriggerSource.ADMIN, Instant.now(), llmCostUsd = 0.004)

        val timer = meterRegistry.get(MetricNames.SONG_ANALYSIS_WORK_DURATION)
            .tag("outcome", "success")
            .tag("failed_stage", "none")
            .tag("error_code", "none")
            .tag("trigger_source", "ADMIN")
            .timer()
        assertThat(timer.count()).isEqualTo(1)
        val cost = meterRegistry.get(MetricNames.SONG_ANALYSIS_WORK_COST).tag("outcome", "success").summary()
        assertThat(cost.totalAmount()).isEqualTo(0.004)
        // 곡 비용은 1달러 아래라, 그 구간에 버킷이 있어야 백분위가 의미 있다.
        assertThat(cost.takeSnapshot().histogramCounts().map { it.bucket() }).contains(0.005)
    }
}
