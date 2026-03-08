package com.japanese.vocabulary.client

import com.japanese.vocabulary.model.SongSearchItem
import com.japanese.vocabulary.model.SongSearchResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

// Internal DTOs for YouTube API deserialization

data class YoutubeSearchResponse(
    val nextPageToken: String?,
    val items: List<YoutubeSearchItem>
)

data class YoutubeSearchItem(
    val id: YoutubeVideoId,
    val snippet: YoutubeSnippet
)

data class YoutubeVideoId(
    val videoId: String
)

data class YoutubeSnippet(
    val title: String,
    val thumbnails: YoutubeThumbnails,
    val channelTitle: String
)

data class YoutubeThumbnails(
    val medium: YoutubeThumbnail
)

data class YoutubeThumbnail(
    val url: String
)

data class YoutubeVideosResponse(
    val items: List<YoutubeVideoItem>
)

data class YoutubeVideoItem(
    val id: String,
    val contentDetails: YoutubeContentDetails
)

data class YoutubeContentDetails(
    val duration: String
)

@Component
class YoutubeClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${youtube.api-key}") private val apiKey: String
) {
    private val restClient = restClientBuilder.baseUrl("https://www.googleapis.com").build()

    fun search(query: String, pageToken: String?, maxResults: Int = 10): SongSearchResponse {
        val searchResponse = restClient.get()
            .uri { builder ->
                builder.path("/youtube/v3/search")
                    .queryParam("q", query)
                    .queryParam("type", "video")
                    .queryParam("part", "snippet")
                    .queryParam("maxResults", maxResults)
                    .queryParam("key", apiKey)
                    .apply { if (pageToken != null) queryParam("pageToken", pageToken) }
                    .build()
            }
            .retrieve()
            .body(YoutubeSearchResponse::class.java)
            ?: return SongSearchResponse(emptyList(), null)

        val videoIds = searchResponse.items.map { it.id.videoId }
        if (videoIds.isEmpty()) return SongSearchResponse(emptyList(), searchResponse.nextPageToken)

        val videosResponse = restClient.get()
            .uri { builder ->
                builder.path("/youtube/v3/videos")
                    .queryParam("id", videoIds.joinToString(","))
                    .queryParam("part", "contentDetails")
                    .queryParam("key", apiKey)
                    .build()
            }
            .retrieve()
            .body(YoutubeVideosResponse::class.java)

        val durationMap = videosResponse?.items?.associate { it.id to parseDuration(it.contentDetails.duration) }
            ?: emptyMap()

        val items = searchResponse.items.map { item ->
            SongSearchItem(
                id = item.id.videoId,
                title = item.snippet.title,
                thumbnail = item.snippet.thumbnails.medium.url,
                channelTitle = item.snippet.channelTitle,
                duration = durationMap[item.id.videoId] ?: ""
            )
        }

        return SongSearchResponse(items, searchResponse.nextPageToken)
    }

    private fun parseDuration(iso8601: String): String {
        // PT3M45S -> "3:45", PT1H2M3S -> "1:02:03"
        val pattern = Regex("""PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?""")
        val match = pattern.matchEntire(iso8601) ?: return ""
        val hours = match.groupValues[1].toIntOrNull()
        val minutes = match.groupValues[2].toIntOrNull() ?: 0
        val seconds = match.groupValues[3].toIntOrNull() ?: 0
        return if (hours != null) {
            "%d:%02d:%02d".format(hours, minutes, seconds)
        } else {
            "%d:%02d".format(minutes, seconds)
        }
    }
}
