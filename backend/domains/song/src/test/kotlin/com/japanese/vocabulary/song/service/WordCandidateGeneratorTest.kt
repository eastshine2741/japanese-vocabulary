package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class WordCandidateGeneratorTest {
    private val generator = WordCandidateGenerator()

    @Test
    fun `generates domain-neutral candidates with exclusions fallbacks and line mappings`() {
        val wordCandidates = generator.generate(
            title = "夜の歌",
            analyzedLines = listOf(
                AnalyzedLine(
                    index = 0,
                    koreanLyrics = null,
                    tokens = listOf(
                        token("夜", "夜", PartOfSpeech.NOUN, baseReading = "よる", korean = "밤", jlpt = "N5"),
                        token("は", "は", PartOfSpeech.PARTICLE),
                    ),
                ),
                AnalyzedLine(
                    index = 1,
                    koreanLyrics = null,
                    tokens = listOf(
                        token("夜", "夜", PartOfSpeech.NOUN, baseReading = "よる", korean = "밤", jlpt = "N5"),
                        token("", "", PartOfSpeech.NOUN),
                        token("走る", "走る", PartOfSpeech.VERB, reading = null, korean = null, jlpt = null),
                    ),
                ),
            ),
        )

        assertThat(wordCandidates.candidates.map { it.japanese }).containsExactly("夜", "走る")
        assertThat(wordCandidates.candidates.first { it.japanese == "夜" }.lineIndexes).containsExactly(0, 1)
        assertThat(wordCandidates.candidates.first { it.japanese == "夜" }.baseFormReading).isEqualTo("よる")
        assertThat(wordCandidates.candidates.first { it.japanese == "走る" }.reading).isNull()
        assertThat(wordCandidates.lineCandidates["0"]).containsExactly(0)
        assertThat(wordCandidates.lineCandidates["1"]).containsExactly(0, 1)
    }

    @Test
    fun `line candidates follow in-line appearance order, not importance`() {
        val wordCandidates = generator.generate(
            title = "無題",
            analyzedLines = listOf(
                // 夢 은 이 줄에만 나와 중요도가 낮지만, 줄 안에서는 星 보다 앞이다.
                AnalyzedLine(
                    index = 0,
                    koreanLyrics = null,
                    tokens = listOf(
                        token("夢", "夢", PartOfSpeech.NOUN, korean = "꿈"),
                        token("星", "星", PartOfSpeech.NOUN, korean = "별"),
                    ),
                ),
                AnalyzedLine(index = 1, koreanLyrics = null, tokens = listOf(token("星", "星", PartOfSpeech.NOUN, korean = "별"))),
                AnalyzedLine(index = 2, koreanLyrics = null, tokens = listOf(token("星", "星", PartOfSpeech.NOUN, korean = "별"))),
            ),
        )

        val byIndex = wordCandidates.candidates
        assertThat(byIndex.first { it.japanese == "星" }.importanceScore)
            .isGreaterThan(byIndex.first { it.japanese == "夢" }.importanceScore)
        assertThat(byIndex.map { it.japanese }).containsExactly("夢", "星")
        assertThat(wordCandidates.lineCandidates.getValue("0").map { byIndex[it].japanese })
            .containsExactly("夢", "星")
    }

    private fun token(
        surface: String,
        base: String,
        pos: PartOfSpeech,
        reading: String? = "r",
        baseReading: String? = null,
        korean: String? = "k",
        jlpt: String? = "N5",
    ) = Token(
        surface = surface,
        baseForm = base,
        reading = reading,
        baseFormReading = baseReading,
        partOfSpeech = pos,
        charStart = 0,
        charEnd = surface.length,
        koreanText = korean,
        jlpt = jlpt,
    )
}
