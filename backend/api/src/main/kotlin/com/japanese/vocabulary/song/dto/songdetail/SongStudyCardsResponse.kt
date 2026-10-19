package com.japanese.vocabulary.song.dto.songdetail

data class SongStudyCardsResponse(
    /** 아직 이 곡을 담은 적이 없으면 null — 첫 rating 이 곡 단어장을 만든다. */
    val deckId: Long?,
    val cards: List<SongStudyCardDto>,
    val totalCount: Int,
)
