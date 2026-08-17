package com.japanese.vocabulary.translation.service.pipeline

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * Splits one big Gemini request into fixed-size chunks and concatenates the responses.
 *
 * A whole-song request makes the response length scale with the song, and past a point the model
 * stops mid-array — it returns valid JSON holding only the first N items. Chunking bounds each
 * response instead of hoping one call survives a 96-line song.
 *
 * Chunks are dispatched with [async], so how many actually run at once is the caller's dispatcher's
 * business; correctness does not depend on it. Order is preserved.
 */
object ChunkedGeminiCall {

    suspend fun <I, O> flatMap(items: List<I>, chunkSize: Int, call: (List<I>) -> List<O>): List<O> {
        require(chunkSize > 0) { "chunkSize must be positive, was $chunkSize" }
        if (items.isEmpty()) return emptyList()
        if (items.size <= chunkSize) return call(items)
        return coroutineScope {
            items.chunked(chunkSize)
                .map { chunk -> async { call(chunk) } }
                .awaitAll()
                .flatten()
        }
    }
}
