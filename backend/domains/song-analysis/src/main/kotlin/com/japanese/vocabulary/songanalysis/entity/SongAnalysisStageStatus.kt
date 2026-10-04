package com.japanese.vocabulary.songanalysis.entity

enum class SongAnalysisStageStatus {
    /** 관리자가 다시 돌리라고 되돌린 상태. 메시지가 잡으면 RUNNING 이 된다. */
    PENDING,
    RUNNING,
    COMPLETED,
    FAILED,
}
