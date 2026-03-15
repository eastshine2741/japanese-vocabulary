package com.japanese.vocabulary.app.deck.repository

import com.japanese.vocabulary.app.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.app.deck.dto.DeckListResponse
import com.japanese.vocabulary.app.deck.dto.DeckWordListResponse
import com.japanese.vocabulary.app.platform.TokenStorage
import com.japanese.vocabulary.app.platform.backendBaseUrl
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*

class DeckRepository(private val baseUrl: String = backendBaseUrl()) {
    private val client = HttpClient {
        install(ContentNegotiation) {
            json(kotlinx.serialization.json.Json { ignoreUnknownKeys = true })
        }
        HttpResponseValidator {
            validateResponse { response ->
                if (!response.status.isSuccess()) {
                    val errorBody = response.bodyAsText()
                    throw Exception("HTTP ${response.status.value}: $errorBody")
                }
            }
        }
    }

    private fun authHeader() = "Bearer ${TokenStorage.getToken() ?: ""}"

    suspend fun getDeckList(): DeckListResponse {
        return client.get("$baseUrl/api/decks") {
            headers { append("Authorization", authHeader()) }
        }.body()
    }

    suspend fun getDeckDetail(songId: Long?): DeckDetailResponse {
        val path = if (songId != null) "$baseUrl/api/decks/$songId" else "$baseUrl/api/decks/all"
        return client.get(path) {
            headers { append("Authorization", authHeader()) }
        }.body()
    }

    suspend fun getDeckWords(songId: Long?, cursor: Long? = null): DeckWordListResponse {
        val path = if (songId != null) "$baseUrl/api/decks/$songId/words" else "$baseUrl/api/decks/all/words"
        return client.get(path) {
            headers { append("Authorization", authHeader()) }
            if (cursor != null) {
                parameter("cursor", cursor)
            }
        }.body()
    }
}
