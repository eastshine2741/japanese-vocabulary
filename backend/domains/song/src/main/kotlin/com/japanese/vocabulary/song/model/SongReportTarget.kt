package com.japanese.vocabulary.song.model

import com.fasterxml.jackson.annotation.JsonInclude

/** 유저가 고른 위치. [surface] 는 유저가 아니라 서버가 제보 시점의 토큰에서 채운다. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class SongReportTarget(
    val lineIndex: Int? = null,
    val charStart: Int? = null,
    val charEnd: Int? = null,
    val surface: String? = null,
)
