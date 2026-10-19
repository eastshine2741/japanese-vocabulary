package com.japanese.vocabulary.rewardcard.model

/**
 * 선언 순서가 등급 순서다. 그 아티스트 MASTER 곡 카드 수로만 정한다. 위로 갈수록 구간이 넓어
 * 곡이 적은 아티스트도 아래 단계는 금방 닿고, 곡이 많은 아티스트의 팬에게도 위가 남는다.
 */
enum class ArtistCardGrade(val minMasterCount: Int) {
    BASIC(0), BRONZE(1), SILVER(3), GOLD(7), PLATINUM(15), DIAMOND(30);

    val next: ArtistCardGrade? get() = entries.getOrNull(ordinal + 1)

    companion object {
        fun forMasterCount(count: Int): ArtistCardGrade = entries.last { count >= it.minMasterCount }
    }
}
