package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import java.time.Instant

data class ArtistCardDto(
    val artistId: Long,
    val grade: ArtistCardGrade,
    val seenGrade: ArtistCardGrade?,
    val acquiredSeq: Int,
    val signature: List<String>,
    val createdAt: Instant,
)
