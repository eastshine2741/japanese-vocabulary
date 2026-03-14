package com.japanese.vocabulary.app.auth.dto

import kotlinx.serialization.Serializable

@Serializable
data class AuthRequest(val name: String, val password: String)
