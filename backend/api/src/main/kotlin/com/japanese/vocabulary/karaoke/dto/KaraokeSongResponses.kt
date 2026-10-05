package com.japanese.vocabulary.karaoke.dto

import java.time.LocalDate

data class KaraokeSongItemResponse(
    val title: String,
    val artist: String,
    val artworkUrl: String?,
    val tjNumber: Int?,
    val kyNumber: Int?,
    /** 분석이 끝난 곡만 있다. 없으면 곡 상세로 들어갈 수 없다. */
    val songId: Long?,
)

data class KaraokeDailyGroupResponse(
    val listedOn: LocalDate,
    val songs: List<KaraokeSongItemResponse>,
)

data class KaraokeArtistGroupResponse(
    val artist: String,
    val songs: List<KaraokeSongItemResponse>,
)

data class KaraokeMonthlyResponse(
    /** YYYY-MM */
    val month: String,
    val songCount: Int,
    val artists: List<KaraokeArtistGroupResponse>,
)

fun KaraokeSongItemDto.toResponse() = KaraokeSongItemResponse(title, artist, artworkUrl, tjNumber, kyNumber, songId)

fun KaraokeDailyGroupDto.toResponse() = KaraokeDailyGroupResponse(listedOn, songs.map { it.toResponse() })

fun KaraokeMonthlyDto.toResponse() = KaraokeMonthlyResponse(
    month = month.toString(),
    songCount = songCount,
    artists = artists.map { group -> KaraokeArtistGroupResponse(group.artist, group.songs.map { it.toResponse() }) },
)
