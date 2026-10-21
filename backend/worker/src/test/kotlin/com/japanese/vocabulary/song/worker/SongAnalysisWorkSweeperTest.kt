package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.messagequeue.SongAnalysisWorkQueuePublisher
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageTarget
import com.japanese.vocabulary.songanalysis.dto.TimedOutSongAnalysisWork
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.concurrent.TimeUnit

/**
 * 큐 유실의 유일한 복구 경로. 여기가 멈추면 메시지를 잃은 작업이 영원히 멈춰 있는다.
 */
class SongAnalysisWorkSweeperTest {

    private val workService: SongAnalysisWorkService = mockk()
    private val publisher: SongAnalysisWorkQueuePublisher = mockk(relaxed = true)
    private val meterRegistry = SimpleMeterRegistry()
    private val sweeper = SongAnalysisWorkSweeper(workService, publisher, SongAnalysisWorkMetrics(meterRegistry))

    @Test
    fun `republishes the stage each work is waiting for`() {
        every { workService.failStaleRunning(any(), any()) } returns emptyList()
        every { workService.findLostMessages(any(), any()) } returns listOf(
            SongAnalysisStageTarget(7L, SongAnalysisWorkStage.FETCH_LYRICS),
            SongAnalysisStageTarget(9L, SongAnalysisWorkStage.SELECT_SENSES),
        )

        sweeper.sweep()

        verify(exactly = 1) { publisher.publish(7L, SongAnalysisWorkStage.FETCH_LYRICS) }
        verify(exactly = 1) { publisher.publish(9L, SongAnalysisWorkStage.SELECT_SENSES) }
    }

    @Test
    fun `expired running rows are still swept when requeue fails`() {
        every { workService.failStaleRunning(any(), any()) } returns listOf(timedOut(1L), timedOut(2L))
        every { workService.findLostMessages(any(), any()) } throws IllegalStateException("db down")

        sweeper.sweep()

        verify(exactly = 1) { workService.failStaleRunning(any(), any()) }
    }

    /** 시간 초과는 리스너가 끝내지 못한 작업이라, sweeper 가 남기지 않으면 작업 지표에서 빠진다. */
    @Test
    fun `a timed out work is recorded with the stage it stalled in`() {
        every { workService.failStaleRunning(any(), any()) } returns listOf(timedOut(1L))
        every { workService.findLostMessages(any(), any()) } returns emptyList()

        sweeper.sweep()

        val timer = meterRegistry.get(MetricNames.SONG_ANALYSIS_WORK_DURATION)
            .tag("outcome", "timeout")
            .tag("failed_stage", "ANALYZE_LYRICS")
            .tag("error_code", "SONG_ANALYSIS_WORK_TIMEOUT")
            .tag("trigger_source", "KARAOKE")
            .timer()
        assertThat(timer.count()).isEqualTo(1)
        assertThat(timer.totalTime(TimeUnit.MINUTES)).isGreaterThanOrEqualTo(12.0)
        val cost = meterRegistry.get(MetricNames.SONG_ANALYSIS_WORK_COST)
            .tag("outcome", "timeout")
            .tag("trigger_source", "KARAOKE")
            .summary()
        assertThat(cost.totalAmount()).isEqualTo(0.03)
    }

    private fun timedOut(workId: Long) = TimedOutSongAnalysisWork(
        workId = workId,
        stage = SongAnalysisWorkStage.ANALYZE_LYRICS,
        triggerSource = SongAnalysisTriggerSource.KARAOKE,
        startedAt = Instant.now().minus(Duration.ofMinutes(12)),
        llmCostUsd = 0.03,
    )

    /** 만료 정리가 터져도 유실 복구는 계속 돌아야 한다. 둘은 독립된 안전망이다. */
    @Test
    fun `requeue still runs when expiring stale rows fails`() {
        every { workService.failStaleRunning(any(), any()) } throws IllegalStateException("db down")
        every { workService.findLostMessages(any(), any()) } returns listOf(
            SongAnalysisStageTarget(3L, SongAnalysisWorkStage.ANALYZE_LYRICS),
        )

        sweeper.sweep()

        verify(exactly = 1) { publisher.publish(3L, SongAnalysisWorkStage.ANALYZE_LYRICS) }
    }
}
