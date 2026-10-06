package com.japanese.vocabulary.karaoke.service

import com.japanese.vocabulary.common.text.ArtistNameNormalizer
import com.japanese.vocabulary.karaoke.dto.KaraokeArtistGroupDto
import com.japanese.vocabulary.karaoke.dto.KaraokeDailyGroupDto
import com.japanese.vocabulary.karaoke.dto.KaraokeMonthlyDto
import com.japanese.vocabulary.karaoke.dto.KaraokeSongDto
import com.japanese.vocabulary.karaoke.dto.KaraokeSongItemDto
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import java.time.YearMonth

/**
 * 원장은 노래방별 행이고, 합치는 건 응답에서만 한다.
 * 날짜별은 같은 날 양쪽에 오른 곡만, 월별은 그 달 안에서 합친다.
 */
object KaraokeSongMerger {

    /** [rows] 는 등재일 최신순이어야 한다. */
    fun daily(rows: List<KaraokeSongDto>): List<KaraokeDailyGroupDto> =
        rows.groupBy { it.listedOn }
            .map { (listedOn, sameDay) -> KaraokeDailyGroupDto(listedOn, merge(sameDay)) }

    fun monthly(month: YearMonth, rows: List<KaraokeSongDto>): KaraokeMonthlyDto {
        val songs = merge(rows)
        val artists = songs.groupBy { ArtistNameNormalizer.normalize(it.artist) }
            .values
            .map { KaraokeArtistGroupDto(artist = it.first().artist, songs = it) }
        return KaraokeMonthlyDto(month = month, songCount = songs.size, artists = artists)
    }

    private fun merge(rows: List<KaraokeSongDto>): List<KaraokeSongItemDto> =
        rows.groupBy { KaraokeTitleCleaner.mergeKey(it.title, it.artist) }
            .values
            .map { same ->
                val first = same.first()
                KaraokeSongItemDto(
                    title = first.title,
                    artist = first.artist,
                    artworkUrl = same.firstNotNullOfOrNull { it.artworkUrl },
                    tjNumber = same.firstOrNull { it.vendor == KaraokeVendor.TJ }?.number,
                    kyNumber = same.firstOrNull { it.vendor == KaraokeVendor.KY }?.number,
                    songId = same.firstNotNullOfOrNull { it.songId },
                )
            }
}
