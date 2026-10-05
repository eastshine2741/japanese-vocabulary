package com.japanese.vocabulary.karaokelisting

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
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
    fun `TJ number is Japanese only when the JPN filtered search returns it`() {
        assertThat(tjSearching(90164, "tj-search-jpn-hit.html")).isTrue()
        assertThat(tjSearching(71179, "tj-search-jpn-miss.html")).isFalse()
    }

    @Test
    fun `parses KY latest rows with lyrics and kana ratio`() {
        val rows = KyClient(RestClient.builder()).parse(fixture("ky-latest-page.html"))

        assertThat(rows.map { it.number }).containsExactly(51732, 51739, 57729, 57728, 57730)
        val ado = rows.single { it.number == 57728 }
        assertThat(ado.title).isEqualTo("オールナイトレディオ")
        assertThat(ado.artist).isEqualTo("Ado")
        assertThat(ado.kanaLineRatio).isGreaterThan(0.5)
        assertThat(rows.single { it.number == 57730 }.title).isEqualTo("なんもねえ (\"ヤニねこ\"OP)")
        assertThat(rows.single { it.number == 51739 }.kanaLineRatio).isZero()
    }

    @Test
    fun `KY pages stop at the first empty page`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo("https://kysing.kr/latest/?s_page=1"))
            .andRespond(withSuccess(fixture("ky-latest-page.html"), MediaType.TEXT_HTML))
        server.expect(requestTo("https://kysing.kr/latest/?s_page=2"))
            .andRespond(withSuccess(fixture("ky-latest-empty.html"), MediaType.TEXT_HTML))

        assertThat(KyClient(builder).latestSongs()).hasSize(5)
        server.verify()
    }

    private fun tjSearching(number: Int, file: String): Boolean {
        val builder = RestClient.builder()
        MockRestServiceServer.bindTo(builder).build()
            .expect(requestTo("https://www.tjmedia.com/song/accompaniment_search?nationType=JPN&strType=16&searchTxt=$number"))
            .andRespond(withSuccess(fixture(file), MediaType.TEXT_HTML))
        return TjClient(builder).isJapanese(number)
    }

    private fun fixture(name: String): String =
        javaClass.getResource("/karaoke/$name")!!.readText()
}
