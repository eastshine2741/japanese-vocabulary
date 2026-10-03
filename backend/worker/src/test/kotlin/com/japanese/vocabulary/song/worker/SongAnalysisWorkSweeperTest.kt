package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.messagequeue.SongAnalysisWorkQueuePublisher
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageTarget
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Test

/**
 * 큐 유실의 유일한 복구 경로. 여기가 멈추면 메시지를 잃은 작업이 영원히 멈춰 있는다.
 */
class SongAnalysisWorkSweeperTest {

    private val workService: SongAnalysisWorkService = mockk()
    private val publisher: SongAnalysisWorkQueuePublisher = mockk(relaxed = true)
    private val sweeper = SongAnalysisWorkSweeper(workService, publisher)

    @Test
    fun `republishes the stage each work is waiting for`() {
        every { workService.failStaleRunning(any(), any()) } returns 0
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
        every { workService.failStaleRunning(any(), any()) } returns 2
        every { workService.findLostMessages(any(), any()) } throws IllegalStateException("db down")

        sweeper.sweep()

        verify(exactly = 1) { workService.failStaleRunning(any(), any()) }
    }

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
