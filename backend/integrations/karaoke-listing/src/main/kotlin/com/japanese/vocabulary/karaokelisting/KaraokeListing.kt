package com.japanese.vocabulary.karaokelisting

import java.time.LocalDate
import java.time.YearMonth

enum class KaraokeListingVendor { TJ, KY }

/**
 * 노래방 곡 한 줄. 제목·가수는 노래방 표기 그대로다.
 * [listedOn] 은 TJ 만 준다. [lyricLines]·[releaseMonth] 는 금영만 준다(검색 HTML 에 가사 전문이 실려 있다).
 * 금영 출시월은 "N월 신곡" 묶음 이름이라 실제로 카탈로그에 오른 달보다 1~2달 앞선다.
 */
data class KaraokeListing(
    val vendor: KaraokeListingVendor,
    val number: Int,
    val title: String,
    val artist: String,
    val listedOn: LocalDate? = null,
    val lyricLines: List<String> = emptyList(),
    val releaseMonth: YearMonth? = null,
) {
    /** 가나가 들어간 가사 줄의 비율. 금영은 일본곡에 독음·가나·원문 줄을 번갈아 싣는다. */
    val kanaLineRatio: Double
        get() = if (lyricLines.isEmpty()) 0.0 else lyricLines.count { KANA.containsMatchIn(it) }.toDouble() / lyricLines.size

    private companion object {
        val KANA = Regex("[\\u3040-\\u30FF]")
    }
}
