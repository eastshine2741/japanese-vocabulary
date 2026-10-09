package com.japanese.vocabulary.karaoke.service

import com.japanese.vocabulary.karaoke.dto.KaraokeSongDto
import com.japanese.vocabulary.karaoke.dto.KaraokeSongItemDto
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.YearMonth

class KaraokeSongMergerTest {
    private var nextId = 1L

    private fun row(vendor: KaraokeVendor, number: Int, title: String, artist: String, day: Int, songId: Long? = null, art: String? = null) =
        KaraokeSongDto(nextId++, vendor, number, title, artist, art, LocalDate.of(2026, 10, day), songId)

    @Test
    fun `daily merges a song listed by both vendors on the same day only`() {
        val rows = listOf(
            row(KaraokeVendor.TJ, 90170, "唱", "Ado", 3, art = "a.jpg"),
            row(KaraokeVendor.KY, 57740, "唱", "ado", 3, songId = 9),
            row(KaraokeVendor.KY, 57741, "怪獣", "サカナクション", 3),
            row(KaraokeVendor.TJ, 90160, "怪獣", "サカナクション", 1),
        )

        val groups = KaraokeSongMerger.daily(rows)

        assertThat(groups.map { it.listedOn.dayOfMonth }).containsExactly(3, 1)
        assertThat(groups[0].songs).containsExactly(
            KaraokeSongItemDto("唱", "Ado", "a.jpg", tjNumber = 90170, kyNumber = 57740, songId = 9),
            KaraokeSongItemDto("怪獣", "サカナクション", null, tjNumber = null, kyNumber = 57741, songId = null),
        )
        assertThat(groups[1].songs.single().tjNumber).isEqualTo(90160)
    }

    @Test
    fun `monthly merges across days and groups by artist`() {
        val rows = listOf(
            row(KaraokeVendor.KY, 57741, "怪獣", "サカナクション", 3),
            row(KaraokeVendor.TJ, 90171, "唱", "Ado", 2),
            row(KaraokeVendor.TJ, 90160, "怪獣", "サカナクション", 1),
            row(KaraokeVendor.KY, 57700, "踊", "Ado", 1),
        )

        val monthly = KaraokeSongMerger.monthly(YearMonth.of(2026, 10), rows)

        assertThat(monthly.songCount).isEqualTo(3)
        assertThat(monthly.artists.map { it.artist }).containsExactly("サカナクション", "Ado")
        assertThat(monthly.artists[0].songs.single().let { it.tjNumber to it.kyNumber }).isEqualTo(90160 to 57741)
        assertThat(monthly.artists[1].songs.map { it.title }).containsExactly("唱", "踊")
    }
}
