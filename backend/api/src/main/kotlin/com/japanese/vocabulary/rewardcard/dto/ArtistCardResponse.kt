package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import java.time.Instant

data class ArtistCardResponse(
    val artistId: Long,
    val name: String,
    val artworkUrl: String?,
    val grade: ArtistCardGrade,
    val seenGrade: ArtistCardGrade?,
    val acquiredSeq: Int,
    val signature: List<String>,
    /** 마스터한 곡 전부, 마스터한 순서대로. */
    val masteredSongs: List<MasteredSongResponse>,
    val createdAt: Instant,
)
