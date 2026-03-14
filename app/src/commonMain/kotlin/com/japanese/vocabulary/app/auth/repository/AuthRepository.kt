package com.japanese.vocabulary.app.auth.repository

import com.japanese.vocabulary.app.auth.dto.AuthRequest
import com.japanese.vocabulary.app.auth.dto.AuthResponse
import com.japanese.vocabulary.app.platform.backendBaseUrl
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*

class AuthRepository(private val baseUrl: String = backendBaseUrl()) {
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

    suspend fun signup(name: String, password: String): AuthResponse {
        return client.post("$baseUrl/api/auth/signup") {
            contentType(ContentType.Application.Json)
            setBody(AuthRequest(name, password))
        }.body()
    }

    suspend fun login(name: String, password: String): AuthResponse {
        return client.post("$baseUrl/api/auth/login") {
            contentType(ContentType.Application.Json)
            setBody(AuthRequest(name, password))
        }.body()
    }
}
