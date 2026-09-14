package com.japanese.vocabulary.lyricsearch.lrclib

import com.japanese.vocabulary.lyricsearch.ItunesArtistAliasVerifier
import com.japanese.vocabulary.lyricsearch.SongQueryNormalizer
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.startsWith
import io.mockk.every
import io.mockk.mockk
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient

/**
 * The duration fallback in LrcLib search. Modeled on prod work 61: Sohbana's 『恋』 (206s) is not on
 * LrcLib, and the title-only search returned Conton Candy's 『恋』 (203s) among twenty same-titled
 * songs — a duration coincidence that used to be taken as a hit.
 */
class LrclibClientTest {

    @Test
    fun `duration match is rejected when the alias check says it is another artist`() {
        val client = clientWith(sameArtist = { _, _ -> false }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "Sohbana"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "%E6%81%8B"))
                .andRespond(withSuccess(candidates(track(1, "Conton Candy", 203)), MediaType.APPLICATION_JSON))
        }

        assertThat(client.search(query("恋", "Sohbana", 206))).isNull()
    }

    @Test
    fun `duration match is accepted when the alias check confirms the artist`() {
        val checked = mutableListOf<String>()
        val client = clientWith(sameArtist = { _, candidate -> checked += candidate; candidate == "Aimyon" }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "%E3%81%82%E3%81%84%E3%81%BF%E3%82%87%E3%82%93"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "%E3%83%9E%E3%83%AA%E3%83%BC%E3%82%B4%E3%83%BC%E3%83%AB%E3%83%89"))
                .andRespond(
                    withSuccess(
                        candidates(track(1, "orange pekoe", 305), track(2, "Aimyon", 306)),
                        MediaType.APPLICATION_JSON,
                    ),
                )
        }

        val result = client.search(query("マリーゴールド", "あいみょん", 306))!!

        assertThat(result.lrclibId).isEqualTo(2)
        assertThat(checked).containsExactly("orange pekoe", "Aimyon")
    }

    @Test
    fun `artist name match ignores spacing and needs no alias check`() {
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "%E7%B1%B3%E6%B4%A5%E7%8E%84%E5%B8%AB"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "Lemon"))
                .andRespond(
                    withSuccess(
                        candidates(track(1, "N.E.R.D", 226), track(2, "Kenshi Yonezu(켄시 요네즈/米津 玄師)", 274)),
                        MediaType.APPLICATION_JSON,
                    ),
                )
        }

        val result = client.search(query("Lemon", "米津玄師", 274))!!

        assertThat(result.lrclibId).isEqualTo(2)
    }

    private fun query(title: String, artist: String, duration: Int) =
        SongQueryNormalizer.normalize(title = title, artist = artist, durationSeconds = duration)

    private fun startsWithPath(path: String) = startsWith("https://lrclib.net$path")

    private fun candidates(vararg tracks: String) = tracks.joinToString(",", prefix = "[", postfix = "]")

    private fun track(id: Long, artist: String, duration: Int) = """
        {"id":$id,"trackName":"t","artistName":"$artist","albumName":null,"duration":$duration,
         "instrumental":false,"plainLyrics":"恋をした\n君と","syncedLyrics":"[00:01.00]恋をした\n[00:02.00]君と"}
    """.trimIndent()

    private fun clientWith(
        sameArtist: (List<String>, String) -> Boolean,
        expectations: (MockRestServiceServer) -> Unit,
    ): LrclibClient {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        expectations(server)
        val verifier = mockk<ItunesArtistAliasVerifier>()
        every { verifier.isSameArtist(any(), any()) } answers { sameArtist(firstArg(), secondArg()) }
        return LrclibClient(builder, verifier)
    }
}
