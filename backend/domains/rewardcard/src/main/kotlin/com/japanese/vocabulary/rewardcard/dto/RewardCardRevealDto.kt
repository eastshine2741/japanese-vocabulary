package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.RewardCardKind

/**
 * 띄울 연출 하나. 곡 카드는 등급마다 따로라 늘 획득(봉투·서명)이고 [cardId] 가 그 등급의 카드다.
 * 아티스트 카드는 한 장이라 [fromGrade] 가 null 이면 획득, 아니면 그 등급에서 [grade] 로 오르는 강화다.
 * 곡 카드는 [targetId] 가 songId, 아티스트 카드는 artistId.
 */
data class RewardCardRevealDto(
    val kind: RewardCardKind,
    val cardId: Long,
    val targetId: Long,
    val grade: String,
    /** 곡 카드는 등급별 획득 순번, 아티스트 카드는 팬 번호(기본 카드는 null). */
    val acquiredSeq: Int?,
    val fromGrade: String? = null,
)
