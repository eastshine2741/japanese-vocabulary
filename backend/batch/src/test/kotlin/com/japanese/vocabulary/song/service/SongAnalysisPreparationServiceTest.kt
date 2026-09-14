package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.lyricsearch.LyricMatchConfidence
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.song.parser.LrcParser
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

/**
 * Provider adoption rule in [SongAnalysisPreparationService]: a STRONG hit ends the search, a WEAK
 * hit waits for the remaining providers and is used only when none of them names the artist.
 */
class SongAnalysisPreparationServiceTest {

    private val first: LyricProvider = mockk()
    private val second: LyricProvider = mockk()
    private val service = SongAnalysisPreparationService(
        lyricProviders = listOf(first, second),
        lrcParser = LrcParser(),
        songRepository = mockk(),
        youtubeMvSearchService = mockk(),
        lyricRepository = mockk(),
    )

    init {
        every { first.providerName } returns "first"
        every { second.providerName } returns "second"
    }

    @Test
    fun `a strong hit from the first provider ends the search`() {
        every { first.search(any()) } returns strong(lrclibId = 1)

        val prepared = service.prepareLyrics("恋", "Sohbana", 206)

        assertThat(prepared.lrclibId).isEqualTo(1)
        verify(exactly = 0) { second.search(any()) }
    }

    @Test
    fun `a weak hit yields to a later strong hit`() {
        every { first.search(any()) } returns weak(lrclibId = 1)
        every { second.search(any()) } returns strong(vocadbId = 2)

        val prepared = service.prepareLyrics("恋", "Sohbana", 206)

        assertThat(prepared.lrclibId).isNull()
        assertThat(prepared.vocadbId).isEqualTo(2)
    }

    @Test
    fun `a weak hit is used when no provider does better`() {
        every { first.search(any()) } returns weak(lrclibId = 1)
        every { second.search(any()) } returns null

        val prepared = service.prepareLyrics("恋", "Sohbana", 206)

        assertThat(prepared.lrclibId).isEqualTo(1)
    }

    @Test
    fun `the earliest weak hit wins among weak hits`() {
        every { first.search(any()) } returns weak(lrclibId = 1)
        every { second.search(any()) } returns weak(vocadbId = 2)

        val prepared = service.prepareLyrics("恋", "Sohbana", 206)

        assertThat(prepared.lrclibId).isEqualTo(1)
        assertThat(prepared.vocadbId).isNull()
    }

    @Test
    fun `no hit at all fails as lyrics not found`() {
        every { first.search(any()) } returns null
        every { second.search(any()) } returns null

        assertThatThrownBy { service.prepareLyrics("恋", "Sohbana", 206) }
            .isInstanceOf(BusinessException::class.java)
            .extracting { (it as BusinessException).errorCode }
            .isEqualTo(ErrorCode.LYRICS_NOT_FOUND)
    }

    private fun strong(lrclibId: Long? = null, vocadbId: Long? = null) = result(lrclibId, vocadbId, LyricMatchConfidence.STRONG)

    private fun weak(lrclibId: Long? = null, vocadbId: Long? = null) = result(lrclibId, vocadbId, LyricMatchConfidence.WEAK)

    private fun result(lrclibId: Long?, vocadbId: Long?, confidence: LyricMatchConfidence) = LyricsResult(
        lrclibId = lrclibId,
        vocadbId = vocadbId,
        lyrics = "恋をした",
        isSynced = false,
        confidence = confidence,
    )
}
