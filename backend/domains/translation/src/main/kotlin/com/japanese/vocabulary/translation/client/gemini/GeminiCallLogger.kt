package com.japanese.vocabulary.translation.client.gemini

import com.japanese.vocabulary.translation.entity.GeminiCallLogEntity
import com.japanese.vocabulary.translation.repository.GeminiCallLogRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Persists each Gemini call's input payload and raw response so a wrong pipeline result can be read
 * back against what the model was actually given.
 *
 * The system prompt is deliberately not stored: it is a compile-time constant, so repeating it on
 * every row buys nothing.
 *
 * TODO: 임시 저장소다. Loki 등 로그 수집 스택이 들어오면 이 컴포넌트와 `gemini_call_log` 테이블을 지우고
 *  stdout 구조화 로그로 이관한다. 그때까지 보존 정책이 없으니 커지면 수동으로 지운다.
 */
@Component
class GeminiCallLogger(
    private val geminiCallLogRepository: GeminiCallLogRepository,
) {
    private val logger = LoggerFactory.getLogger(GeminiCallLogger::class.java)

    /** Never throws: losing a debug row must not fail an analysis that otherwise succeeded. */
    fun record(
        context: GeminiCallContext,
        call: String,
        model: String,
        requestJson: String,
        responseJson: String?,
        errorMessage: String?,
    ) {
        try {
            geminiCallLogRepository.save(
                GeminiCallLogEntity(
                    songId = context.songId,
                    lyricId = context.lyricId,
                    callName = call,
                    model = model,
                    requestJson = requestJson.take(MAX_PAYLOAD_LENGTH),
                    responseJson = responseJson?.take(MAX_PAYLOAD_LENGTH),
                    errorMessage = errorMessage?.take(MAX_ERROR_MESSAGE_LENGTH),
                ),
            )
        } catch (e: Exception) {
            logger.warn("Failed to persist gemini call log (call={}, songId={})", call, context.songId, e)
        }
    }

    private companion object {
        /** Chunking already bounds payloads to ~100KB; this only guards a pathological row. */
        const val MAX_PAYLOAD_LENGTH = 1_000_000
        const val MAX_ERROR_MESSAGE_LENGTH = 1000
    }
}
