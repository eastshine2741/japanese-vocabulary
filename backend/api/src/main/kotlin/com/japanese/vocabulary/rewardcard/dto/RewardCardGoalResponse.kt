package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.SongCardGrade

data class RewardCardGoalResponse(
    val grade: SongCardGrade,
    val current: Int,
    val total: Int,
)
