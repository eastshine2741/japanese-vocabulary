package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import java.time.Instant

/** 재질마다 한 장. */
data class ArtistCardResponse(
    val id: Long,
    val artistId: Long,
    val name: String,
    val artworkUrl: String?,
    val grade: ArtistCardGrade,
    val acquiredSeq: Int,
    val signature: List<String>,
    /** false 면 아직 서명 전. */
    val issued: Boolean,
    /** 마스터한 순서대로. 다음 재질 카드가 생기기 전까지의 곡만 — 지난 재질의 카드는 그 재질이던 때의 모습으로 남는다. */
    val masteredSongs: List<MasteredSongResponse>,
    val createdAt: Instant,
)
