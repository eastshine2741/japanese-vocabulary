package com.japanese.vocabulary.app.network

import com.japanese.vocabulary.app.model.SongSearchResponse
import com.japanese.vocabulary.app.model.SongStudyData
import com.japanese.vocabulary.app.platform.backendBaseUrl
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable

class SongRepository(private val baseUrl: String = backendBaseUrl()) {
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

    suspend fun search(query: String, offset: Int = 0, limit: Int = 50): SongSearchResponse {
        return client.get("$baseUrl/api/songs/search") {
            parameter("q", query)
            parameter("offset", offset)
            parameter("limit", limit)
        }.body()
    }

    suspend fun analyze(title: String, artist: String, durationSeconds: Int? = null): SongStudyData {
        return client.post("$baseUrl/api/songs/analyze") {
            contentType(ContentType.Application.Json)
            setBody(AnalyzeSongRequest(title, artist, durationSeconds))
        }.body()
    }
}

@Serializable
data class AnalyzeSongRequest(
    val title: String,
    val artist: String,
    val durationSeconds: Int? = null
)
