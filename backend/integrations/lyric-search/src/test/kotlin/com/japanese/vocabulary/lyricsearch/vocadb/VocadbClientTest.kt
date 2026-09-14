package com.japanese.vocabulary.lyricsearch.vocadb

import com.japanese.vocabulary.lyricsearch.SongQueryNormalizer
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.startsWith
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.client.ExpectedCount
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient

/**
 * Modeled on prod work 61: Sohbana's 『恋』 (VocaDB 1021616, 205s) ranks 18th among 2,428 songs
 * whose title starts with 恋, so a popularity-sorted top-10 keyword search never sees it.
 */
class VocadbClientTest {

    @Test
    fun `resolves the artist id and searches songs within that artist`() {
        val client = clientWith { server ->
            server.expect(requestTo(startsWithPath("/api/artists"))).andExpect(queryParam("query", "Sohbana"))
                .andRespond(withSuccess(artists(artist(67369, "Sohbana", "Sohbanasick")), MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/songs"))).andExpect(queryParam("artistId%5B%5D", "67369"))
                .andRespond(withSuccess(songs(song(1021616, "恋", "Sohbana feat. 初音ミク V6", 205)), MediaType.APPLICATION_JSON))
        }

        val result = client.search(query("恋", "Sohbana", 206))!!

        assertThat(result.vocadbId).isEqualTo(1021616)
        assertThat(result.lyrics).isEqualTo("歌詞")
    }

    @Test
    fun `ignores artist search hits that only share a prefix with the requested artist`() {
        val client = clientWith { server ->
            server.expect(requestTo(startsWithPath("/api/artists")))
                .andRespond(withSuccess(artists(artist(1, "Sohbanana", null)), MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/songs")))
                .andRespond(withSuccess(songs(song(2, "恋は戦争", "ryo, supercell feat. 初音ミク", 235)), MediaType.APPLICATION_JSON))
        }

        assertThat(client.search(query("恋", "Sohbana", 206))).isNull()
    }

    @Test
    fun `falls back to the keyword search when the artist is not on VocaDB`() {
        val client = clientWith { server ->
            server.expect(requestTo(startsWithPath("/api/artists")))
                .andRespond(withSuccess(artists(), MediaType.APPLICATION_JSON))
            server.expect(requestTo(startsWithPath("/api/songs"))).andExpect(queryParam("query", "Lemon"))
                .andRespond(withSuccess(songs(song(3, "Lemon", "米津玄師", 274)), MediaType.APPLICATION_JSON))
        }

        val result = client.search(query("Lemon", "米津玄師", 274))!!

        assertThat(result.vocadbId).isEqualTo(3)
    }

    @Test
    fun `falls back to the keyword search when the artist-scoped search has no song with lyrics`() {
        val client = clientWith { server ->
            server.expect(requestTo(startsWithPath("/api/artists")))
                .andRespond(withSuccess(artists(artist(67369, "Sohbana", null)), MediaType.APPLICATION_JSON))
            server.expect(ExpectedCount.times(2), requestTo(startsWithPath("/api/songs")))
                .andRespond(withSuccess(songs(), MediaType.APPLICATION_JSON))
        }

        assertThat(client.search(query("恋", "Sohbana", 206))).isNull()
    }

    private fun query(title: String, artist: String, duration: Int) =
        SongQueryNormalizer.normalize(title = title, artist = artist, durationSeconds = duration)

    private fun startsWithPath(path: String) = startsWith("https://vocadb.net$path")

    private fun artists(vararg items: String) = items.joinToString(",", prefix = """{"items":[""", postfix = "]}")

    private fun artist(id: Long, name: String, alias: String?) = """
        {"id":$id,"name":"$name","names":[{"language":"Romaji","value":"$name"}
        ${alias?.let { """,{"language":"Unspecified","value":"$it"}""" } ?: ""}]}
    """.trimIndent()

    private fun songs(vararg items: String) = items.joinToString(",", prefix = """{"items":[""", postfix = "]}")

    private fun song(id: Long, name: String, artistString: String, length: Int) = """
        {"id":$id,"name":"$name","artistString":"$artistString","lengthSeconds":$length,
         "lyrics":[{"id":1,"cultureCodes":["ja"],"translationType":"Original","value":"歌詞"}]}
    """.trimIndent()

    private fun clientWith(expectations: (MockRestServiceServer) -> Unit): VocadbClient {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        expectations(server)
        return VocadbClient(builder)
    }
}
