package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisProgress
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.within
import org.junit.jupiter.api.Test
import java.time.Instant

class SongAnalysisProgressTest {

    private val now = Instant.parse("2026-10-24T00:00:00Z")
    private val running = SongAnalysisWorkStatus.RUNNING

    private fun progress(stage: SongAnalysisWorkStage?, secondsIn: Long? = null, status: SongAnalysisWorkStatus = running) =
        SongAnalysisProgress.of(status, stage, secondsIn?.let { now.minusSeconds(it) }, now)

    @Test
    fun `pending work and completed work sit at the ends`() {
        assertThat(progress(SongAnalysisWorkStage.FETCH_LYRICS, status = SongAnalysisWorkStatus.PENDING)).isEqualTo(0.0)
        assertThat(progress(SongAnalysisWorkStage.COMPLETE, status = SongAnalysisWorkStatus.COMPLETED)).isEqualTo(1.0)
    }

    @Test
    fun `progress grows with stage order and time inside a stage`() {
        val waitingForAnalyze = progress(SongAnalysisWorkStage.ANALYZE_LYRICS)
        val tenSecondsIn = progress(SongAnalysisWorkStage.ANALYZE_LYRICS, secondsIn = 10)
        val waitingForSelect = progress(SongAnalysisWorkStage.SELECT_SENSES)

        assertThat(waitingForAnalyze).isGreaterThan(progress(SongAnalysisWorkStage.FETCH_YOUTUBE))
        assertThat(tenSecondsIn).isGreaterThan(waitingForAnalyze)
        assertThat(waitingForSelect).isGreaterThan(tenSecondsIn)
    }

    @Test
    fun `a slow stage stops short of the next stage's share`() {
        val stuck = progress(SongAnalysisWorkStage.ANALYZE_LYRICS, secondsIn = 600)
        val next = progress(SongAnalysisWorkStage.SELECT_SENSES)

        assertThat(stuck).isLessThan(next)
        assertThat(progress(SongAnalysisWorkStage.ANALYZE_LYRICS, secondsIn = 6000)).isCloseTo(stuck, within(1e-9))
    }

    @Test
    fun `the last stage never reports done before the work completes`() {
        assertThat(progress(SongAnalysisWorkStage.COMPLETE, secondsIn = 60)).isLessThan(1.0)
    }
}
