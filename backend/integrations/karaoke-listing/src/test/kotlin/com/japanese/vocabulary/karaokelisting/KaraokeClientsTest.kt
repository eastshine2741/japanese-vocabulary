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
import java.time.Duration
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
    fun `passes KY cookie challenge, reuses the cookie, and reads a song by number with its release month`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo("https://kysing.kr/search/?category=1&keyword=57723"))
            .andRespond(withSuccess(fixture("ky-challenge.html"), HTML_UTF8))
        server.expect(requestTo("https://kysing.kr/search/?category=1&keyword=57723"))
            .andExpect(header("Cookie", "CUPID=c571f4d2f56ab754724247870648f1bc"))
            .andRespond(withSuccess(fixture("ky-search.html"), HTML_UTF8))
        server.expect(requestTo("https://kysing.kr/search/?category=1&keyword=57722"))
            .andExpect(header("Cookie", "CUPID=c571f4d2f56ab754724247870648f1bc"))
            .andRespond(withSuccess("<html></html>", HTML_UTF8))
        val client = kyClient(builder)

        assertThat(client.song(57723)).isEqualTo(
            KaraokeListing(
                KaraokeListingVendor.KY, 57723, "千鳥", "ヨルシカ",
                lyricLines = listOf("카제가 오모테데 욘데이루", "かぜ//////よ/", "風がおもてで呼んでいる"),
                releaseMonth = YearMonth.of(2026, 12),
            ),
        )
        assertThat(client.song(57722)).isNull()
        server.verify()
    }

    @Test
    fun `reads every page of every initial in the KY Japanese book`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo("https://kysing.kr/karaoke-book/?city=jp"))
            .andRespond(withSuccess(fixture("ky-book-index.html"), HTML_UTF8))
        server.expect(requestTo(bookPage("A", 1))).andRespond(withSuccess(bookHtml(40000 until 42000), HTML_UTF8))
        server.expect(requestTo(bookPage("A", 2))).andRespond(withSuccess(bookHtml(42000 until 43000), HTML_UTF8))
        server.expect(requestTo(bookPage("A", 3))).andRespond(withSuccess("<html></html>", HTML_UTF8))
        server.expect(requestTo(bookPage("%E3%81%82", 1))).andRespond(withSuccess(bookHtml(57723..57800), HTML_UTF8))
        server.expect(requestTo(bookPage("%E3%81%82", 2))).andRespond(withSuccess("<html></html>", HTML_UTF8))

        val numbers = kyClient(builder).bookNumbers()

        assertThat(numbers).hasSize(3078)
        assertThat(numbers).containsAll(listOf(40000, 42999, 57723, 57800))
        server.verify()
    }

    @Test
    fun `fails instead of reporting no KY songs when the book comes back nearly empty`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo("https://kysing.kr/karaoke-book/?city=jp"))
            .andRespond(withSuccess(fixture("ky-book-index.html"), HTML_UTF8))
        server.expect(requestTo(bookPage("A", 1))).andRespond(withSuccess("<html></html>", HTML_UTF8))
        server.expect(requestTo(bookPage("%E3%81%82", 1))).andRespond(withSuccess("<html></html>", HTML_UTF8))

        assertThatThrownBy { kyClient(builder).bookNumbers() }.isInstanceOf(IllegalStateException::class.java)
    }

    @Test
    fun `fails when KY answers with its access blocked page`() {
        val builder = RestClient.builder()
        MockRestServiceServer.bindTo(builder).build()
            .expect(requestTo("https://kysing.kr/search/?category=1&keyword=57723"))
            .andRespond(withSuccess("<title>사이트 소유자에 의해 이 사이트에 대한 액세스가 제한되었습니다</title>", HTML_UTF8))

        assertThatThrownBy { kyClient(builder).song(57723) }.isInstanceOf(IllegalStateException::class.java)
    }

    @Test
    fun `book rows are read from the cell text because titles carry unescaped quotes`() {
        val numbers = kyClient(RestClient.builder()).parseBook(fixture("ky-book-index.html"))

        assertThat(numbers).containsExactly(41432)
    }

    @Test
    fun `kana line ratio counts lines with hiragana or katakana`() {
        val listing = KaraokeListing(KaraokeListingVendor.KY, 1, "t", "a", lyricLines = listOf("보쿠노", "ぼく", "命", "カタカナ"))

        assertThat(listing.kanaLineRatio).isEqualTo(0.5)
        assertThat(listing.copy(lyricLines = emptyList()).kanaLineRatio).isZero()
    }

    private val HTML_UTF8 = MediaType("text", "html", Charsets.UTF_8)

    private fun kyClient(builder: RestClient.Builder) = KyClient(builder).apply { minInterval = Duration.ZERO }

    private fun bookPage(initial: String, page: Int) =
        "https://kysing.kr/karaoke-book/?city=jp&s_cd=2&s_page=$page&s_value=$initial"

    private fun bookHtml(numbers: IntRange) = numbers.joinToString("", "<html><body>", "</body></html>") {
        """<ul class="index_search_list clear"><li class="index_search_num">$it</li></ul>"""
    }

    private fun fixture(name: String): String =
        javaClass.getResource("/karaoke/$name")!!.readText()
}
