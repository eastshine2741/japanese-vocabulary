package com.japanese.vocabulary.applemusicrss.dto

import com.japanese.vocabulary.applemusicrss.client.dto.AppleMusicRssGenreDto

data class AppleMusicRssChartSongDto(
    val rank: Int,
    val id: String,
    val name: String,
    val artistName: String,
    val artistId: String?,
    val artistUrl: String?,
    val artworkUrl100: String?,
    val url: String?,
    val releaseDate: String?,
    val genres: List<AppleMusicRssGenreDto>,
)
