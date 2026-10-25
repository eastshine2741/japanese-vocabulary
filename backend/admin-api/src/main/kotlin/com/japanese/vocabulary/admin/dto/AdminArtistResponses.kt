package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminArtistSummary(val id: Long, val name: String, val artworkUrl: String?)

data class AdminArtistDetail(
    val artist: AdminArtistSummary,
    val appleMusicUrl: String?,
    val youtubeChannels: List<AdminArtistChannel>,
)

data class AdminArtistChannel(val channelId: String, val channelTitle: String?, val createdAt: Instant?)

/** [channel]: a channel id or a youtube.com/channel/… URL. */
data class AdminArtistChannelAddRequest(val channel: String = "", val channelTitle: String? = null)
