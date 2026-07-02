package com.japanese.vocabulary.mvsearch.client.youtube.dto

data class YoutubePlaylistItemsResponse(
    val nextPageToken: String?,
    val items: List<YoutubePlaylistItemDto>
)
