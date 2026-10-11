package com.japanese.vocabulary.rewardcard.dto

/** 채우기가 새로 만든 카드. 이미 있던 카드는 false. */
data class BackfilledCardsDto(
    val song: Boolean,
    val artist: Boolean,
)
