package com.japanese.vocabulary.applemusicrss.client

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.client.match.MockRestRequestMatchers.anything
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient

class AppleMusicRssClientTest {

    @Test
    fun `upsizes the 100x100 artwork the RSS feed hands out`() {
        val client = clientReturning(
            """
            {"feed":{"results":[{
              "id":"1","name":"Song","artistName":"Artist",
              "artworkUrl100":"https://is1-ssl.mzstatic.com/image/thumb/abc/100x100bb.jpg"
            }]}}
            """.trimIndent()
        )

        val songs = client.fetchMostPlayedSongs(limit = 1)

        assertThat(songs.single().artworkUrl)
            .isEqualTo("https://is1-ssl.mzstatic.com/image/thumb/abc/600x600bb.jpg")
    }

    @Test
    fun `keeps artwork urls that do not carry the 100x100 path segment`() {
        val client = clientReturning(
            """
            {"feed":{"results":[{
              "id":"1","name":"Song","artistName":"Artist",
              "artworkUrl100":"https://example.com/artwork.jpg"
            }]}}
            """.trimIndent()
        )

        val songs = client.fetchMostPlayedSongs(limit = 1)

        assertThat(songs.single().artworkUrl).isEqualTo("https://example.com/artwork.jpg")
    }

    @Test
    fun `keeps a missing artwork url null`() {
        val client = clientReturning("""{"feed":{"results":[{"id":"1","name":"Song","artistName":"Artist"}]}}""")

        val songs = client.fetchMostPlayedSongs(limit = 1)

        assertThat(songs.single().artworkUrl).isNull()
    }

    private fun clientReturning(body: String): AppleMusicRssClient {
        val builder = RestClient.builder()
        MockRestServiceServer.bindTo(builder).build()
            .expect(anything())
            .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))
        return AppleMusicRssClient(builder)
    }
}
