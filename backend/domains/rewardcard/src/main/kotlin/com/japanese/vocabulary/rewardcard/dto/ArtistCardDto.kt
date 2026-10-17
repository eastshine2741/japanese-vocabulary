package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import java.time.Instant

data class ArtistCardDto(
    val id: Long,
    val artistId: Long,
    val grade: ArtistCardGrade,
    val acquiredSeq: Int,
    val signature: List<String>,
    val issued: Boolean,
    val createdAt: Instant,
)
