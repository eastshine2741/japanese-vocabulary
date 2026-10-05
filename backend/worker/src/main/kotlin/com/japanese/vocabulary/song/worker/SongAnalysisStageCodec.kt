package com.japanese.vocabulary.song.worker

import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.JsonSerializer
import com.fasterxml.jackson.databind.KeyDeserializer
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializerProvider
import com.fasterxml.jackson.databind.module.SimpleModule
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService.PreparedLyric
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.WordPreparationResult
import org.springframework.stereotype.Component

/**
 * 단계 산출물을 `song_analysis_work_stage.output` 에 JSON 으로 넣고 꺼낸다.
 *
 * 파이프라인 모델은 [PipelineTokenKey] 를 맵 키로 쓰는데 Jackson 은 객체 키를 되읽지 못한다.
 * 여기서만 키를 [PipelineTokenKey.tokenId] 문자열로 바꾼다 — 앱 전역 ObjectMapper 는 건드리지 않는다.
 */
@Component
class SongAnalysisStageCodec(objectMapper: ObjectMapper) {

    private val mapper: ObjectMapper = objectMapper.copy()
        .registerModule(
            SimpleModule("song-analysis-stage-output")
                .addKeySerializer(PipelineTokenKey::class.java, TokenKeySerializer())
                .addKeyDeserializer(PipelineTokenKey::class.java, TokenKeyDeserializer()),
        )
        // 계산 프로퍼티(PipelineToken.key, PipelineTokenKey.tokenId)가 같이 쓰이므로 되읽을 때 무시한다.
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

    fun write(value: Any): String = mapper.writeValueAsString(value)

    fun <T> read(json: String, type: Class<T>): T = mapper.readValue(json, type)

    private class TokenKeySerializer : JsonSerializer<PipelineTokenKey>() {
        override fun serialize(value: PipelineTokenKey, gen: JsonGenerator, serializers: SerializerProvider) {
            gen.writeFieldName(value.tokenId)
        }
    }

    /** tokenId 는 `line:start:end:surface`. surface 에 콜론이 있어도 앞 세 칸만 자르면 된다. */
    private class TokenKeyDeserializer : KeyDeserializer() {
        override fun deserializeKey(key: String, ctxt: DeserializationContext): PipelineTokenKey {
            val parts = key.split(":", limit = 4)
            require(parts.size == 4) { "Not a token id: $key" }
            return PipelineTokenKey(
                lineIndex = parts[0].toInt(),
                charStart = parts[1].toInt(),
                charEnd = parts[2].toInt(),
                surface = parts[3],
            )
        }
    }
}

// 단계별 산출물. 각 단계가 끝날 때 쓰고 뒤 단계가 읽는다. FETCH_LYRICS 는 PreparedLyric 을 그대로 쓴다.

/** null 은 MV 를 못 찾았다는 뜻이다. 곡은 MV 없이 분석된다. */
data class FetchYoutubeOutput(val youtubeUrl: String?)

data class CreateSongAndLyricOutput(val songId: Long, val lyricId: Long)

/**
 * 두 갈래가 끝나는 대로 채운다. 실패한 시도의 행에도 끝난 갈래는 남으므로, 다시 돌릴 때 비어 있는
 * 갈래만 한다. [segmentation] 은 [words] 의 입력이라 따로 남긴다 — 사전 조회만 실패했을 때
 * Gemini 분절을 다시 부르지 않으려는 것이다.
 */
data class AnalyzeLyricsOutput(
    val translation: Map<Int, TranslationResultDto>? = null,
    val segmentation: SegmentationStageResult? = null,
    val words: WordPreparationResult? = null,
)

data class SelectSensesOutput(val selectedSenseByKey: Map<PipelineTokenKey, Int>)

data class TranslateSensesOutput(val koreanBySenseId: Map<Int, String>)

data class CompleteOutput(val analyzedLines: Int)

internal typealias FetchLyricsOutput = PreparedLyric
