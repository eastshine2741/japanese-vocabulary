package com.japanese.vocabulary.song.songdetail

import com.japanese.vocabulary.song.dto.songdetail.SongWordStageKey
import com.japanese.vocabulary.song.dto.songdetail.WordInSongItemDto
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.service.songdetail.SongWordStageClassifier
import com.japanese.vocabulary.word.dto.AddWordRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SongWordStageClassifierTest {

    private fun word(
        japanese: String,
        score: Double,
        order: Int,
        lineIndexes: List<Int>,
        jlpt: String? = "N3",
        pos: String = "NOUN",
    ) = WordInSongItemDto(
        japanese = japanese,
        surface = japanese,
        baseForm = japanese,
        reading = null,
        koreanText = null,
        partOfSpeech = pos,
        partOfSpeechLabel = pos,
        jlpt = jlpt,
        importanceScore = score,
        appearanceOrder = order,
        frequency = lineIndexes.size,
        lineIndexes = lineIndexes,
        isSavedGlobally = false,
        isSavedForSong = false,
        savedWordId = null,
        addRequest = AddWordRequest(japanese = japanese, reading = null, senses = emptyList(), songId = 1),
    )

    private fun lines(vararg texts: String) = texts.mapIndexed { i, t -> LyricLineData(index = i, startTimeMs = null, text = t) }

    private fun Map<SongWordStageKey, List<WordInSongItemDto>>.names(key: SongWordStageKey) = getValue(key).map { it.japanese }

    @Test
    fun `every word lands in exactly one stage`() {
        val words = listOf(
            word("胸", 90.0, 0, listOf(0, 2)),
            word("する", 80.0, 1, listOf(0, 1), pos = "VERB"),
            word("雨", 50.0, 2, listOf(1), jlpt = "N5"),
            word("輪郭", 40.0, 3, listOf(3), jlpt = null),
        )
        val stages = SongWordStageClassifier.classify(words, lines("胸する", "する雨", "胸", "輪郭"))

        assertThat(stages.values.flatten().map { it.japanese }).containsExactlyInAnyOrder("胸", "する", "雨", "輪郭")
        assertThat(stages.names(SongWordStageKey.CORE)).containsExactly("胸")
        assertThat(stages.names(SongWordStageKey.STARTER)).containsExactly("する")
        assertThat(stages.names(SongWordStageKey.BASIC)).containsExactly("雨")
        assertThat(stages.names(SongWordStageKey.ADVANCED)).containsExactly("輪郭")
    }

    @Test
    fun `core takes chorus-line and repeated words by importance, capped at ten, and never common words`() {
        // 0·2 번 줄이 후렴(같은 텍스트 두 번).
        val raw = lines("後렴", "절", "後렴", "절2")
        val chorusWords = (1..12).map { word("후렴$it", 100.0 - it, it, listOf(0)) }
        val words = chorusWords +
            word("반복", 200.0, 20, listOf(1, 3)) +
            word("한번", 300.0, 21, listOf(1)) +
            word("いる", 500.0, 22, listOf(0, 2), pos = "VERB")

        val stages = SongWordStageClassifier.classify(words, raw)

        val core = stages.names(SongWordStageKey.CORE)
        assertThat(core).hasSize(SongWordStageClassifier.CORE_SIZE)
        // 중요도 순: 두 줄에 나오는 "반복" 이 맨 앞, 이어서 후렴 단어 상위 9개.
        assertThat(core).startsWith("반복", "후렴1")
        assertThat(core).doesNotContain("한번", "いる")
        assertThat(stages.names(SongWordStageKey.STARTER)).containsExactly("いる")
        // 한 줄에만 나오는 단어는 아무리 중요도가 높아도 핵심이 아니다.
        assertThat(stages.names(SongWordStageKey.ADVANCED)).contains("한번")
    }

    @Test
    fun `when the chorus dominates the lyric, core ranks by frequency before importance`() {
        // 4줄 중 3줄이 같은 텍스트 → 후렴 비율 0.75.
        val raw = lines("A", "A", "A", "B")
        val words = listOf(
            word("점수높음", 99.0, 0, listOf(0)),
            word("여러번", 10.0, 1, listOf(0, 1, 2)),
            word("두번", 50.0, 2, listOf(1, 3)),
        )
        val core = SongWordStageClassifier.classify(words, raw).names(SongWordStageKey.CORE)
        assertThat(core).containsExactly("여러번", "두번", "점수높음")
    }

    @Test
    fun `basic is decided by jlpt tag only and unknown jlpt goes to advanced`() {
        val words = listOf(
            word("N5어", 10.0, 0, listOf(0), jlpt = "N5"),
            word("N4어", 10.0, 1, listOf(0), jlpt = "N4"),
            word("N3어", 10.0, 2, listOf(0), jlpt = "N3"),
            word("N1어", 10.0, 3, listOf(0), jlpt = "N1"),
            word("미분류", 10.0, 4, listOf(0), jlpt = null),
        )
        val stages = SongWordStageClassifier.classify(words, lines("한줄"))
        assertThat(stages.names(SongWordStageKey.CORE)).isEmpty()
        assertThat(stages.names(SongWordStageKey.BASIC)).containsExactly("N5어", "N4어")
        assertThat(stages.names(SongWordStageKey.ADVANCED)).containsExactly("N3어", "N1어", "미분류")
    }

    @Test
    fun `non-core stages keep appearance order`() {
        val words = listOf(
            word("늦게", 99.0, 5, listOf(0), jlpt = "N5"),
            word("먼저", 1.0, 0, listOf(0), jlpt = "N5"),
        )
        assertThat(SongWordStageClassifier.classify(words, lines("x")).names(SongWordStageKey.BASIC))
            .containsExactly("먼저", "늦게")
    }

    @Test
    fun `empty input yields four empty stages`() {
        val stages = SongWordStageClassifier.classify(emptyList(), emptyList())
        assertThat(stages.keys).containsExactlyInAnyOrder(*SongWordStageKey.entries.toTypedArray())
        assertThat(stages.values).allSatisfy { assertThat(it).isEmpty() }
    }
}
