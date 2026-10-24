package com.japanese.vocabulary.admin.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "admin.security")
data class AdminSecurityProperties(
    val password: String = "",
    val passwordSha256: String = "",
    val tokenSecret: String = "",
    val tokenTtlMinutes: Long = 180,
    /** 로컬 PC 가사 싱크 실행기 전용 고정 토큰. 비어 있으면 실행기 API 가 닫힌다. */
    val lyricSyncAgentToken: String = "",
)
