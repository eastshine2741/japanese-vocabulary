package com.japanese.vocabulary.lyricsearch.lrclib

import com.japanese.vocabulary.lyricsearch.LyricMatchConfidence
import com.japanese.vocabulary.lyricsearch.SongQueryNormalizer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder

/**
 * Confidence of each LrcLib match tier. Modeled on prod work 61: Sohbana's 『恋』 (206s) is not on
 * LrcLib, and the title-only search returned Conton Candy's 『恋』 (203s) among twenty same-titled
 * songs — a duration coincidence that must come back WEAK, not as a plain hit.
 */
class LrclibClientTest {

    private val query = SongQueryNormalizer.normalize(title = "恋", artist = "Sohbana", durationSeconds = 206)

    @Test
    fun `duration-only fallback is a weak match`() {
        val client = clientWith { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "Sohbana"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "%E6%81%8B"))
                .andRespond(withSuccess(candidates(track(1, "Conton Candy", 203)), MediaType.APPLICATION_JSON))
        }

        val result = client.search(query)!!

        assertThat(result.lrclibId).isEqualTo(1)
        assertThat(result.confidence).isEqualTo(LyricMatchConfidence.WEAK)
    }

    @Test
    fun `artist match in the title-only search is strong`() {
        val client = clientWith { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "Sohbana"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "%E6%81%8B"))
                .andRespond(
                    withSuccess(
                        candidates(track(1, "Conton Candy", 203), track(2, "Sohbana feat. 初音ミク", 205)),
                        MediaType.APPLICATION_JSON,
                    ),
                )
        }

        val result = client.search(query)!!

        assertThat(result.lrclibId).isEqualTo(2)
        assertThat(result.confidence).isEqualTo(LyricMatchConfidence.STRONG)
    }

    @Test
    fun `exact get is strong`() {
        val client = clientWith { server ->
            server.expect(requestTo(startsWithPath("/api/get")))
                .andRespond(withSuccess(track(3, "Sohbana", 206), MediaType.APPLICATION_JSON))
        }

        val result = client.search(query)!!

        assertThat(result.lrclibId).isEqualTo(3)
        assertThat(result.confidence).isEqualTo(LyricMatchConfidence.STRONG)
    }

    private fun startsWithPath(path: String) = org.hamcrest.Matchers.startsWith("https://lrclib.net$path")

    private fun candidates(vararg tracks: String) = tracks.joinToString(",", prefix = "[", postfix = "]")

    private fun track(id: Long, artist: String, duration: Int) = """
        {"id":$id,"trackName":"恋","artistName":"$artist","albumName":null,"duration":$duration,
         "instrumental":false,"plainLyrics":"恋をした\n君と","syncedLyrics":"[00:01.00]恋をした\n[00:02.00]君と"}
    """.trimIndent()

    private fun clientWith(expectations: (MockRestServiceServer) -> Unit): LrclibClient {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        expectations(server)
        return LrclibClient(builder)
    }
}
