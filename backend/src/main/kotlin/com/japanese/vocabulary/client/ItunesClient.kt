package com.japanese.vocabulary.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.model.SongSearchItem
import com.japanese.vocabulary.model.SongSearchResponse
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

// Internal DTOs for iTunes API deserialization

data class ItunesSearchResponse(val resultCount: Int, val results: List<ItunesTrack>)

data class ItunesTrack(
    val trackId: Long?,
    val trackName: String?,
    val artistName: String?,
    val artworkUrl100: String?,
    val trackTimeMillis: Int?
)

@Component
class ItunesClient(restClientBuilder: RestClient.Builder, objectMapper: ObjectMapper) {
    private val restClient = restClientBuilder
        .baseUrl("https://itunes.apple.com")
        .messageConverters { converters ->
            val textJsConverter = MappingJackson2HttpMessageConverter(objectMapper).apply {
                supportedMediaTypes = listOf(MediaType("text", "javascript", Charsets.UTF_8))
            }
            converters.add(textJsConverter)
        }
        .build()

    fun search(query: String, offset: Int = 0, limit: Int = 10): SongSearchResponse {
        val response = restClient.get()
            .uri { builder ->
                builder.path("/search")
                    .queryParam("term", query)
                    .queryParam("media", "music")
                    .queryParam("entity", "musicTrack")
                    .queryParam("limit", limit)
                    .queryParam("offset", offset)
                    .queryParam("country", "jp")
                    .build()
            }
            .retrieve()
            .body(ItunesSearchResponse::class.java)
            ?: return SongSearchResponse(emptyList(), null)

        val items = response.results.mapNotNull { track ->
            val id = track.trackId?.toString() ?: return@mapNotNull null
            SongSearchItem(
                id = id,
                title = track.trackName ?: return@mapNotNull null,
                thumbnail = track.artworkUrl100 ?: return@mapNotNull null,
                artistName = track.artistName ?: return@mapNotNull null,
                durationSeconds = (track.trackTimeMillis ?: 0) / 1000
            )
        }

        val nextOffset = if (response.results.size >= limit) offset + response.results.size else null
        return SongSearchResponse(items, nextOffset)
    }
}
