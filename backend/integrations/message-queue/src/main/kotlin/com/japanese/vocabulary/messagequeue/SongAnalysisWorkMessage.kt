package com.japanese.vocabulary.messagequeue

/**
 * 메시지는 원장 행의 id 만 싣는다. 처리에 필요한 나머지는 worker 가 DB 에서 읽으므로
 * 메시지가 중복·지연 배달돼도 원장 상태가 판단 기준이 된다.
 */
data class SongAnalysisWorkMessage(val workId: Long)
