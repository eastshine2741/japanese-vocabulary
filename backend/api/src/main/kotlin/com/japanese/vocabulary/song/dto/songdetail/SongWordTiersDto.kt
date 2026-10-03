package com.japanese.vocabulary.song.dto.songdetail

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

/**
 * 곡 상세의 단계. 응답에는 [current] 3단계만 나간다. 핵심·입문·기초·심화 4단계는 구버전 앱이
 * `POST .../word-tiers/{key}/study` 로 보낼 수 있어 남겨 둔다.
 */
enum class SongWordTierKey(
    val order: Int,
    val displayName: String,
    val description: String,
    val legacy: Boolean,
) {
    CORE(1, "핵심", "후렴에서 반복되는 중요 단어예요", legacy = true),
    STARTER(2, "입문", "어느 곡에서나 나오는 쉬운 단어", legacy = true),
    BASIC(3, "기초", "이 곡에 등장하는 쉬운 단어", legacy = true),
    ADVANCED(4, "심화", "여기까지 알면 완전히 마스터해요!", legacy = true),
    CHORUS(1, "후렴 정복", "후렴에 나오는 핵심 단어 {n}개부터 공부해요", legacy = false),
    SINGALONG(2, "따라 부르기", "자주 나오는 단어까지 알면 흥얼거리며 부를 수 있어요", legacy = false),
    FULL(3, "완곡", "여기까지 알면 이 곡을 완전히 마스터해요!", legacy = false),
    ;

    fun description(wordCount: Int): String = description.replace("{n}", wordCount.toString())

    companion object {
        val current: List<SongWordTierKey> = entries.filterNot { it.legacy }.sortedBy { it.order }
        val legacyKeys: List<SongWordTierKey> = entries.filter { it.legacy }.sortedBy { it.order }
    }
}
