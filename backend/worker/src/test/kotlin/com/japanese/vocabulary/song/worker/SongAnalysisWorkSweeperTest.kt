package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.messagequeue.SongAnalysisWorkQueuePublisher
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Test

/**
 * 큐 유실의 유일한 복구 경로. 여기가 멈추면 PENDING 행이 영원히 남는다.
 */
class SongAnalysisWorkSweeperTest {

    private val workService: SongAnalysisWorkService = mockk()
    private val publisher: SongAnalysisWorkQueuePublisher = mockk(relaxed = true)
    private val sweeper = SongAnalysisWorkSweeper(workService, publisher)

    @Test
    fun `republishes pending work whose message was lost`() {
        every { workService.failStaleRunning(any(), any()) } returns 0
        every { workService.findStalePendingIds(any(), any()) } returns listOf(7L, 9L)

        sweeper.sweep()

        verify(exactly = 1) { publisher.publish(7L) }
        verify(exactly = 1) { publisher.publish(9L) }
    }

    @Test
    fun `expired running rows are still swept when requeue fails`() {
        every { workService.failStaleRunning(any(), any()) } returns 2
        every { workService.findStalePendingIds(any(), any()) } throws IllegalStateException("db down")

        sweeper.sweep()

        verify(exactly = 1) { workService.failStaleRunning(any(), any()) }
    }

    /** 만료 정리가 터져도 유실 복구는 계속 돌아야 한다. 둘은 독립된 안전망이다. */
    @Test
    fun `requeue still runs when expiry sweep fails`() {
        every { workService.failStaleRunning(any(), any()) } throws IllegalStateException("db down")
        every { workService.findStalePendingIds(any(), any()) } returns listOf(3L)

        sweeper.sweep()

        verify(exactly = 1) { publisher.publish(3L) }
    }
}
