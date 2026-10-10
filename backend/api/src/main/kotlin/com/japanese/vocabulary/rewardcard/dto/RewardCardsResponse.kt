package com.japanese.vocabulary.rewardcard.dto

data class RewardCardsResponse(
    /** 최근 획득순. */
    val songCards: List<SongCardResponse>,
    val artistCards: List<ArtistCardResponse>,
)
