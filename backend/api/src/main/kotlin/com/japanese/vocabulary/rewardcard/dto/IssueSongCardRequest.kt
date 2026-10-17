package com.japanese.vocabulary.rewardcard.dto

data class IssueSongCardRequest(
    val signature: List<String>,
    /** 비우면 기본 줄로 받는다(`이대로 받기`). */
    val lyricLineIndexes: List<Int> = emptyList(),
)
