package com.japanese.vocabulary.translation.service.pipeline

import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class ChunkedGeminiCallTest {

    @Test
    fun `calls once when the input fits in a single chunk`(): Unit = runBlocking {
        val calls = mutableListOf<List<Int>>()

        val result = ChunkedGeminiCall.flatMap((1..20).toList(), 20) { chunk ->
            calls += chunk
            chunk.map { it * 10 }
        }

        assertThat(calls).hasSize(1)
        assertThat(result).hasSize(20).startsWith(10).endsWith(200)
    }

    @Test
    fun `splits into chunks and concatenates in input order`(): Unit = runBlocking {
        val calls = mutableListOf<List<Int>>()

        val result = ChunkedGeminiCall.flatMap((1..25).toList(), 20) { chunk ->
            synchronized(calls) { calls += chunk }
            chunk.map { it * 10 }
        }

        assertThat(calls.map { it.size }).containsExactlyInAnyOrder(20, 5)
        assertThat(result).isEqualTo((1..25).map { it * 10 })
    }

    @Test
    fun `does not call for empty input`(): Unit = runBlocking {
        var called = false

        val result = ChunkedGeminiCall.flatMap(emptyList<Int>(), 20) { called = true; emptyList<Int>() }

        assertThat(called).isFalse
        assertThat(result).isEmpty()
    }

    @Test
    fun `keeps order when a chunk returns fewer items than it was given`(): Unit = runBlocking {
        val result = ChunkedGeminiCall.flatMap((1..25).toList(), 20) { chunk -> chunk.take(2) }

        assertThat(result).containsExactly(1, 2, 21, 22)
    }

    @Test
    fun `chunks a segmentation retry by the lines it was actually given, not the whole song`(): Unit = runBlocking {
        // A retry sends only the failing lines. Chunking must bound the request without widening the
        // retry set back to the full song — 25 failing lines out of a 96-line song still make 2 calls.
        val failingLines = listOf(3, 9, 14, 20, 31, 47, 52, 60, 61, 62, 70, 71, 72, 80, 81, 82, 83, 84, 90, 91, 92, 93, 94, 95, 96)
        val calls = mutableListOf<List<Int>>()

        val result = ChunkedGeminiCall.flatMap(failingLines, 20) { chunk ->
            synchronized(calls) { calls += chunk }
            chunk
        }

        assertThat(calls).hasSize(2)
        assertThat(calls.flatten()).containsExactlyInAnyOrderElementsOf(failingLines)
        assertThat(result).isEqualTo(failingLines)
    }

    @Test
    fun `rejects a non-positive chunk size`() {
        assertThatThrownBy { runBlocking { ChunkedGeminiCall.flatMap(listOf(1), 0) { it } } }
            .isInstanceOf(IllegalArgumentException::class.java)
    }
}
