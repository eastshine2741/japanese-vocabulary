package com.japanese.vocabulary.song.dto.songdetail

data class SongWordTiersDto(
    val songId: Long,
    /** 항상 4개, `order` 오름차순. 단어가 없는 곡도 빈 단계 4개를 준다. */
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
    /** 이 단계 단어 중 유저가 이미 익힌(mastered) 것. 다른 곡에서 담았어도 같은 단어면 센다. */
    val knownCount: Int,
    /** 이 단계 단어 중 복습 진행 중(studying)인 것. */
    val learningCount: Int,
)

enum class SongWordTierKey(val order: Int, val displayName: String, val description: String) {
    CORE(1, "핵심", "이 곡 후렴에서 계속 나와요"),
    STARTER(2, "입문", "일본 노래면 어디서나 나와요"),
    BASIC(3, "기초", "이 곡의 쉬운 단어들이에요"),
    ADVANCED(4, "심화", "알면 더 깊이 들려요"),
}
