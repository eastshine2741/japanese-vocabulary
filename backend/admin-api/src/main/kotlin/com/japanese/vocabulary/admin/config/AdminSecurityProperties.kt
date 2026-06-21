package com.japanese.vocabulary.admin.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "admin.security")
data class AdminSecurityProperties(
    val password: String = "",
    val passwordSha256: String = "",
    val tokenSecret: String = "",
    val tokenTtlMinutes: Long = 60,
)
