package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.SongEditOp
import com.japanese.vocabulary.song.model.SongReportChange
import com.japanese.vocabulary.song.model.SongReportChangeLocator
import com.japanese.vocabulary.song.model.Token
import org.springframework.stereotype.Component

data class SongEditResult(
    val youtubeUrl: String?,
    val rawContent: List<LyricLineData>?,
    val analyzedContent: List<AnalyzedLine>?,
    val lyricChanged: Boolean,
    val changes: List<SongReportChange>,
)

/**
 * 엔티티를 건드리지 않고 사본에 수정을 차례로 적용한다. 하나라도 어긋나면 IllegalArgumentException 이고
 * 호출자는 아무것도 반영하지 않는다.
 */
@Component
class SongEditApplier {
    fun apply(song: SongEntity, lyric: LyricEntity?, ops: List<SongEditOp>): SongEditResult {
        var youtubeUrl = song.youtubeUrl
        val raw = lyric?.rawContent?.toMutableList()
        val analyzed = lyric?.analyzedContent?.toMutableList()
        val tokenLines = mutableSetOf<Int>()
        var lyricChanged = false
        val changes = mutableListOf<SongReportChange>()

        for (op in ops) {
            when (op) {
                is SongEditOp.SetYoutubeUrl -> {
                    val next = op.value?.takeIf { it.isNotBlank() }?.let(::normalizeYoutubeUrl)
                    changes += SongReportChange("song.youtubeUrl", SongReportChangeLocator(songId = song.id), youtubeUrl, next)
                    youtubeUrl = next
                }
                is SongEditOp.SetLineText -> {
                    val lines = requireNotNull(raw) { "song has no active lyric" }
                    val at = rawPosition(lines, op.lineIndex)
                    changes += SongReportChange("lyric.line.text", lineLocator(lyric, op.lineIndex), lines[at].text, op.value)
                    lines[at] = lines[at].copy(text = op.value)
                    tokenLines += op.lineIndex
                    lyricChanged = true
                }
                is SongEditOp.SetLineTranslation -> {
                    val lines = requireNotNull(analyzed) { "lyric has no analyzed content" }
                    val at = analyzedPosition(lines, op.lineIndex)
                    val next = op.value?.trim()?.takeIf { it.isNotEmpty() }
                    changes += SongReportChange("lyric.line.koreanLyrics", lineLocator(lyric, op.lineIndex), lines[at].koreanLyrics, next)
                    lines[at] = lines[at].copy(koreanLyrics = next)
                    lyricChanged = true
                }
                is SongEditOp.SetTokenReading -> {
                    val next = op.value?.trim()?.takeIf { it.isNotEmpty() }?.let(::toKatakana)
                    editToken(analyzed, op.lineIndex, op.charStart, op.charEnd) { it.copy(reading = next) }.let { before ->
                        changes += SongReportChange("lyric.token.reading", tokenLocator(lyric, op.lineIndex, op.charStart, op.charEnd), before.reading, next)
                    }
                    tokenLines += op.lineIndex
                    lyricChanged = true
                }
                is SongEditOp.SetTokenMeaning -> {
                    val next = op.value?.trim()?.takeIf { it.isNotEmpty() }
                    editToken(analyzed, op.lineIndex, op.charStart, op.charEnd) { it.copy(koreanText = next) }.let { before ->
                        changes += SongReportChange("lyric.token.koreanText", tokenLocator(lyric, op.lineIndex, op.charStart, op.charEnd), before.koreanText, next)
                    }
                    tokenLines += op.lineIndex
                    lyricChanged = true
                }
                is SongEditOp.ReplaceLineTokens -> {
                    val lines = requireNotNull(analyzed) { "lyric has no analyzed content" }
                    val at = analyzedPosition(lines, op.lineIndex)
                    val next = op.tokens.map { it.copy(reading = it.reading?.let(::toKatakana), baseFormReading = it.baseFormReading?.let(::toKatakana)) }
                    changes += SongReportChange("lyric.line.tokens", lineLocator(lyric, op.lineIndex), lines[at].tokens, next)
                    lines[at] = lines[at].copy(tokens = next)
                    tokenLines += op.lineIndex
                    lyricChanged = true
                }
            }
        }

        for (lineIndex in tokenLines) {
            verifyTokens(raw.orEmpty(), analyzed.orEmpty(), lineIndex)
        }
        return SongEditResult(youtubeUrl, raw, analyzed, lyricChanged, changes)
    }

