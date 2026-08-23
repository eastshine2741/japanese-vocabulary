package com.japanese.vocabulary.translation.client.gemini

/**
 * Raised when Gemini stopped for any reason other than `STOP` — `MAX_TOKENS` above all. Such a
 * response can still parse as valid JSON while holding only a prefix of the requested lines, which
 * used to surface downstream as a confusing "line indices mismatch" instead of "the model was cut off".
 */
class GeminiIncompleteResponseException(message: String) : RuntimeException(message)
