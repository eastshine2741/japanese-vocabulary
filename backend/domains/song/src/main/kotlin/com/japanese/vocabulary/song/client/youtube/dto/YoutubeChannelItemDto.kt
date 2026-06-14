package com.japanese.vocabulary.song.client.youtube.dto

data class YoutubeChannelItemDto(
    val id: String,
    val snippet: YoutubeChannelSnippetDto?,
    val contentDetails: YoutubeChannelContentDetailsDto
)
