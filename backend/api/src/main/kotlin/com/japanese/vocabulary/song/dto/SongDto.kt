package com.japanese.vocabulary.song.dto

import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.MvUnavailableReason

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
    /** [youtubeUrl] 을 앱에서 재생할 수 없는 이유. 모르면 null 이고, 앱은 플레이어 오류가 나야 알 수 있다. */
    val mvUnavailableReason: MvUnavailableReason? = null,
)
