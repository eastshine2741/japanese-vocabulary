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
    CORE(1, "핵심", "후렴에서 반복되는 중요 단어예요"),
    STARTER(2, "입문", "어느 곡에서나 나오는 쉬운 단어"),
    BASIC(3, "기초", "이 곡에 등장하는 쉬운 단어"),
    ADVANCED(4, "심화", "여기까지 알면 완전히 마스터해요!"),
}
