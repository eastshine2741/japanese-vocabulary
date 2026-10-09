package com.japanese.vocabulary.karaoke.dto

import com.japanese.vocabulary.karaoke.entity.KaraokeSongEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import java.time.LocalDate
import java.time.YearMonth

data class KaraokeSongRegistration(
    val vendor: KaraokeVendor,
    val number: Int,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val durationSeconds: Int?,
    val listedOn: LocalDate,
)

data class KaraokeSongDto(
    val id: Long,
    val vendor: KaraokeVendor,
    val number: Int,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val listedOn: LocalDate,
    val songId: Long?,
)

/** 화면의 한 줄. 같은 곡이 두 노래방에 올라 합쳐졌으면 번호가 둘 다 있다. */
data class KaraokeSongItemDto(
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val tjNumber: Int?,
    val kyNumber: Int?,
    val songId: Long?,
)

data class KaraokeDailyGroupDto(
    val listedOn: LocalDate,
    val songs: List<KaraokeSongItemDto>,
)

data class KaraokeArtistGroupDto(
    val artist: String,
    val songs: List<KaraokeSongItemDto>,
)

data class KaraokeMonthlyDto(
    val month: YearMonth,
    val songCount: Int,
    val artists: List<KaraokeArtistGroupDto>,
)

fun KaraokeSongEntity.toDto() = KaraokeSongDto(
    id = requireNotNull(id),
    vendor = vendor,
    number = number,
    title = title,
    artist = artist,
    artworkUrl = artworkUrl,
    listedOn = listedOn,
    songId = songId,
)
