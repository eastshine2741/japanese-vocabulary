package com.japanese.vocabulary.translation.client.gemini

import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class GeminiResponseGuardTest {

    private fun response(finishReason: String?, candidatesTokenCount: Int? = 8192): Map<*, *> = buildMap {
        put(
            "candidates",
            listOf(
                buildMap {
                    put("content", mapOf("parts" to listOf(mapOf("text" to "[]"))))
                    finishReason?.let { put("finishReason", it) }
                },
            ),
        )
        candidatesTokenCount?.let { put("usageMetadata", mapOf("candidatesTokenCount" to it)) }
    }

    @Test
    fun `passes when the model stopped normally`() {
        assertThatCode { GeminiResponseGuard.verifyComplete("select", "flash", response("STOP"), 0) }
            .doesNotThrowAnyException()
    }

    @Test
    fun `passes when finishReason is absent`() {
        assertThatCode { GeminiResponseGuard.verifyComplete("select", "flash", response(null), 0) }
            .doesNotThrowAnyException()
    }

    @Test
    fun `rejects a MAX_TOKENS response and reports the token counts`() {
        assertThatThrownBy { GeminiResponseGuard.verifyComplete("select", "flash", response("MAX_TOKENS"), 0) }
            .isInstanceOf(GeminiIncompleteResponseException::class.java)
            .hasMessageContaining("call=select")
            .hasMessageContaining("finishReason=MAX_TOKENS")
            .hasMessageContaining("candidatesTokenCount=8192")
            .hasMessageContaining("maxOutputTokens=model default")
    }

    @Test
    fun `reports the configured maxOutputTokens when one is set`() {
        assertThatThrownBy { GeminiResponseGuard.verifyComplete("select", "flash", response("MAX_TOKENS"), 4096) }
            .isInstanceOf(GeminiIncompleteResponseException::class.java)
            .hasMessageContaining("maxOutputTokens=4096")
    }

    @Test
    fun `rejects any other non-STOP finish reason`() {
        assertThatThrownBy { GeminiResponseGuard.verifyComplete("translate", "pro", response("SAFETY"), 0) }
            .isInstanceOf(GeminiIncompleteResponseException::class.java)
            .hasMessageContaining("finishReason=SAFETY")
    }

    @Test
    fun `passes when there are no candidates to judge`() {
        assertThatCode { GeminiResponseGuard.verifyComplete("select", "flash", emptyMap<String, Any>(), 0) }
            .doesNotThrowAnyException()
    }
}
