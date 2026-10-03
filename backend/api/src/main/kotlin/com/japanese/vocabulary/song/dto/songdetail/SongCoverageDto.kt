package com.japanese.vocabulary.song.dto.songdetail

/** 이 곡 이해도. `knownLines / totalLines` 가 이해도다. */
data class SongCoverageDto(
    val songId: Long,
    /** tier 단어가 1개 이상 있는 가사 줄 수. */
    val totalLines: Int,
    /** 그 줄의 tier 단어가 전부 장기기억인 줄 수. */
    val knownLines: Int,
)
