package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import java.time.Instant

data class SongCardDto(
    val id: Long,
    val songId: Long,
    val artistId: Long?,
    val grade: SongCardGrade,
    val acquiredSeq: Int,
    val lyricLineIndexes: List<Int>,
    val signature: List<String>,
    val issued: Boolean,
    val createdAt: Instant,
)
