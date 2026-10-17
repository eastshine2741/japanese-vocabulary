package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.SongCardGrade

/** rating 이 잰 곡 하나의 등급. 이 등급까지 아직 없는 등급의 카드를 새로 발급한다. */
data class SongAchievementDto(
    val songId: Long,
    val artistId: Long?,
    val grade: SongCardGrade,
)
