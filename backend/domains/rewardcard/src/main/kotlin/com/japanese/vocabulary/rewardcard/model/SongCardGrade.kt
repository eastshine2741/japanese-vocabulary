package com.japanese.vocabulary.rewardcard.model

/** 선언 순서가 등급 순서다. 기본~GOLD 는 앞에서부터 끝낸 단계 수, MASTER 는 완곡 뒤 장기기억 목표. */
enum class SongCardGrade {
    BASIC, BRONZE, SILVER, GOLD, MASTER;

    companion object {
        fun ofCompletedTiers(count: Int): SongCardGrade = entries[count.coerceIn(0, GOLD.ordinal)]

        /** [grade] 까지 카드로 나오는 등급. BASIC 은 기존 행 호환용이라 새로 만들지 않는다 — 첫 rating 에 연출이 끼어들면 첫 세션이 끊긴다. */
        fun cardsUpTo(grade: SongCardGrade): List<SongCardGrade> = entries.filter { it in BRONZE..grade }
    }
}
