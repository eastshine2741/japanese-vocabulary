package com.japanese.vocabulary.translation.service.pipeline

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * Splits one big Gemini request into fixed-size chunks and concatenates the responses.
 *
 * Past a point the model stops mid-array and returns valid JSON with only the first N items;
 * chunking bounds each response. Chunks run via [async] (concurrency is the caller's dispatcher's
 * business); order is preserved.
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
