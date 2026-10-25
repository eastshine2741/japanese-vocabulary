package com.japanese.vocabulary.lyricsearch.lrclib

import com.japanese.vocabulary.lyricsearch.AppleMusicArtistAliasVerifier
import com.japanese.vocabulary.lyricsearch.LyricProviderRetry
import com.japanese.vocabulary.lyricsearch.SongQueryNormalizer
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.hamcrest.Matchers.startsWith
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.ExpectedCount
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestClient
import java.time.Duration

/**
 * The duration fallback in LrcLib search: a same-titled song by another artist with a near duration
 * (Conton Candy's 『恋』 vs Sohbana's) must not be taken as a hit.
 */
class LrclibClientTest {

    @Test
    fun `duration match is rejected when the alias check says it is another artist`(): Unit = runBlocking {
        val client = clientWith(sameArtist = { _, _ -> false }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "Sohbana"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "%E6%81%8B"))
                .andRespond(withSuccess(candidates(track(1, "Conton Candy", 203, "恋")), MediaType.APPLICATION_JSON))
        }

        assertThat(client.search(query("恋", "Sohbana", 206))).isNull()
    }

    @Test
    fun `duration match is accepted when the alias check confirms the artist`(): Unit = runBlocking {
        val checked = mutableListOf<String>()
        val client = clientWith(sameArtist = { _, candidate -> checked += candidate; candidate == "Aimyon" }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "%E3%81%82%E3%81%84%E3%81%BF%E3%82%87%E3%82%93"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "%E3%83%9E%E3%83%AA%E3%83%BC%E3%82%B4%E3%83%BC%E3%83%AB%E3%83%89"))
                .andRespond(
                    withSuccess(
                        candidates(track(1, "orange pekoe", 305, "マリーゴールド"), track(2, "Aimyon", 306, "マリーゴールド")),
                        MediaType.APPLICATION_JSON,
                    ),
                )
        }

        val result = client.search(query("マリーゴールド", "あいみょん", 306))!!

        assertThat(result.lrclibId).isEqualTo(2)
        assertThat(checked).containsExactly("orange pekoe", "Aimyon")
    }

    @Test
    fun `artist name match ignores spacing and needs no alias check`(): Unit = runBlocking {
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "%E7%B1%B3%E6%B4%A5%E7%8E%84%E5%B8%AB"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "Lemon"))
                .andRespond(
                    withSuccess(
                        candidates(track(1, "N.E.R.D", 226, "Lemon"), track(2, "Kenshi Yonezu(켄시 요네즈/米津 玄師)", 274, "Lemon")),
                        MediaType.APPLICATION_JSON,
                    ),
                )
        }

        val result = client.search(query("Lemon", "米津玄師", 274))!!

        assertThat(result.lrclibId).isEqualTo(2)
    }

    /** A 503 resends only the request that got it; the ones already answered are not sent again. */
    @Test
    fun `a 503 retries only the failed request`(): Unit = runBlocking {
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "%E7%B1%B3%E6%B4%A5%E7%8E%84%E5%B8%AB"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "%E7%B1%B3%E6%B4%A5%E7%8E%84%E5%B8%AB"))
                .andRespond(withSuccess(candidates(track(2, "米津玄師", 274, "Lemon")), MediaType.APPLICATION_JSON))
        }

        val result = client.search(query("Lemon", "米津玄師", 274))!!

        assertThat(result.lrclibId).isEqualTo(2)
    }

    /** Once the retries run out the outage propagates, so the caller does not read it as "no lyrics". */
    @Test
    fun `a 503 that outlives the retries propagates`() {
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(ExpectedCount.times(3), requestTo(startsWithPath("/api/get")))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))
        }

        assertThatThrownBy { runBlocking { client.search(query("Lemon", "米津玄師", 274)) } }
            .isInstanceOf(HttpServerErrorException.ServiceUnavailable::class.java)
    }

    /** Search results list the artist's other songs too (lrclib's q= matches artist text as well as titles). */
    @Test
    fun `an artist match with another title is not taken`(): Unit = runBlocking {
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(withStatus(HttpStatus.NOT_FOUND))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "Guiano"))
                .andRespond(withSuccess(candidates(track(1, "Guiano", 243, "花火")), MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "%E8%8A%B1"))
                .andRespond(withSuccess(candidates(track(2, "Guiano", 210, "花 - Guiano ver.")), MediaType.APPLICATION_JSON))
        }

        assertThat(client.search(query("花", "Guiano", 210))!!.lrclibId).isEqualTo(2)
    }

    @Test
    fun `a result marked as another language version is not taken`(): Unit = runBlocking {
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(requestTo(startsWithPath("/api/get")))
                .andRespond(withSuccess(track(1, "IVE", 177, "LOVE DIVE (Japanese ver.)"), MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("artist_name", "IVE"))
                .andRespond(withSuccess(candidates(track(1, "IVE", 177, "LOVE DIVE (Japanese ver.)")), MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/search"))).andExpect(queryParam("q", "LOVE%20DIVE"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON))
        }

        assertThat(client.search(query("LOVE DIVE", "IVE", 177))).isNull()
    }

    @Test
    fun `plain lyrics that carry LRC stamps are taken as synced`(): Unit = runBlocking {
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andRespond(
                withSuccess(
                    track(1, "ピノキオピー", 191, "嘘ミーム", plain = "\\n[00:05.19] アレも嘘\\n[00:06.77] コレも嘘", synced = null),
                    MediaType.APPLICATION_JSON,
                ),
            )
        }

        val result = client.search(query("嘘ミーム", "ピノキオピー", 191))!!

        assertThat(result.isSynced).isTrue()
        assertThat(result.lyrics).contains("[00:05.19] アレも嘘")
    }

    /**
     * Real lrclib 2116394: the Japanese lyrics then a romaji copy restarting at 00:00. Rejected as non-Japanese, the
     * search fell through to the twenty vandal uploads titled exactly `アイドル` (「相壊す ぐわんぐわんな」).
     */
    @Test
    fun `an exact hit with an appended romaji copy is taken without the copy`(): Unit = runBlocking {
        val fixture = javaClass.getResource("/lrclib/idol-with-romaji-2116394.json")!!.readText()
        val client = clientWith(sameArtist = { _, _ -> error("alias check must not run") }) { server ->
            server.expect(requestTo(startsWithPath("/api/get"))).andExpect(queryParam("duration", "213"))
                .andRespond(withSuccess(fixture, MediaType.APPLICATION_JSON))
        }

        val result = client.search(query("アイドル", "YOASOBI", 213))!!

        assertThat(result.lrclibId).isEqualTo(2116394)
        assertThat(result.isSynced).isTrue()
        assertThat(result.lyrics).contains("無敵の笑顔で荒らすメディア").doesNotContain("Muteki no egao")
    }

    private fun query(title: String, artist: String, duration: Int) =
        SongQueryNormalizer.normalize(title = title, artist = artist, durationSeconds = duration)

    private fun startsWithPath(path: String) = startsWith("https://lrclib.net$path")

    private fun candidates(vararg tracks: String) = tracks.joinToString(",", prefix = "[", postfix = "]")

    private fun track(
        id: Long,
        artist: String,
        duration: Int,
        title: String,
        plain: String = "恋をした\\n君と",
        synced: String? = "[00:01.00]恋をした\\n[00:02.00]君と",
    ) = """
        {"id":$id,"trackName":"$title","artistName":"$artist","albumName":null,"duration":$duration,
         "instrumental":false,"plainLyrics":"$plain","syncedLyrics":${synced?.let { "\"$it\"" } ?: "null"}}
    """.trimIndent()

    private fun clientWith(
        sameArtist: (List<String>, String) -> Boolean,
        expectations: (MockRestServiceServer) -> Unit,
    ): LrclibClient {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        expectations(server)
        val verifier = mockk<AppleMusicArtistAliasVerifier>()
        every { verifier.isSameArtist(any(), any()) } answers { sameArtist(firstArg(), secondArg()) }
        return LrclibClient(builder, verifier, LyricProviderRetry(maxAttempts = 3, initialBackoff = Duration.ZERO))
    }
}
