package com.japanese.vocabulary.rewardcard.dto

data class RewardCardWordResponse(
    val japanese: String,
    /** 가타카나 그대로. */
    val reading: String,
    val meaning: String,
)
