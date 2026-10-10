package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.RewardCardKind

/**
 * 띄울 연출 하나. [seenGrade] 가 null 이면 획득(봉투·서명), 아니면 [seenGrade] 에서 [grade] 로 오르는 연출이다.
 * 곡 카드는 [targetId] 가 songId, 아티스트 카드는 artistId.
 */
data class RewardCardRevealDto(
    val kind: RewardCardKind,
    val targetId: Long,
    val grade: String,
    val seenGrade: String?,
    val acquiredSeq: Int,
)
