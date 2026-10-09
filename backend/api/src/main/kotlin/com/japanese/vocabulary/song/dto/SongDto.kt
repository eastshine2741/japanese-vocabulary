package com.japanese.vocabulary.song.dto

import com.japanese.vocabulary.song.entity.LyricType

data class SongDto(
    val id: Long,
    val title: String,
    val artist: String,
    val durationSeconds: Int?,
    val artworkUrl: String?,
    val youtubeUrl: String?,
    val lyricType: LyricType,
    /** 아티스트 상세로 가는 링크. 아직 아티스트를 잇지 못한 곡은 null. */
    val artistId: Long? = null,
)
