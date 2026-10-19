package com.japanese.vocabulary.featureflag

/** 코드가 읽는 플래그 키. 행이 없으면 꺼짐이라 여기 더하고 배포한 뒤 관리자 화면에서 시각을 넣는다. */
object FeatureFlagKeys {
    /** 보상 카드 출시: 장기기억 기준 14일과 rating 때 카드 달성. 꺼져 있으면 구클라가 보던 7일 기준 그대로다. */
    const val REWARD_CARD = "reward-card"
}
