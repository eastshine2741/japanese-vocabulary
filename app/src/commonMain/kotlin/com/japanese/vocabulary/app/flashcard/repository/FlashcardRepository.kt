package com.japanese.vocabulary.app.flashcard.repository

import com.japanese.vocabulary.app.flashcard.dto.DueFlashcardsResponse
import com.japanese.vocabulary.app.flashcard.dto.FlashcardStatsResponse
import com.japanese.vocabulary.app.flashcard.dto.ReviewRequest
import com.japanese.vocabulary.app.flashcard.dto.ReviewResponse
import com.japanese.vocabulary.app.flashcard.dto.UserSettingsDTO
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

class FlashcardRepository(private val baseUrl: String = backendBaseUrl()) {
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

    suspend fun getDueFlashcards(): DueFlashcardsResponse {
        return client.get("$baseUrl/api/flashcards/due") {
            headers { append("Authorization", authHeader()) }
        }.body()
    }

    suspend fun reviewCard(flashcardId: Long, rating: Int): ReviewResponse {
        return client.post("$baseUrl/api/flashcards/$flashcardId/review") {
            headers { append("Authorization", authHeader()) }
            contentType(ContentType.Application.Json)
            setBody(ReviewRequest(rating = rating))
        }.body()
    }

    suspend fun getStats(): FlashcardStatsResponse {
        return client.get("$baseUrl/api/flashcards/stats") {
            headers { append("Authorization", authHeader()) }
        }.body()
    }

    suspend fun getSettings(): UserSettingsDTO {
        return client.get("$baseUrl/api/settings") {
            headers { append("Authorization", authHeader()) }
        }.body()
    }

    suspend fun updateSettings(settings: UserSettingsDTO): UserSettingsDTO {
        return client.put("$baseUrl/api/settings") {
            headers { append("Authorization", authHeader()) }
            contentType(ContentType.Application.Json)
            setBody(settings)
        }.body()
    }
}
