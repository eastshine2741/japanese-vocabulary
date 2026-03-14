package com.japanese.vocabulary.song.client.youtube

import com.japanese.vocabulary.song.client.youtube.dto.YoutubeMvSearchResponse
import com.japanese.vocabulary.song.client.youtube.dto.YoutubeSearchResponse
import com.japanese.vocabulary.song.client.youtube.dto.YoutubeVideosResponse
import com.japanese.vocabulary.song.dto.SongSearchItem
import com.japanese.vocabulary.song.dto.SongSearchResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

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
        if (videoIds.isEmpty()) return SongSearchResponse(emptyList(), 0)

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
                artistName = item.snippet.channelTitle,
                durationSeconds = durationMap[videoId] ?: 0
            )
        }

        return SongSearchResponse(items, 0)
    }

    fun searchMvUrl(title: String, artist: String): String? {
        val searchResponse = restClient.get()
            .uri { builder ->
                builder.path("/youtube/v3/search")
                    .queryParam("q", "$title $artist")
                    .queryParam("type", "video")
                    .queryParam("part", "id")
                    .queryParam("maxResults", 1)
                    .queryParam("videoCategoryId", "10")
                    .queryParam("key", apiKey)
                    .build()
            }
            .retrieve()
            .body(YoutubeMvSearchResponse::class.java)
        val videoId = searchResponse?.items?.firstOrNull()?.id?.videoId ?: return null
        return "https://www.youtube.com/watch?v=$videoId"
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
