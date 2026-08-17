package com.japanese.vocabulary.word.event

/**
 * 단어 삭제 직전에 발행된다. deck_word 는 words 에 FK 를 갖고 있어 publisher 커밋 전에
 * 정리되어야 하므로, 구독자는 AFTER_COMMIT 이 아니라 같은 트랜잭션에서 처리한다.
 */
data class WordDeletedEvent(
    val wordId: Long,
)
