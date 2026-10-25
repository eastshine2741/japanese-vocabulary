package com.japanese.vocabulary.admin.auth

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority

/** 로컬 PC 곡 분석 감사 러너. 완료된 분석과 가사를 읽기만 한다. */
class AnalysisAuditAuthentication : AbstractAuthenticationToken(listOf(SimpleGrantedAuthority(AUTHORITY))) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any? = null
    override fun getPrincipal(): Any = PRINCIPAL

    companion object {
        const val PRINCIPAL = "analysis-audit"
        const val AUTHORITY = "ANALYSIS_AUDIT"
    }
}
