package com.japanese.vocabulary.karaokelisting

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import java.time.LocalDate
import java.time.YearMonth

class KaraokeClientsTest {

    @Test
    fun `reads TJ new songs of the month`() {
        val builder = RestClient.builder()
        MockRestServiceServer.bindTo(builder).build()
            .expect(requestTo("https://www.tjmedia.com/legacy/api/newSongOfMonth"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().string("searchYm=202610"))
            .andRespond(withSuccess(fixture("tj-new-songs.json"), MediaType.APPLICATION_JSON))

        val songs = TjClient(builder).newSongs(YearMonth.of(2026, 10))

        assertThat(songs).hasSize(30)
        assertThat(songs).contains(
            KaraokeListing(KaraokeListingVendor.TJ, 90164, "愛麗絲", "米津玄師", LocalDate.of(2026, 10, 1)),
        )
    }

    @Test
    fun `passes KY cookie challenge and reuses the cookie on later pages`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo("https://kysing.kr/latest/?s_page=1"))
            .andRespond(withSuccess(fixture("ky-challenge.html"), HTML_UTF8))
        server.expect(requestTo("https://kysing.kr/latest/?s_page=1"))
            .andExpect(header("Cookie", "CUPID=c571f4d2f56ab754724247870648f1bc"))
            .andRespond(withSuccess(fixture("ky-latest.html"), HTML_UTF8))
        server.expect(requestTo("https://kysing.kr/latest/?s_page=2"))
            .andExpect(header("Cookie", "CUPID=c571f4d2f56ab754724247870648f1bc"))
            .andRespond(withSuccess("<html></html>", HTML_UTF8))

        val songs = KyClient(builder).latestSongs()

        assertThat(songs).containsExactly(
            KaraokeListing(
                KaraokeListingVendor.KY, 44123, "アイドル", "YOASOBI",
                lyricLines = listOf("無敵の笑顔で荒らすメディア", "知りたいその秘密ミステリアス"),
            ),
        )
        server.verify()
    }

    @Test
    fun `fails instead of reporting no KY songs when the first page has no rows`() {
        val builder = RestClient.builder()
        MockRestServiceServer.bindTo(builder).build()
            .expect(requestTo("https://kysing.kr/latest/?s_page=1"))
            .andRespond(withSuccess("<html></html>", HTML_UTF8))

        assertThatThrownBy { KyClient(builder).latestSongs() }.isInstanceOf(IllegalStateException::class.java)
    }

    @Test
    fun `kana line ratio counts lines with hiragana or katakana`() {
        val listing = KaraokeListing(KaraokeListingVendor.KY, 1, "t", "a", lyricLines = listOf("보쿠노", "ぼく", "命", "カタカナ"))

        assertThat(listing.kanaLineRatio).isEqualTo(0.5)
        assertThat(listing.copy(lyricLines = emptyList()).kanaLineRatio).isZero()
    }

    private val HTML_UTF8 = MediaType("text", "html", Charsets.UTF_8)

    private fun fixture(name: String): String =
        javaClass.getResource("/karaoke/$name")!!.readText()
}
