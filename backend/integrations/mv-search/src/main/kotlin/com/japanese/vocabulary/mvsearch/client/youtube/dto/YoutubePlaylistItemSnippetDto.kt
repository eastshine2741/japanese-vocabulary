package com.japanese.vocabulary.mvsearch.client.youtube.dto

data class YoutubePlaylistItemSnippetDto(
    val title: String,
    val channelTitle: String,
    val resourceId: YoutubeResourceIdDto,
    /** The playlist owner's channel; for an uploads playlist, the uploader. */
    val channelId: String? = null,
)
