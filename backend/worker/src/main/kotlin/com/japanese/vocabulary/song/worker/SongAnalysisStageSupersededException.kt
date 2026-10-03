package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageRef

/**
 * 원장 쓰기가 펜스에 걸렸다: 이 단계는 다른 worker 가 넘겨받았거나 sweeper 가 이미 포기 처리했다.
 * 실패가 아니므로 기록하지 않는다. 트랜잭션 안에서 던지면 그 안의 쓰기도 함께 롤백된다.
 */
class SongAnalysisStageSupersededException(val ref: SongAnalysisStageRef) :
    RuntimeException("Stage ${ref.stage} attempt ${ref.attempt} of work ${ref.workId} is no longer current")
