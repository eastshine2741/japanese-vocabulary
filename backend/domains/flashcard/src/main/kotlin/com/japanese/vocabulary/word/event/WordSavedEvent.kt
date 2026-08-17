package com.japanese.vocabulary.word.event

/**
 * 단어가 저장(신규 또는 sense 추가)될 때 발행된다. deck 계층이 전체 단어장과
 * (곡에서 담은 경우) 곡 단어장에 연결하기 위해 구독한다.
 */
data class WordSavedEvent(
    val userId: Long,
    val wordId: Long,
    val songId: Long?,
)
