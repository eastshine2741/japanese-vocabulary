package com.japanese.vocabulary.mvsearch.client.youtube

import org.springframework.stereotype.Component
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeChannelItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeChannelsResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemsResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.web.client.RestClient

@Component
class YoutubeClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${youtube.api-key}") private val apiKey: String,
) {
    private val restClient = restClientBuilder.baseUrl("https://www.googleapis.com").build()

    fun searchVideos(
        query: String,
        pageToken: String? = null,
        maxResults: Int = 15,
        videoCategoryId: String? = null,
    ): YoutubeSearchResponse? =
        restClient.get()
            .uri { builder ->
                builder.path("/youtube/v3/search")
                    .queryParam("q", query)
                    .queryParam("type", "video")
                    .queryParam("part", "snippet")
                    .queryParam("maxResults", maxResults)
                    .queryParam("key", apiKey)
                    .apply { if (pageToken != null) queryParam("pageToken", pageToken) }
                    .apply { if (videoCategoryId != null) queryParam("videoCategoryId", videoCategoryId) }
                    .build()
            }
            .retrieve()
            .body(YoutubeSearchResponse::class.java)

    fun getChannel(channelId: String): YoutubeChannelItemDto? =
        restClient.get()
            .uri { builder ->
                builder.path("/youtube/v3/channels")
                    .queryParam("id", channelId)
                    .queryParam("part", "snippet,contentDetails")
                    .queryParam("key", apiKey)
                    .build()
            }
            .retrieve()
            .body(YoutubeChannelsResponse::class.java)
            ?.items
            ?.firstOrNull()

    fun listPlaylistItems(
        playlistId: String,
        pageToken: String? = null,
        maxResults: Int = 50,
    ): YoutubePlaylistItemsResponse? =
        restClient.get()
            .uri { builder ->
                builder.path("/youtube/v3/playlistItems")
                    .queryParam("playlistId", playlistId)
                    .queryParam("part", "snippet")
                    .queryParam("maxResults", maxResults)
                    .queryParam("key", apiKey)
                    .apply { if (pageToken != null) queryParam("pageToken", pageToken) }
                    .build()
            }
            .retrieve()
            .body(YoutubePlaylistItemsResponse::class.java)

}
