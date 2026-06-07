package com.japanese.vocabulary.song.client.youtube.dto

data class YoutubeSnippetDto(
    val title: String,
    val thumbnails: YoutubeThumbnailsDto,
    val channelTitle: String
)
