package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.word.model.SongWordTierKey

data class SongWordTiersDto(
    val songId: Long,
    /** 항상 [SongWordTierKey.current] 3개, `order` 오름차순. 단어가 없는 곡도 빈 단계 3개를 준다. */
    val tiers: List<SongWordTierDto>,
)

data class SongWordTierDto(
    val key: SongWordTierKey,
    val order: Int,
    val name: String,
    val description: String,
    /** `GET /api/songs/{id}/words` 의 `words[].japanese` 와 같은 키. */
    val wordJapanese: List<String>,
    val totalCount: Int,
    /** 구버전 앱의 현재 단계 판정용. mastered(FSRS REVIEW) 수. 다른 곡에서 담았어도 같은 단어면 센다. */
    val knownCount: Int,
    /** 구버전 앱용. studying 수. */
    val learningCount: Int,
    /** 장기기억 — stability 가 [com.japanese.vocabulary.flashcard.model.FlashcardMemory.LONG_TERM_STABILITY_DAYS] 이상인 리뷰 경험 단어. */
    val longTermCount: Int,
    /** 단기기억 — 리뷰 경험은 있으나 장기기억이 아닌 단어. */
    val shortTermCount: Int,
    /** 지금 학습할 단어 수 = 한 번도 리뷰 안 한 단어 + due 가 지난 단어. 단계 학습이 여는 카드 수와 같다. */
    val dueCount: Int,
    /** due 단어를 카드 순서대로 놓은 앞 3개의 `japanese`. */
    val duePreviewWords: List<String>,
)
