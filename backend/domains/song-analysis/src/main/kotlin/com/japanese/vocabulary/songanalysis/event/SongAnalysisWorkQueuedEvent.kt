package com.japanese.vocabulary.songanalysis.event

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage

/**
 * 작업의 [stage] 를 실행할 차례가 됐을 때 발행된다 — 새 작업이 만들어졌을 때, 앞 단계가 끝났을 때,
 * 관리자가 실패한 단계부터 다시 돌릴 때. 메시지 큐 어댑터가 AFTER_COMMIT 에 받아서 worker 를
 * 깨운다. 원장 행이 진실 원천이므로 이 이벤트는 "깨우기 신호"일 뿐이고, 유실되면 worker 의
 * sweeper 가 주워서 다시 발행한다.
 */
data class SongAnalysisWorkQueuedEvent(
    val workId: Long,
    val stage: SongAnalysisWorkStage = SongAnalysisWorkStage.FIRST,
)
