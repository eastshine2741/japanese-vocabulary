package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.SongCardGrade

/** rating 이 잰 곡 하나의 등급. 카드가 없으면 이 등급으로 만들고, 있으면 여기까지 올린다. */
data class SongAchievementDto(
    val songId: Long,
    val artistId: Long?,
    val grade: SongCardGrade,
)
