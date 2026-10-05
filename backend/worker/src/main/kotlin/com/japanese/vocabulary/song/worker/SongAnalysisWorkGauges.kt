package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.binder.MeterBinder
import org.springframework.stereotype.Component

/**
 * 대기 중·실행 중인 작업 수. 값은 스크레이프마다 원장에서 센다 — status 로 시작하는 V33 인덱스를 탄다.
 * 끝난 상태(COMPLETED/FAILED)는 늘기만 하는 누적값이라 세지 않는다. 실패는 단계 타이머의 outcome 으로 본다.
 * worker 가 여러 개면 모두 같은 값을 내므로 대시보드는 max 로 읽는다.
 */
@Component
class SongAnalysisWorkGauges(
    private val workService: SongAnalysisWorkService,
) : MeterBinder {
    override fun bindTo(registry: MeterRegistry) {
        for (status in listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING)) {
            Gauge.builder(MetricNames.SONG_ANALYSIS_WORKS) { workService.countByStatus(status).toDouble() }
                .tag("status", status.name)
                .register(registry)
        }
    }
}
