package com.japanese.vocabulary.song.parser

import org.springframework.stereotype.Component

@Component
class LrcParser {

    // lrclib uploads mix centiseconds ("[00:22.67]") and milliseconds ("[00:21.984]").
    private val timestampPattern = Regex("""\[(\d{2,3}):(\d{2})[.:](\d{2,3})](.*)""")

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
            val (minutes, seconds, fraction, text) = match.destructured
            val trimmedText = text.trim()
            if (trimmedText.isBlank()) return@forEach

            parsedLines.add(
                ParsedLyricLine(
                    index = parsedLines.size,
                    startTimeMs = convertToMilliseconds(minutes.toInt(), seconds.toInt(), fraction),
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

    private fun convertToMilliseconds(minutes: Int, seconds: Int, fraction: String): Long {
        val fractionMs = if (fraction.length == 3) fraction.toLong() else fraction.toLong() * 10
        return (minutes * 60 * 1000L) + (seconds * 1000L) + fractionMs
    }
}
