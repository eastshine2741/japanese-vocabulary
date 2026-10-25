package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.parser.LrcParser
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.time.Duration

class SongAnalysisPreparationServiceTest {

    @Test
    fun `lyrics with no parsable line fall through to the next provider`(): Unit = runBlocking {
        val service = serviceWith(
            provider("LrcLib", LyricsResult(lrclibId = 1, lyrics = "[00:00.000]\n[00:14.879]", isSynced = true)),
            provider("VocaDB", LyricsResult(vocadbId = 2, lyrics = "借りた本を片手に持って", isSynced = false)),
        )

        val prepared = service.prepareLyrics("さよならモルテン", "ヨルシカ", 295)

        assertThat(prepared.vocadbId).isEqualTo(2)
        assertThat(prepared.lyricType).isEqualTo(LyricType.PLAIN)
        assertThat(prepared.lines.map { it.text }).containsExactly("借りた本を片手に持って")
    }

    @Test
    fun `a version sung in another language gets no lyrics`() {
        val service = serviceWith(provider("LrcLib", LyricsResult(lrclibId = 1, lyrics = "悩める人の子よ", isSynced = false)))

        assertThatThrownBy { runBlocking { service.prepareLyrics("UNDEAD (English Version)", "YOASOBI", 182) } }
            .isInstanceOf(BusinessException::class.java)
    }

    private fun provider(name: String, result: LyricsResult?) = object : LyricProvider {
        override val providerName = name
        override suspend fun search(query: NormalizedSongQuery) = result
    }

    private fun serviceWith(vararg providers: LyricProvider) = SongAnalysisPreparationService(
        lyricProviders = providers.toList(),
        lrcParser = LrcParser(),
        songRepository = mockk(),
        youtubeMvSearchService = mockk(),
        lyricRepository = mockk(),
        providerMaxAttempts = 1,
        providerInitialBackoff = Duration.ZERO,
    )
}
