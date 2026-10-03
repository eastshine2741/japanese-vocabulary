package com.japanese.vocabulary.song.worker

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.japanese.vocabulary.messagequeue.SongAnalysisWorkMessage
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.songanalysis.dto.ClaimedSongAnalysisStage
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageRef
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisWorkSnapshot
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.model.WordPreparationResult
import com.japanese.vocabulary.translation.service.KoreanLyricTranslationService
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.Optional
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class SongAnalysisWorkListenerTest {

    private val workService: SongAnalysisWorkService = mockk(relaxed = true)
    private val translationService: KoreanLyricTranslationService = mockk()
    private val lyricRepository: LyricRepository = mockk()
    private val executor = SongAnalysisStageExecutor(
        workService = workService,
        preparationService = mockk(),
        songCreator = mockk(),
        completionService = mockk(),
        translationService = translationService,
        lyricRepository = lyricRepository,
        codec = SongAnalysisStageCodec(ObjectMapper().registerKotlinModule()),
    )
    private val listener = SongAnalysisWorkListener(workService, executor, SimpleMeterRegistry(), Duration.ofMinutes(5))

    /**
     * 번역과 분절은 각자 Gemini 를 수십 초씩 기다린다. 리스너가 디스패처 없이 runBlocking 하면 둘이
     * 리스너 스레드 하나에서 차례로 돌아 분석 시간이 그 합만큼 늘어난다. 두 호출이 서로를 기다리게
     * 해서, 동시에 돌지 않으면 끝나지 못하게 만든다.
     */
    @Test
    fun `translation and segmentation really run at the same time`() {
        val bothStarted = CountDownLatch(2)
        val sawEachOther = mutableListOf<Boolean>()
        fun meetTheOther() {
            bothStarted.countDown()
            val met = bothStarted.await(5, TimeUnit.SECONDS)
            synchronized(sawEachOther) { sawEachOther += met }
        }
        stubAnalyzeStage()
        coEvery { translationService.translateLyrics(any()) } answers {
            meetTheOther()
            mapOf(0 to TranslationResultDto(0, "고양이"))
        }
        coEvery { translationService.segmentLyrics(any()) } answers {
            meetTheOther()
            SegmentationStageResult(emptyList(), emptyMap())
        }

        listener.onMessage(SongAnalysisWorkMessage(WORK_ID, SongAnalysisWorkStage.ANALYZE_LYRICS), redelivered = false)

        assertThat(sawEachOther).containsExactly(true, true)
        verify(exactly = 1) { workService.completeStage(any(), any()) }
    }

    @Test
    fun `a failing stage is recorded with its cause and the message is acked`() {
        stubAnalyzeStage()
        coEvery { translationService.translateLyrics(any()) } throws IllegalStateException("bad answer")
        coEvery { translationService.segmentLyrics(any()) } returns SegmentationStageResult(emptyList(), emptyMap())

        listener.onMessage(SongAnalysisWorkMessage(WORK_ID, SongAnalysisWorkStage.ANALYZE_LYRICS), redelivered = false)

        verify(exactly = 1) {
            workService.failStage(
                REF,
                match {
                    it.code == "SONG_ANALYSIS_WORK_FAILED" &&
                        it.errorClass == "java.lang.IllegalStateException" &&
                        it.detail!!.contains("bad answer")
                },
            )
        }
    }

    private fun stubAnalyzeStage() {
        val lyric = LyricEntity(
            id = LYRIC_ID,
            songId = 1,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(0, null, "猫")),
        )
        every { workService.claimStage(WORK_ID, SongAnalysisWorkStage.ANALYZE_LYRICS, false) } returns ClaimedSongAnalysisStage(
            ref = REF,
            work = SongAnalysisWorkSnapshot(
                workId = WORK_ID,
                rawTitle = "猫",
                rawArtist = "アーティスト",
                durationSeconds = null,
                artworkUrl = null,
                triggerSource = SongAnalysisTriggerSource.USER_APP,
                songId = 1,
                lyricId = LYRIC_ID,
                youtubeUrl = null,
            ),
            startedAt = Instant.now(),
            previousOutput = null,
        )
        every { workService.recordProgress(any(), any()) } returns true
        every { workService.completeStage(any(), any()) } returns true
        every { lyricRepository.findById(LYRIC_ID) } returns Optional.of(lyric)
        every { translationService.sourceOf(lyric) } returns
            TranslationPipelineSource.from(lyric.rawContent, GeminiCallContext(songId = 1, lyricId = LYRIC_ID))
        coEvery { translationService.resolveWords(any()) } returns
            WordPreparationResult(emptyList(), emptyMap(), emptyMap(), LexicalResolution(emptyMap(), emptyMap()))
    }

    private companion object {
        const val WORK_ID = 42L
        const val LYRIC_ID = 7L
        val REF = SongAnalysisStageRef(WORK_ID, SongAnalysisWorkStage.ANALYZE_LYRICS, attempt = 1)
    }
}
