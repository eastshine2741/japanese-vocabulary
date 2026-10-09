package com.japanese.vocabulary.songsearch.client.applemusic

import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import org.hamcrest.Matchers.startsWith

class AppleMusicClientTest {

    private val tokenProvider: AppleMusicTokenProvider = mockk { every { token() } returns "dev-token" }

    @Test
    fun `search maps catalog songs and fills the artwork template at 600px`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo(startsWith("https://api.music.apple.com/v1/catalog/jp/search")))
            .andExpect(queryParam("types", "songs"))
            .andExpect(header("Authorization", "Bearer dev-token"))
            .andRespond(withSuccess(SEARCH_RESPONSE, MediaType.APPLICATION_JSON))

        val items = AppleMusicClient(builder, tokenProvider).search("夜に駆ける").items

        assertThat(items).hasSize(1)
        with(items.single()) {
            assertThat(id).isEqualTo("1490256995")
            assertThat(title).isEqualTo("夜に駆ける")
            assertThat(artistName).isEqualTo("YOASOBI")
            assertThat(durationSeconds).isEqualTo(261)
            assertThat(thumbnail).isEqualTo("https://is1-ssl.mzstatic.com/image/thumb/a.jpg/600x600bb.jpg")
        }
        server.verify()
    }

    @Test
    fun `no songs section means no results`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo(startsWith("https://api.music.apple.com/v1/catalog/jp/search")))
            .andRespond(withSuccess("""{"results":{},"meta":{"results":{"order":[]}}}""", MediaType.APPLICATION_JSON))

        assertThat(AppleMusicClient(builder, tokenProvider).search("zzzz").items).isEmpty()
    }

    @Test
    fun `findSongArtist takes the first artist of the exact title and artist match`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo(startsWith("https://api.music.apple.com/v1/catalog/jp/search")))
            .andRespond(withSuccess(SEARCH_RESPONSE, MediaType.APPLICATION_JSON))
        server.expect(requestTo("https://api.music.apple.com/v1/catalog/jp/songs/1490256995/artists"))
            .andExpect(header("Authorization", "Bearer dev-token"))
            .andRespond(withSuccess(ARTISTS_RESPONSE, MediaType.APPLICATION_JSON))

        val artist = AppleMusicClient(builder, tokenProvider).findSongArtist("夜に駆ける", "YOASOBI")

        assertThat(artist).isNotNull
        with(artist!!) {
            assertThat(id).isEqualTo("1490256993")
            assertThat(name).isEqualTo("YOASOBI")
            assertThat(artworkUrl).isEqualTo("https://is1-ssl.mzstatic.com/image/thumb/artist.png/1200x1200bb.jpg")
            assertThat(url).isEqualTo("https://music.apple.com/jp/artist/yoasobi/1490256993")
        }
        server.verify()
    }

    @Test
    fun `findSongArtist does not settle for a same-titled song by another artist`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo(startsWith("https://api.music.apple.com/v1/catalog/jp/search")))
            .andRespond(withSuccess(SEARCH_RESPONSE, MediaType.APPLICATION_JSON))

        assertThat(AppleMusicClient(builder, tokenProvider).findSongArtist("夜に駆ける", "Ado")).isNull()
        server.verify()
    }

    @Test
    fun `topSongs maps the top-songs view`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo(startsWith("https://api.music.apple.com/v1/catalog/jp/artists/1490256993/view/top-songs")))
            .andExpect(queryParam("limit", "10"))
            .andRespond(withSuccess(TOP_SONGS_RESPONSE, MediaType.APPLICATION_JSON))

        val items = AppleMusicClient(builder, tokenProvider).topSongs("1490256993")

        assertThat(items.map { it.title }).containsExactly("夜に駆ける")
        server.verify()
    }

    private companion object {
        // Trimmed from a real JP storefront response; the second song has no artwork and is dropped.
        val SEARCH_RESPONSE = """
            {"results":{"songs":{"href":"/v1/catalog/jp/search?limit=25&term=x&types=songs","data":[
              {"id":"1490256995","type":"songs","attributes":{"name":"夜に駆ける","artistName":"YOASOBI",
                "durationInMillis":261013,"genreNames":["J-Pop"],
                "artwork":{"width":3000,"height":3000,"url":"https://is1-ssl.mzstatic.com/image/thumb/a.jpg/{w}x{h}bb.jpg"}}},
              {"id":"1","type":"songs","attributes":{"name":"no art","artistName":"x","durationInMillis":1000}}
            ]}},"meta":{"results":{"order":["songs"]}}}
        """.trimIndent()

        val ARTISTS_RESPONSE = """
            {"data":[{"id":"1490256993","type":"artists","attributes":{"name":"YOASOBI","genreNames":["J-Pop"],
              "url":"https://music.apple.com/jp/artist/yoasobi/1490256993",
              "artwork":{"width":2400,"height":2400,"url":"https://is1-ssl.mzstatic.com/image/thumb/artist.png/{w}x{h}bb.jpg"}}}]}
        """.trimIndent()

        val TOP_SONGS_RESPONSE = """
            {"next":"/v1/catalog/jp/artists/1490256993/view/top-songs?offset=10","data":[
              {"id":"1490256995","type":"songs","attributes":{"name":"夜に駆ける","artistName":"YOASOBI",
                "durationInMillis":261013,"artwork":{"url":"https://is1-ssl.mzstatic.com/image/thumb/a.jpg/{w}x{h}bb.jpg"}}}
            ]}
        """.trimIndent()
    }
}
