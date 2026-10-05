package com.japanese.vocabulary.messagequeue

/**
 * 곡 분석 작업 큐의 이름들. 브로커 토폴로지는 [com.japanese.autoconfigure.messagequeue.MessageQueueAutoConfiguration]
 * 이 선언하고, publisher/consumer 가 같은 상수를 본다.
 */
object SongAnalysisQueue {
    const val EXCHANGE = "kotonoha.song-analysis"
    const val ROUTING_KEY = "song-analysis.work"
    const val QUEUE = "song-analysis.work"

    const val DEAD_LETTER_EXCHANGE = "kotonoha.song-analysis.dlx"
    const val DEAD_LETTER_QUEUE = "song-analysis.work.dlq"
}
