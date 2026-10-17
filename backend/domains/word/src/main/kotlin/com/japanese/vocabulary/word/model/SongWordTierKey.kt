package com.japanese.vocabulary.word.model

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
