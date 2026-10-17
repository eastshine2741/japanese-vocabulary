package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.RewardCardKind

/**
 * 띄울 획득 연출(봉투·서명) 하나. 등급마다 카드가 따로라 [cardId] 가 그 등급의 카드다.
 * 곡 카드는 [targetId] 가 songId, 아티스트 카드는 artistId.
 */
data class RewardCardRevealDto(
    val kind: RewardCardKind,
    val cardId: Long,
    val targetId: Long,
    val grade: String,
    val acquiredSeq: Int,
)
