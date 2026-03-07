package com.japanese.vocabulary.app.network

import com.japanese.vocabulary.app.model.SongStudyData
import com.japanese.vocabulary.app.platform.backendBaseUrl
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable

class SongRepository(private val baseUrl: String = backendBaseUrl()) {
    private val client = HttpClient {
        install(ContentNegotiation) { json() }
    }

    suspend fun analyze(title: String, artist: String, lyrics: String): SongStudyData {
        return client.post("$baseUrl/api/songs/analyze") {
            contentType(ContentType.Application.Json)
            setBody(AnalyzeSongRequest(title, artist, lyrics))
        }.body()
    }
}

@Serializable
data class AnalyzeSongRequest(val title: String, val artist: String, val lyrics: String)
