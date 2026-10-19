package com.japanese.vocabulary.song.model

import com.fasterxml.jackson.annotation.JsonInclude

/** 승인하며 실제로 바꾼 필드 하나. [before]/[after] 는 필드 값 그대로의 JSON 이다(토큰 교체면 토큰 목록). */
data class SongReportChange(
    val field: String,
    val locator: SongReportChangeLocator,
    val before: Any?,
    val after: Any?,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class SongReportChangeLocator(
    val songId: Long? = null,
    val lyricId: Long? = null,
    val lineIndex: Int? = null,
    val charStart: Int? = null,
    val charEnd: Int? = null,
)
