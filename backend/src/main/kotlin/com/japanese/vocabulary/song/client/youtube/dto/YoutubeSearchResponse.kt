package com.japanese.vocabulary.song.client.youtube.dto

data class YoutubeSearchResponse(
    val nextPageToken: String?,
    val items: List<YoutubeSearchItem>
)
