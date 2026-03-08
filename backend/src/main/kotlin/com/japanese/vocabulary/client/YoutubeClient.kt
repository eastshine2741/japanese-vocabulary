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
    val videoId: String?
)

data class YoutubeSnippet(
    val title: String,
    val thumbnails: YoutubeThumbnails,
    val channelTitle: String
)

data class YoutubeThumbnails(
    val medium: YoutubeThumbnail?,
    val default: YoutubeThumbnail?
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
                    .queryParam("videoCategoryId", "10")
                    .queryParam("key", apiKey)
                    .apply { if (pageToken != null) queryParam("pageToken", pageToken) }
                    .build()
            }
            .retrieve()
            .body(YoutubeSearchResponse::class.java)
            ?: return SongSearchResponse(emptyList(), null)

        val videoIds = searchResponse.items.mapNotNull { it.id.videoId }
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

        val items = searchResponse.items.mapNotNull { item ->
            val videoId = item.id.videoId ?: return@mapNotNull null
            val thumbnail = item.snippet.thumbnails.medium?.url
                ?: item.snippet.thumbnails.default?.url
                ?: return@mapNotNull null
            SongSearchItem(
                id = videoId,
                title = item.snippet.title,
                thumbnail = thumbnail,
                channelTitle = item.snippet.channelTitle,
                durationSeconds = durationMap[videoId] ?: 0
            )
        }

        return SongSearchResponse(items, searchResponse.nextPageToken)
    }

    private fun parseDuration(iso8601: String): Int {
        val pattern = Regex("""PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?""")
        val match = pattern.matchEntire(iso8601) ?: return 0
        val hours = match.groupValues[1].toIntOrNull() ?: 0
        val minutes = match.groupValues[2].toIntOrNull() ?: 0
        val seconds = match.groupValues[3].toIntOrNull() ?: 0
        return hours * 3600 + minutes * 60 + seconds
    }
}
