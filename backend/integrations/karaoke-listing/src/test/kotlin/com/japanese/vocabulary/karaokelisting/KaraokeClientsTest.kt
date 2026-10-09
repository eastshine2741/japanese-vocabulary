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
    fun `kana line ratio counts lines with hiragana or katakana`() {
        val listing = KaraokeListing(KaraokeListingVendor.KY, 1, "t", "a", lyricLines = listOf("보쿠노", "ぼく", "命", "カタカナ"))

        assertThat(listing.kanaLineRatio).isEqualTo(0.5)
        assertThat(listing.copy(lyricLines = emptyList()).kanaLineRatio).isZero()
    }

    private fun fixture(name: String): String =
        javaClass.getResource("/karaoke/$name")!!.readText()
}
