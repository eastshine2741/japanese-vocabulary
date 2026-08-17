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
    fun `rejects a non-positive chunk size`() {
        assertThatThrownBy { runBlocking { ChunkedGeminiCall.flatMap(listOf(1), 0) { it } } }
            .isInstanceOf(IllegalArgumentException::class.java)
    }
}
