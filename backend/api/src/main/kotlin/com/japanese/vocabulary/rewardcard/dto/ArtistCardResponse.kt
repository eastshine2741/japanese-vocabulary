package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import java.time.Instant

/** 아티스트마다 한 장. 등급은 마스터 곡이 늘면 오른다. */
data class ArtistCardResponse(
    val id: Long,
    val artistId: Long,
    val name: String,
    val artworkUrl: String?,
    val grade: ArtistCardGrade,
    /** 몇 번째 팬인지. BRONZE 에 닿을 때 매기고, 기본 카드는 null. */
    val fanNo: Int?,
    val signature: List<String>,
    /** false 면 아직 서명 전. */
    val issued: Boolean,
    /** 마스터한 순서대로 전부. */
    val masteredSongs: List<MasteredSongResponse>,
    val createdAt: Instant,
)
