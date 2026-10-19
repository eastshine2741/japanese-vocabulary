package com.japanese.vocabulary.rewardcard.model

/** 선언 순서가 등급 순서다. 기본~GOLD 는 앞에서부터 끝낸 단계 수, MASTER 는 완곡 뒤 장기기억 목표. */
enum class SongCardGrade {
    BASIC, BRONZE, SILVER, GOLD, MASTER;

    companion object {
        fun ofCompletedTiers(count: Int): SongCardGrade = entries[count.coerceIn(0, GOLD.ordinal)]
    }
}
