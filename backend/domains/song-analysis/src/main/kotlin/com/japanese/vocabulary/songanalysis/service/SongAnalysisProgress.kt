package com.japanese.vocabulary.songanalysis.service

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import java.time.Duration
import java.time.Instant

/** 분석 pill 이 채우는 진행도(0..1). 단계 순서와 단계별 평균 소요 시간으로 계산한다. */
object SongAnalysisProgress {

    // prod 완료 작업 212건(2026-10)의 단계별 평균 초. ANALYZE_LYRICS 가 2/3 라 단계 수로 나누면 막대가 한참 멈춘다.
    private val EXPECTED_SECONDS = mapOf(
        SongAnalysisWorkStage.FETCH_LYRICS to 4.4,
        SongAnalysisWorkStage.FETCH_YOUTUBE to 0.9,
        SongAnalysisWorkStage.CREATE_SONG_AND_LYRIC to 0.0,
        SongAnalysisWorkStage.ANALYZE_LYRICS to 41.9,
        SongAnalysisWorkStage.SELECT_SENSES to 9.8,
        SongAnalysisWorkStage.TRANSLATE_SENSES to 4.5,
        SongAnalysisWorkStage.COMPLETE to 0.2,
    )
    private val TOTAL_SECONDS = EXPECTED_SECONDS.values.sum()

    // 평균보다 오래 걸리는 단계에서 막대가 다음 단계 몫까지 넘어가지 않게 멈추는 지점.
    private const val IN_STAGE_CAP = 0.9

    fun of(
        status: SongAnalysisWorkStatus,
        currentStage: SongAnalysisWorkStage?,
        stageStartedAt: Instant?,
        now: Instant,
    ): Double {
        if (status == SongAnalysisWorkStatus.COMPLETED) return 1.0
        if (currentStage == null) return 0.0
        val before = SongAnalysisWorkStage.entries.takeWhile { it != currentStage }.sumOf { EXPECTED_SECONDS.getValue(it) }
        val expected = EXPECTED_SECONDS.getValue(currentStage)
        val inStage = if (stageStartedAt == null || expected == 0.0) {
            0.0
        } else {
            val elapsed = Duration.between(stageStartedAt, now).toMillis() / 1000.0
            (elapsed / expected).coerceIn(0.0, IN_STAGE_CAP)
        }
        return (before + expected * inStage) / TOTAL_SECONDS
    }
}
