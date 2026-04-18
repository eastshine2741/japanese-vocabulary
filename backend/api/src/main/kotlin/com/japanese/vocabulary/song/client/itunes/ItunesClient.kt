package com.japanese.vocabulary.song.client.itunes

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.song.client.itunes.dto.ItunesSearchResponse
import com.japanese.vocabulary.song.dto.SongSearchItem
import com.japanese.vocabulary.song.dto.SongSearchResponse
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

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

    fun search(query: String): SongSearchResponse {
        val response = restClient.get()
            .uri { builder ->
                builder.path("/search")
                    .queryParam("term", query)
                    .queryParam("media", "music")
                    .queryParam("entity", "musicTrack")
                    .queryParam("limit", 50)
                    .queryParam("country", "jp")
                    .build()
            }
            .retrieve()
            .body(ItunesSearchResponse::class.java)
            ?: return SongSearchResponse(emptyList())

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

        return SongSearchResponse(items)
    }
}
