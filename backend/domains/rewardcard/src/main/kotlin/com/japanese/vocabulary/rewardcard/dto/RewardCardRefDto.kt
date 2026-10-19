package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.RewardCardKind

/** 발급된 카드 한 장. [targetId] 는 곡 카드면 songId, 아티스트 카드면 artistId. */
data class RewardCardRefDto(
    val kind: RewardCardKind,
    val cardId: Long,
    val userId: Long,
    val targetId: Long,
)
