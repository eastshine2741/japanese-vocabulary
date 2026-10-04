package com.japanese.vocabulary.songanalysis.dto

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import java.time.Instant

/** 한 단계 실행의 이름표. [attempt] 가 펜스라서 원장에 쓰는 모든 호출이 이걸 들고 간다. */
data class SongAnalysisStageRef(
    val workId: Long,
    val stage: SongAnalysisWorkStage,
    val attempt: Int,
)

/** 큐에 다시 넣을 대상. */
data class SongAnalysisStageTarget(
    val workId: Long,
    val stage: SongAnalysisWorkStage,
)

/**
 * 잡은 단계. [previousOutput] 은 같은 단계의 이전 시도가 남긴 산출물 일부로, 가사 분석 단계가
 * 끝난 갈래를 다시 하지 않는 데 쓴다.
 */
data class ClaimedSongAnalysisStage(
    val ref: SongAnalysisStageRef,
    val work: SongAnalysisWorkSnapshot,
    val startedAt: Instant,
    val previousOutput: String?,
)

/** 단계 실행에 필요한 작업 행의 값. 잠금 밖에서 읽히므로 엔티티 대신 값으로 넘긴다. */
data class SongAnalysisWorkSnapshot(
    val workId: Long,
    val rawTitle: String,
    val rawArtist: String,
    val durationSeconds: Int?,
    val artworkUrl: String?,
    val triggerSource: SongAnalysisTriggerSource,
    val songId: Long?,
    val lyricId: Long?,
    val youtubeUrl: String?,
)

fun SongAnalysisWorkEntity.toSnapshot() = SongAnalysisWorkSnapshot(
    workId = requireNotNull(id),
    rawTitle = rawTitle,
    rawArtist = rawArtist,
    durationSeconds = durationSeconds,
    artworkUrl = artworkUrl,
    triggerSource = triggerSource,
    songId = songId,
    lyricId = lyricId,
    youtubeUrl = youtubeUrl,
)
