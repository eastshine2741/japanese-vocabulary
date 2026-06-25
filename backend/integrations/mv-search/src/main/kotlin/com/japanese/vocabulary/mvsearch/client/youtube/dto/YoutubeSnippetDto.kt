package com.japanese.vocabulary.mvsearch.client.youtube.dto

data class YoutubeSnippetDto(
    val title: String,
    val thumbnails: YoutubeThumbnailsDto,
    val channelTitle: String,
    val channelId: String? = null
)
