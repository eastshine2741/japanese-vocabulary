package com.japanese.vocabulary.admin.auth

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority

/** 로컬 PC 가사 싱크 실행기. admin 화면 API 는 못 쓰고 lyric-sync-agent 경로만 쓴다. */
class LyricSyncAgentAuthentication : AbstractAuthenticationToken(listOf(SimpleGrantedAuthority(AUTHORITY))) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any? = null
    override fun getPrincipal(): Any = PRINCIPAL

    companion object {
        const val PRINCIPAL = "lyric-sync-agent"
        const val AUTHORITY = "LYRIC_SYNC_AGENT"
    }
}
