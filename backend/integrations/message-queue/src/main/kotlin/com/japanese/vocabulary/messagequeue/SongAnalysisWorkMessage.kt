package com.japanese.vocabulary.messagequeue

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage

/**
 * 메시지는 원장 행의 id 와 실행할 단계만 싣는다. 처리에 필요한 나머지는 worker 가 DB 에서 읽으므로
 * 메시지가 중복·지연 배달돼도 원장 상태가 판단 기준이 된다.
 *
 * [stage] 가 없는 메시지는 단계가 생기기 전의 발행자가 보낸 것이고 첫 단계로 읽는다.
 */
data class SongAnalysisWorkMessage(
    val workId: Long,
    val stage: SongAnalysisWorkStage? = null,
)
