package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.song.dto.songdetail.SongWordTierKey
import com.japanese.vocabulary.song.dto.songdetail.WordInSongItemDto
import com.japanese.vocabulary.song.model.CommonWords
import com.japanese.vocabulary.song.model.LyricLineData

/**
 * 곡의 단어를 핵심 → 입문 → 기초 → 심화 4단계로 나눈다. 한 단어는 정확히 한 단계에 들어간다.
 *
 * 곡 밖 데이터(코퍼스 빈도)는 쓰지 않는다 — 입문은 고정 목록([CommonWords]), 기초는 JLPT 태그만 본다.
 * jisho JLPT 는 쉬운 단어를 N1·미분류로 찍는 쪽으로만 틀리고 어려운 단어를 N5·N4 로 찍지는 않으므로,
 * "N5·N4 면 기초" 는 안전하다. 새는 쪽은 심화이고 심화는 원래 나머지 전부다.
 *
 * 순서: 핵심을 먼저 뽑고 남은 것을 입문 → 기초 → 심화로 나눈다. 핵심은 개수 상한 없이 조건을 만족하는 단어 전부다.
 */
object SongWordTierClassifier {
    /** 후렴 줄이 가사의 이 비율을 넘으면 "후렴에 나온다" 는 기준이 무의미해져 등장 횟수 우선으로 뽑는다. */
    private const val CHORUS_DOMINANT_RATIO = 0.5

    private val BASIC_JLPT = setOf("N5", "N4")

    /**
     * 현재 3단계. 4단계를 그대로 묶는다 — 후렴 정복 = 핵심, 따라 부르기 = 입문 + 기초(등장순), 완곡 = 심화.
     */
    fun classifyCurrent(words: List<WordInSongItemDto>, rawLines: List<LyricLineData>): Map<SongWordTierKey, List<WordInSongItemDto>> {
        val legacy = classify(words, rawLines)
        return mapOf(
            SongWordTierKey.CHORUS to legacy.getValue(SongWordTierKey.CORE),
            SongWordTierKey.SINGALONG to (legacy.getValue(SongWordTierKey.STARTER) + legacy.getValue(SongWordTierKey.BASIC))
                .sortedWith(BY_APPEARANCE),
            SongWordTierKey.FULL to legacy.getValue(SongWordTierKey.ADVANCED),
        )
    }

    /** 구버전 4단계(핵심·입문·기초·심화). */
    fun classify(words: List<WordInSongItemDto>, rawLines: List<LyricLineData>): Map<SongWordTierKey, List<WordInSongItemDto>> {
        val chorusLines = chorusLineIndexes(rawLines)
        val chorusRatio = if (rawLines.isEmpty()) 0.0 else chorusLines.size.toDouble() / rawLines.size
        val remaining = words.toMutableList()

        fun take(order: Comparator<WordInSongItemDto>, predicate: (WordInSongItemDto) -> Boolean): List<WordInSongItemDto> {
            val picked = remaining.filter(predicate).sortedWith(order)
            remaining.removeAll(picked)
            return picked
        }

        // 후렴 줄에 나오거나 두 줄 이상에 나오는 단어. 뼈대 단어는 곡의 특징이 아니라 뺀다.
        val coreOrder = if (chorusRatio > CHORUS_DOMINANT_RATIO) {
            compareByDescending<WordInSongItemDto> { it.frequency }.then(SongDetailQueryService.IMPORTANCE_RANKING)
        } else {
            SongDetailQueryService.IMPORTANCE_RANKING
        }
        val core = take(coreOrder) { word ->
            !isCommon(word) && (word.frequency >= 2 || word.lineIndexes.any { it in chorusLines })
        }
        val starter = take(BY_APPEARANCE) { isCommon(it) }
        val basic = take(BY_APPEARANCE) { it.jlpt in BASIC_JLPT }
        val advanced = take(BY_APPEARANCE) { true }

        return mapOf(
            SongWordTierKey.CORE to core,
            SongWordTierKey.STARTER to starter,
            SongWordTierKey.BASIC to basic,
            SongWordTierKey.ADVANCED to advanced,
        )
    }

    /** 같은 텍스트가 두 번 이상 나오는 줄 = 후렴. 공백만 있는 줄은 세지 않는다. */
    private fun chorusLineIndexes(rawLines: List<LyricLineData>): Set<Int> {
        val occurrences = rawLines.map { it.text.trim() }.filter { it.isNotEmpty() }.groupingBy { it }.eachCount()
        return rawLines.filter { occurrences.getOrDefault(it.text.trim(), 0) >= 2 }.map { it.index }.toSet()
    }

    private fun isCommon(word: WordInSongItemDto) = CommonWords.contains(word.japanese, word.partOfSpeech)

    private val BY_APPEARANCE = compareBy<WordInSongItemDto> { it.appearanceOrder }.thenBy { it.japanese }
}
