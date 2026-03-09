package com.japanese.vocabulary.app.network

import com.japanese.vocabulary.app.model.AddWordRequest
import com.japanese.vocabulary.app.model.WordDefinitionDTO
import com.japanese.vocabulary.app.model.WordListResponse
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

class VocabularyRepository(private val baseUrl: String = backendBaseUrl()) {
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

    suspend fun lookupWord(word: String): WordDefinitionDTO {
        return client.get("$baseUrl/api/words/lookup") {
            headers { append("Authorization", authHeader()) }
            parameter("word", word)
        }.body()
    }

    suspend fun addWord(request: AddWordRequest): Long {
        val result: Map<String, Long> = client.post("$baseUrl/api/words") {
            headers { append("Authorization", authHeader()) }
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
        return result["id"] ?: error("Missing id in response")
    }

    suspend fun getWords(cursor: Long? = null): WordListResponse {
        return client.get("$baseUrl/api/words") {
            headers { append("Authorization", authHeader()) }
            if (cursor != null) parameter("cursor", cursor)
        }.body()
    }
}
