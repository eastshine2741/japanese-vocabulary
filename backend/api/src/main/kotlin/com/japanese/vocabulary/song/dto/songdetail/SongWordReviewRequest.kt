package com.japanese.vocabulary.song.dto.songdetail

data class SongWordReviewRequest(
    /** [SongStudyCardDto.japanese] 그대로. */
    val japanese: String,
    val rating: Int,
)
