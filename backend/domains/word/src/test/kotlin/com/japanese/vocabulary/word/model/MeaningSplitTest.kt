package com.japanese.vocabulary.word.model

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class MeaningSplitTest {

    @Test
    fun `splits a comma-joined meaning into one meaning per part`() {
        assertThat(splitMeaningText("사랑, 애정")).containsExactly("사랑", "애정")
    }

    @Test
    fun `accepts full-width and japanese commas as separators`() {
        assertThat(splitMeaningText("빛，광선、빛깔")).containsExactly("빛", "광선", "빛깔")
    }

    @Test
    fun `keeps commas inside brackets so a gloss is not cut in half`() {
        assertThat(splitMeaningText("(사람, 물건이) 있다, 존재하다"))
            .containsExactly("(사람, 물건이) 있다", "존재하다")
    }

    @Test
    fun `drops blank parts and duplicates`() {
        assertThat(splitMeaningText(" 빛 ,, 빛 , 광선 ")).containsExactly("빛", "광선")
        assertThat(splitMeaningText("  ")).isEmpty()
    }

    @Test
    fun `each split meaning inherits the part of speech and jlpt, but only the first keeps the examples`() {
        val sense = WordSense(
            meaning = "무겁다, 묵직하다",
            partOfSpeech = "ADJECTIVE",
            jlpt = "N3",
            examples = listOf(SenseExample(text = "重い荷物", translation = null, songId = 1, lineIndex = 0)),
        )

        // 그 가사 줄이 어느 뜻으로 쓰였는지 모른다 — 뒷 조각에 복제하지 않고 비워 둔다.
        assertThat(sense.splitMeanings()).containsExactly(
            sense.copy(meaning = "무겁다"),
            sense.copy(meaning = "묵직하다", examples = emptyList()),
        )
    }

    @Test
    fun `a single meaning keeps its examples`() {
        val sense = WordSense(
            meaning = "무겁다",
            partOfSpeech = "ADJECTIVE",
            examples = listOf(SenseExample(text = "重い荷物", translation = null, songId = 1, lineIndex = 0)),
        )

        assertThat(sense.splitMeanings()).containsExactly(sense)
    }
}
