package com.japanese.vocabulary.app.platform

expect object TokenStorage {
    fun saveToken(token: String)
    fun getToken(): String?
    fun clearToken()
}
