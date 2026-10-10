package com.japanese.vocabulary.rewardcard.dto

/** 연출로 보여 준 등급. 그 사이 또 올랐으면 남은 오름은 다음에 다시 뜬다. */
data class MarkRewardCardSeenRequest(
    val grade: String,
)
