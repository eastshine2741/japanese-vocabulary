package com.japanese.vocabulary.parser

import org.springframework.stereotype.Component

@Component
class LrcParser {

    private val timestampPattern = Regex("""\[(\d{2}):(\d{2})[.:](\d{2})](.*)""")

    fun parse(lrcContent: String, isSynced: Boolean): List<ParsedLyricLine> {
        val lines = lrcContent.lines()
            .map { it.trim() }
            .filter { it.isNotBlank() }

        return if (isSynced) parseSyncedLyrics(lines) else parsePlainLyrics(lines)
    }

    private fun parseSyncedLyrics(lines: List<String>): List<ParsedLyricLine> {
        val parsedLines = mutableListOf<ParsedLyricLine>()

        lines.forEach { line ->
            val match = timestampPattern.matchEntire(line) ?: return@forEach
            val (minutes, seconds, centiseconds, text) = match.destructured
            val trimmedText = text.trim()
            if (trimmedText.isBlank()) return@forEach

            parsedLines.add(
                ParsedLyricLine(
                    index = parsedLines.size,
                    startTimeMs = convertToMilliseconds(minutes.toInt(), seconds.toInt(), centiseconds.toInt()),
                    text = trimmedText
                )
            )
        }

        return parsedLines
    }

    private fun parsePlainLyrics(lines: List<String>): List<ParsedLyricLine> {
        return lines.mapIndexed { index, line ->
            ParsedLyricLine(index = index, startTimeMs = null, text = line)
        }
    }

    private fun convertToMilliseconds(minutes: Int, seconds: Int, centiseconds: Int): Long {
        return (minutes * 60 * 1000L) + (seconds * 1000L) + (centiseconds * 10L)
    }
}
