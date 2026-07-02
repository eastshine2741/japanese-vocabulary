package com.japanese.vocabulary.mvsearch.client.youtube.dto

data class YoutubeChannelItemDto(
    val id: String,
    val snippet: YoutubeChannelSnippetDto?,
    val contentDetails: YoutubeChannelContentDetailsDto
)
