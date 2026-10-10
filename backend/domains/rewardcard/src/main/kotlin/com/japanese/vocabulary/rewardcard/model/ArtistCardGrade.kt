package com.japanese.vocabulary.rewardcard.model

/** 선언 순서가 등급 순서다. 위로 갈수록 구간이 넓다. */
enum class ArtistCardGrade(val minMasterCount: Int) {
    BASIC(0), BRONZE(1), SILVER(3), GOLD(7), PLATINUM(15), DIAMOND(30);

    companion object {
        fun forMasterCount(count: Int): ArtistCardGrade = entries.last { count >= it.minMasterCount }
    }
}
