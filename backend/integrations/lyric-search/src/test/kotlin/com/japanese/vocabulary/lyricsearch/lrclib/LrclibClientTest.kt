package com.japanese.vocabulary.lyricsearch.lrclib

import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient

class LrclibClientTest {

    @Test
    fun `continues to search fallback when exact match returns upstream response error`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val client = LrclibClient(builder)

        server.expect(requestTo(containsString("/api/get")))
            .andRespond(withStatus(HttpStatus.GATEWAY_TIMEOUT))
        server.expect(requestTo(containsString("/api/search")))
            .andRespond(
                withSuccess(
                    """
                    [
                      {
                        "id": 123,
                        "trackName": "キミの記憶",
                        "artistName": "川村ゆみ",
                        "albumName": null,
                        "duration": 387,
                        "instrumental": false,
                        "plainLyrics": "きみの記憶\nここにある",
                        "syncedLyrics": null
                      }
                    ]
                    """.trimIndent(),
                    MediaType.APPLICATION_JSON,
                )
            )

        val result = client.search(
            NormalizedSongQuery(
                originalTitle = "キミの記憶",
                originalArtist = "川村ゆみ",
                normalizedTitle = "キミの記憶",
                artistParts = listOf("川村ゆみ"),
                durationSeconds = 387,
            )
        )

        assertThat(result?.lrclibId).isEqualTo(123)
        assertThat(result?.lyrics).isEqualTo("きみの記憶\nここにある")
        server.verify()
    }
}
