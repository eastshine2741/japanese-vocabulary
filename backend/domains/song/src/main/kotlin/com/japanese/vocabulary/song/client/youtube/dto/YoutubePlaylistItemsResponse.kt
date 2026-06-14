package com.japanese.vocabulary.song.client.youtube.dto

data class YoutubePlaylistItemsResponse(
    val nextPageToken: String?,
    val items: List<YoutubePlaylistItemDto>
)
