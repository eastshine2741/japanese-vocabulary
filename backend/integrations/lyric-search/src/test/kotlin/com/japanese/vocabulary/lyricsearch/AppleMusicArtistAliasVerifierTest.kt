package com.japanese.vocabulary.lyricsearch

import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/** Catalog answers are the real Apple Music JP responses observed for these LrcLib artist spellings. */
class AppleMusicArtistAliasVerifierTest {

    private val appleMusicClient: AppleMusicClient = mockk()
    private val verifier = AppleMusicArtistAliasVerifier(appleMusicClient)

    @Test
    fun `a romanized alias resolves to the query artist`() {
        every { appleMusicClient.search("Aimyon") } returns catalog("あいみょん", "あいみょん", "平井 堅")

        assertThat(verifier.isSameArtist(listOf("あいみょん"), "Aimyon")).isTrue()
    }

    @Test
    fun `a collaboration credit still names the artist`() {
        every { appleMusicClient.search("Kenshi Yonezu") } returns catalog("DAOKO×米津玄師", "米津玄師 & 宇多田ヒカル")

        assertThat(verifier.isSameArtist(listOf("米津玄師"), "Kenshi Yonezu")).isTrue()
    }

    @Test
    fun `a different artist stays different`() {
        every { appleMusicClient.search("Conton Candy") } returns catalog("Conton Candy", "Conton Candy")

        assertThat(verifier.isSameArtist(listOf("Sohbana"), "Conton Candy")).isFalse()
    }

    @Test
    fun `a failed lookup is not a match`() {
        every { appleMusicClient.search(any()) } throws RuntimeException("apple music down")

        assertThat(verifier.isSameArtist(listOf("あいみょん"), "Aimyon")).isFalse()
    }

    private fun catalog(vararg artistNames: String) = SongSearchResponse(
        artistNames.mapIndexed { i, artist ->
            SongSearchItemDto(id = "$i", title = "t", thumbnail = "u", artistName = artist, durationSeconds = 200)
        },
    )
}
