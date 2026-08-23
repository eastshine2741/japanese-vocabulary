package com.japanese.vocabulary.translation.client.gemini

/**
 * Rejects Gemini responses that stopped early. A `MAX_TOKENS` (or SAFETY/RECITATION) stop can still
 * yield parseable JSON holding only the first N requested lines, which used to surface downstream as
 * a confusing "line indices mismatch" instead of "the model was cut off".
 */
internal object GeminiResponseGuard {
    private const val FINISH_REASON_STOP = "STOP"

    /** `finishReason` absent → treat as complete. */
    fun verifyComplete(call: String, model: String, response: Map<*, *>, maxOutputTokens: Int) {
        val candidate = (response["candidates"] as? List<*>)?.firstOrNull() as? Map<*, *> ?: return
        val finishReason = candidate["finishReason"] as? String ?: return
        if (finishReason == FINISH_REASON_STOP) return
        val usage = response["usageMetadata"] as? Map<*, *>
        throw GeminiIncompleteResponseException(
            "Gemini call=$call model=$model did not complete: finishReason=$finishReason, " +
                "candidatesTokenCount=${usage?.get("candidatesTokenCount")}, " +
                "maxOutputTokens=${if (maxOutputTokens > 0) maxOutputTokens else "model default"}",
        )
    }
}
