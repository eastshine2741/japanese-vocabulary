package com.japanese.vocabulary.song.client.youtube.dto

// searchMvUrl 전용 — part=id 응답 전용 (snippet 없음)
data class YoutubeMvSearchResponse(
    val items: List<YoutubeMvSearchItem>?
)
