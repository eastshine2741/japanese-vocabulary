package com.japanese.vocabulary.song.client.vocadb

import com.japanese.vocabulary.song.client.NormalizedSongQuery
import com.japanese.vocabulary.song.client.vocadb.dto.VocadbLyricsDto
import com.japanese.vocabulary.song.client.vocadb.dto.VocadbNameDto
import com.japanese.vocabulary.song.client.vocadb.dto.VocadbPvDto
import com.japanese.vocabulary.song.client.vocadb.dto.VocadbSongDto
import com.japanese.vocabulary.song.client.vocadb.dto.VocadbWebLinkDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class VocadbSongMatcherTest {

    @Test
    fun `accepts song when requested artist appears in PV or web link metadata`() {
        val query = query(title = "楽曲タイトル", artist = "別名義", durationSeconds = 180)
        val song = metadataMatchedSong()

        assertThat(VocadbSongMatcher.matches(query, song)).isTrue
    }

    @Test
    fun `rejects metadata artist hit when title is not exact`() {
        val query = query(title = "楽曲タイトル", artist = "別名義", durationSeconds = 180)
        val song = metadataMatchedSong(name = "別の楽曲タイトル")

        assertThat(VocadbSongMatcher.matches(query, song)).isFalse
    }

    @Test
    fun `rejects metadata artist hit when duration is far from query`() {
        val query = query(title = "楽曲タイトル", artist = "別名義", durationSeconds = 240)
        val song = metadataMatchedSong()

        assertThat(VocadbSongMatcher.matches(query, song)).isFalse
    }

    @Test
    fun `keeps accepting direct artistString matches`() {
        val query = query(title = "テスト", artist = "表示アーティスト", durationSeconds = 200)
        val song = VocadbSongDto(
            id = 1,
            name = "別タイトル",
            artistString = "表示アーティスト feat. ボーカル",
            lyrics = originalLyrics(),
        )

        assertThat(VocadbSongMatcher.matches(query, song)).isTrue
    }

    @Test
    fun `does not accept unrelated producer metadata as an alias for requested artist`() {
        val query = query(title = "楽曲タイトル", artist = "別名義", durationSeconds = 180)
        val song = metadataMatchedSong(
            pvs = listOf(VocadbPvDto(author = "作曲者")),
            webLinks = emptyList(),
        )

        assertThat(VocadbSongMatcher.matches(query, song)).isFalse
    }

    private fun query(title: String, artist: String, durationSeconds: Int?) = NormalizedSongQuery(
        originalTitle = title,
        originalArtist = artist,
        normalizedTitle = title,
        artistParts = listOf(artist),
        durationSeconds = durationSeconds,
    )

    private fun metadataMatchedSong(
        name: String = "楽曲タイトル",
        pvs: List<VocadbPvDto> = listOf(
            VocadbPvDto(
                name = "楽曲タイトル ／ ボーカル",
                author = "作曲者",
                description = "別名義 version: https://youtu.be/example",
            )
        ),
        webLinks: List<VocadbWebLinkDto> = listOf(
            VocadbWebLinkDto(
                category = "Official",
                description = "別名義 version",
                url = "https://youtu.be/example",
            )
        ),
    ) = VocadbSongDto(
        id = 1,
        name = name,
        artistString = "作曲者 feat. ボーカル",
        lyrics = originalLyrics(),
        lengthSeconds = 182,
        names = listOf(VocadbNameDto(language = "Japanese", value = name)),
        pvs = pvs,
        webLinks = webLinks,
    )

    private fun originalLyrics() = listOf(
        VocadbLyricsDto(
            id = 258204,
            cultureCodes = listOf("ja"),
            translationType = "Original",
            value = "歌詞",
        )
    )
}
