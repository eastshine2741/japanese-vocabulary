package com.japanese.vocabulary.translation.client.gemini

/**
 * Raised when Gemini stopped for any reason other than `STOP` (`MAX_TOKENS` above all); such a
 * response can still parse as valid JSON holding only a prefix of the requested lines.
 */
class GeminiIncompleteResponseException(message: String) : RuntimeException(message)
