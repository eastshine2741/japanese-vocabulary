package com.japanese.vocabulary.songsearch.client.itunes

import org.springframework.stereotype.Component
import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.songsearch.client.itunes.dto.ItunesSearchResponse
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
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
            SongSearchItemDto(
                id = id,
                title = track.trackName ?: return@mapNotNull null,
                thumbnail = upsizeArtwork(track.artworkUrl100) ?: return@mapNotNull null,
                artistName = track.artistName ?: return@mapNotNull null,
                durationSeconds = (track.trackTimeMillis ?: 0) / 1000
            )
        }

        return SongSearchResponse(items)
    }

    // The mzstatic URL templates the size in the path, so swap 100x100 → 600x600.
    // 100x100 from artworkUrl100 looks blurry on deck cover screens at 3x density.
    private fun upsizeArtwork(url: String?): String? = url?.let {
        when {
            it.endsWith("/100x100bb.jpg") -> it.replace("/100x100bb.jpg", "/600x600bb.jpg")
            it.endsWith("/100x100bb.png") -> it.replace("/100x100bb.png", "/600x600bb.png")
            else -> it
        }
    }
}
