package com.japanese.vocabulary.rewardcard.dto

data class RewardCardsResponse(
    /** 최근 획득순. */
    val songCards: List<SongCardResponse>,
    val artistCards: List<ArtistCardResponse>,
    val songGradeRule: SongGradeRuleResponse,
)

/** 곡 카드 등급 조건. 곡마다 같아 카드마다 싣지 않는다. */
data class SongGradeRuleResponse(
    /** BRONZE 부터 GOLD 까지 등급 순서대로, 끝내야 하는 곡 상세 단계 이름. */
    val tierNames: List<String>,
    /** MASTER: tier 단어 중 장기기억 비율(%). */
    val masterPercent: Int,
)
