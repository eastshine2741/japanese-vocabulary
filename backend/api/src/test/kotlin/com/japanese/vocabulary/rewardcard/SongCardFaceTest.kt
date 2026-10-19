package com.japanese.vocabulary.rewardcard

import com.japanese.vocabulary.rewardcard.service.SongCardFace
import com.japanese.vocabulary.song.dto.songdetail.SongLyricLineDto
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.dto.songword.WordInSongItemDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SongCardFaceTest {

    private val token = Token(surface = "雨", baseForm = "雨", reading = "アメ", baseFormReading = "アメ", partOfSpeech = PartOfSpeech.NOUN, charStart = 0, charEnd = 1)

    private fun line(index: Int, text: String, ko: String? = "ko", analyzed: Boolean = true) =
        SongLyricLineDto(index = index, originalText = text, startTimeMs = null, koreanLyrics = ko, tokens = if (analyzed) listOf(token) else emptyList())

    @Test
    fun `default lyric is the most repeated line and the next different line`() {
        val lines = listOf(line(0, "A"), line(1, "B"), line(2, "B"), line(3, "B"), line(4, "C"))
        assertThat(SongCardFace.defaultLyric(lines).map { it.index }).containsExactly(1, 4)
    }

    @Test
    fun `default lyric skips lines without translation or analysis`() {
        val lines = listOf(line(0, "A", ko = null), line(1, "B", analyzed = false), line(2, "C"), line(3, " "))
        assertThat(SongCardFace.defaultLyric(lines).map { it.index }).containsExactly(2)
    }

    @Test
    fun `picked lines win over the default and keep song order`() {
        val lines = listOf(line(0, "A"), line(1, "B"), line(2, "B"))
        assertThat(SongCardFace.lyric(lines, listOf(2, 0)).map { it.index }).containsExactly(0, 2)
    }

    private fun word(japanese: String, score: Double, lineIndexes: List<Int>, ko: String? = "ko") = WordInSongItemDto(
        japanese = japanese, surface = japanese, baseForm = japanese, reading = null, koreanText = ko,
        partOfSpeech = "NOUN", partOfSpeechLabel = "NOUN", jlpt = null, importanceScore = score, appearanceOrder = 0,
        frequency = lineIndexes.size, lineIndexes = lineIndexes, isSavedGlobally = false, isSavedForSong = false,
        savedWordId = null, addRequest = AddWordRequest(japanese = japanese),
    )

    @Test
    fun `words come only from the card lines, most important first`() {
        val words = listOf(
            word("雨", 1.0, listOf(0)),
            word("空", 9.0, listOf(3)),
            word("風", 3.0, listOf(2, 5)),
            word("夜", 2.0, listOf(0, 2)),
            word("星", 5.0, listOf(2), ko = null),
        )
        assertThat(SongCardFace.words(words, listOf(0, 2)).map { it.japanese }).containsExactly("風", "夜", "雨")
    }
}
