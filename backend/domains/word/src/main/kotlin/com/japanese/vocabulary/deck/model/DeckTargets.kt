package com.japanese.vocabulary.deck.model

/**
 * 저장 트랜잭션에 들어가기 전에 미리 확보해 둔 단어장 id 들. 단어장 행 생성은 단어보다 오래 사는
 * 상태라 저장 트랜잭션 밖에서 끝내도 되고, 그렇게 해야 요청당 한 번만 하게 된다.
 */
class DeckTargets(
    private val defaultDeckId: Long,
    private val songDeckIds: Map<Long, Long>,
) {
    /** 이 단어가 들어갈 단어장들. 전체 단어장은 항상 포함된다. */
    fun idsFor(songId: Long?): List<Long> = listOfNotNull(
        defaultDeckId,
        songId?.let { requireNotNull(songDeckIds[it]) { "deck for song $it was not resolved" } },
    )
}
