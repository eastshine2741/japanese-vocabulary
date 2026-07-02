package com.japanese.vocabulary.mvsearch.client.youtube.dto

data class YoutubeSearchResponse(
    val nextPageToken: String?,
    val items: List<YoutubeSearchItemDto>
)
