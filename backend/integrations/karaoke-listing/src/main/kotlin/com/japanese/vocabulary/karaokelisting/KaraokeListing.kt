package com.japanese.vocabulary.karaokelisting

import java.time.LocalDate

enum class KaraokeListingVendor { TJ, KY }

/**
 * 노래방 신곡 목록의 한 줄. 제목·가수는 노래방 표기 그대로다.
 * [listedOn] 은 TJ 만 준다. [lyricLines] 는 금영만 준다(목록 HTML 에 가사 전문이 실려 있다).
 */
data class KaraokeListing(
    val vendor: KaraokeListingVendor,
    val number: Int,
    val title: String,
    val artist: String,
    val listedOn: LocalDate? = null,
    val lyricLines: List<String> = emptyList(),
) {
    /** 가나가 들어간 가사 줄의 비율. 금영은 일본곡에 독음·가나·원문 줄을 번갈아 싣는다. */
    val kanaLineRatio: Double
        get() = if (lyricLines.isEmpty()) 0.0 else lyricLines.count { KANA.containsMatchIn(it) }.toDouble() / lyricLines.size

    private companion object {
        val KANA = Regex("[\\u3040-\\u30FF]")
    }
}
