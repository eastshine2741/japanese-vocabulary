package com.japanese.vocabulary.song.client.musicbrainz

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.song.client.musicbrainz.dto.MusicbrainzRecording
import com.japanese.vocabulary.song.client.musicbrainz.dto.MusicbrainzRecordingSearchResponse
import com.japanese.vocabulary.song.dto.SongSearchItem
import com.japanese.vocabulary.song.dto.SongSearchResponse
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

@Component
class MusicbrainzClient(restClientBuilder: RestClient.Builder, objectMapper: ObjectMapper) {

    private val logger = LoggerFactory.getLogger(MusicbrainzClient::class.java)

    private val restClient = restClientBuilder
        .baseUrl(MB_BASE_URL)
        .defaultHeader("User-Agent", USER_AGENT)
        .defaultHeader("Accept", "application/json")
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(CONNECT_TIMEOUT_MS)
                setReadTimeout(READ_TIMEOUT_MS)
            }
        )
        .messageConverters { converters ->
            converters.add(0, MappingJackson2HttpMessageConverter(objectMapper).apply {
                supportedMediaTypes = listOf(
                    MediaType.APPLICATION_JSON,
                    MediaType("text", "javascript", Charsets.UTF_8)
                )
            })
        }
        .build()

    fun search(query: String): SongSearchResponse {
        if (query.isBlank()) return SongSearchResponse(emptyList())

        val response = try {
            restClient.get()
                .uri { builder ->
                    builder.path("/ws/2/recording")
                        .queryParam("query", buildLuceneQuery(query))
                        .queryParam("fmt", "json")
                        .queryParam("limit", LIMIT)
                        .build()
                }
                .retrieve()
                .body(MusicbrainzRecordingSearchResponse::class.java)
        } catch (e: RestClientException) {
            logger.warn("MusicBrainz search failed (query length={}): {}", query.length, e.javaClass.simpleName)
            return SongSearchResponse(emptyList())
        } ?: return SongSearchResponse(emptyList())

        val items = response.recordings.orEmpty()
            .filter { (it.score ?: 0) >= MIN_SCORE }
            .mapNotNull { it.toSearchItem() }
        return SongSearchResponse(items)
    }

    private fun MusicbrainzRecording.toSearchItem(): SongSearchItem? {
        val recId = id ?: return null
        val recTitle = title ?: return null
        val artistName = artistCredit
            .orEmpty()
            .mapNotNull { it.name ?: it.artist?.name }
            .joinToString(" / ")
            .takeIf { it.isNotBlank() }
            ?: return null
        val releaseMbid = releases.orEmpty().firstOrNull()?.id
        val thumbnail = releaseMbid?.let { CoverArtUrl.releaseFront(it, COVER_SIZE) }
        return SongSearchItem(
            id = recId,
            title = recTitle,
            thumbnail = thumbnail,
            artistName = artistName,
            durationSeconds = ((length ?: 0L) / 1000L).toInt()
        )
    }

    /**
     * Wrap user input as a Lucene phrase to neutralize reserved operators
     * (`+ - && || ! ( ) { } [ ] ^ ~ * ? : /`). Backslash and double-quote are
     * pre-escaped so the surrounding quotes can't be terminated by user input.
     */
    private fun buildLuceneQuery(raw: String): String {
        val escaped = raw.replace("\\", "\\\\").replace("\"", "\\\"")
        return "\"$escaped\""
    }

    companion object {
        private const val MB_BASE_URL = "https://musicbrainz.org"
        // MusicBrainz requires a meaningful User-Agent identifying the app + contact.
        // Per https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
        const val USER_AGENT = "Kotonoha/0.0.1 ( eastshine@snu.ac.kr )"
        private const val LIMIT = 25
        // Lucene relevance scores below 50 are mostly noise per the J-music coverage spike.
        private const val MIN_SCORE = 50
        // CAA serves 250/500/1200/original. 500 fits search list thumbs and deck covers without re-fetching.
        private const val COVER_SIZE = 500
        private const val CONNECT_TIMEOUT_MS = 3_000
        private const val READ_TIMEOUT_MS = 8_000
    }
}