    /** 토큰 위치는 가사 원문 줄 텍스트의 UTF-16 오프셋이다. 앱·어드민도 같은 오프셋으로 줄 읽기를 조립한다. */
    private fun verifyTokens(raw: List<LyricLineData>, analyzed: List<AnalyzedLine>, lineIndex: Int) {
        val tokens = analyzed.firstOrNull { it.index == lineIndex }?.tokens ?: return
        val text = raw.firstOrNull { it.index == lineIndex }?.text
            ?: throw IllegalArgumentException("line $lineIndex has tokens but no raw text")
        var cursor = 0
        for (token in tokens) {
            require(token.charStart >= cursor && token.charStart < token.charEnd && token.charEnd <= text.length) {
                "line $lineIndex: token ${token.surface}[${token.charStart},${token.charEnd}) is out of order, overlapping, or out of bounds"
            }
            require(text.substring(token.charStart, token.charEnd) == token.surface) {
                "line $lineIndex: token ${token.surface}[${token.charStart},${token.charEnd}) does not match line text"
            }
            cursor = token.charEnd
        }
    }

    private fun editToken(
        analyzed: MutableList<AnalyzedLine>?,
        lineIndex: Int,
        charStart: Int,
        charEnd: Int,
        edit: (Token) -> Token,
    ): Token {
        val lines = requireNotNull(analyzed) { "lyric has no analyzed content" }
        val at = analyzedPosition(lines, lineIndex)
        val tokens = lines[at].tokens.toMutableList()
        val tokenAt = tokens.indexOfFirst { it.charStart == charStart && it.charEnd == charEnd }
        require(tokenAt >= 0) { "line $lineIndex has no token at [$charStart,$charEnd)" }
        val before = tokens[tokenAt]
        tokens[tokenAt] = edit(before)
        lines[at] = lines[at].copy(tokens = tokens)
        return before
    }

    private fun rawPosition(lines: List<LyricLineData>, lineIndex: Int): Int =
        lines.indexOfFirst { it.index == lineIndex }.also { require(it >= 0) { "lyric has no line $lineIndex" } }

    private fun analyzedPosition(lines: List<AnalyzedLine>, lineIndex: Int): Int =
        lines.indexOfFirst { it.index == lineIndex }.also { require(it >= 0) { "lyric has no analyzed line $lineIndex" } }

    private fun lineLocator(lyric: LyricEntity?, lineIndex: Int) =
        SongReportChangeLocator(lyricId = lyric?.id, lineIndex = lineIndex)

    private fun tokenLocator(lyric: LyricEntity?, lineIndex: Int, charStart: Int, charEnd: Int) =
        SongReportChangeLocator(lyricId = lyric?.id, lineIndex = lineIndex, charStart = charStart, charEnd = charEnd)

    private fun normalizeYoutubeUrl(value: String): String {
        val trimmed = value.trim()
        val videoId = YOUTUBE_URL.find(trimmed)?.groupValues?.get(1)
            ?: trimmed.takeIf { YOUTUBE_VIDEO_ID.matches(it) }
            ?: throw IllegalArgumentException("not a YouTube URL or video id: $value")
        return "https://www.youtube.com/watch?v=$videoId"
    }

    /** 토큰 읽기는 가타카나로 저장된다. 어드민이 히라가나로 적어도 같은 표기로 맞춘다. */
    private fun toKatakana(text: String): String =
        text.map { if (it in 'ぁ'..'ゖ') it + KATAKANA_OFFSET else it }.joinToString("")

    companion object {
        private val YOUTUBE_URL = Regex("""(?:v=|youtu\.be/|shorts/|embed/)([a-zA-Z0-9_-]{11})""")
        private val YOUTUBE_VIDEO_ID = Regex("""[a-zA-Z0-9_-]{11}""")
        private const val KATAKANA_OFFSET = 0x60
    }
}
