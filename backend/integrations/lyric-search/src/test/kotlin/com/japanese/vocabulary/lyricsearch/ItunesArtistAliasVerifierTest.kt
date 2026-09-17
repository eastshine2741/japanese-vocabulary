package com.japanese.vocabulary.lyricsearch

import com.japanese.vocabulary.songsearch.client.itunes.ItunesClient
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/** Catalog answers are the real iTunes JP responses observed for these LrcLib artist spellings. */
class ItunesArtistAliasVerifierTest {

    private val itunesClient: ItunesClient = mockk()
    private val verifier = ItunesArtistAliasVerifier(itunesClient)

    @Test
    fun `a romanized alias resolves to the query artist`() {
        every { itunesClient.search("Aimyon") } returns catalog("あいみょん", "あいみょん", "平井 堅")

        assertThat(verifier.isSameArtist(listOf("あいみょん"), "Aimyon")).isTrue()
    }

    @Test
    fun `a collaboration credit still names the artist`() {
        every { itunesClient.search("Kenshi Yonezu") } returns catalog("DAOKO×米津玄師", "米津玄師 & 宇多田ヒカル")

        assertThat(verifier.isSameArtist(listOf("米津玄師"), "Kenshi Yonezu")).isTrue()
    }

    @Test
    fun `a different artist stays different`() {
        every { itunesClient.search("Conton Candy") } returns catalog("Conton Candy", "Conton Candy")

        assertThat(verifier.isSameArtist(listOf("Sohbana"), "Conton Candy")).isFalse()
    }

    @Test
    fun `a failed lookup is not a match`() {
        every { itunesClient.search(any()) } throws RuntimeException("itunes down")

        assertThat(verifier.isSameArtist(listOf("あいみょん"), "Aimyon")).isFalse()
    }

    private fun catalog(vararg artistNames: String) = SongSearchResponse(
        artistNames.mapIndexed { i, artist ->
            SongSearchItemDto(id = "$i", title = "t", thumbnail = "u", artistName = artist, durationSeconds = 200)
        },
    )
}
