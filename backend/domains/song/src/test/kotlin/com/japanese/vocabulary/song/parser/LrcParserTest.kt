package com.japanese.vocabulary.song.parser

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class LrcParserTest {

    private val parser = LrcParser()

    @Test
    fun `centisecond and millisecond timestamps both parse`() {
        val lines = parser.parse("[00:22.67] 相槌\n[00:21.984] 借りた本を片手に持って", isSynced = true)

        assertThat(lines.map { it.startTimeMs }).containsExactly(22_670L, 21_984L)
        assertThat(lines.map { it.text }).containsExactly("相槌", "借りた本を片手に持って")
    }

    @Test
    fun `lrclib shapes with an empty first stamp and no space after the bracket parse`() {
        val lrc = "[00:00.000]\n[00:00.640]赤く染まる信号機はひとりぼっち\n[00:05.210]僕のこころのように\n[00:14.879]\n[100:01.50] 長い曲"

        val lines = parser.parse(lrc, isSynced = true)

        assertThat(lines.map { it.text }).containsExactly("赤く染まる信号機はひとりぼっち", "僕のこころのように", "長い曲")
        assertThat(lines.map { it.startTimeMs }).containsExactly(640L, 5_210L, 6_001_500L)
        assertThat(lines.map { it.index }).containsExactly(0, 1, 2)
    }
}
