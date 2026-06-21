package com.japanese.vocabulary.admin.auth

import org.springframework.security.authentication.AbstractAuthenticationToken

class AdminAuthentication : AbstractAuthenticationToken(emptyList()) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any? = null
    override fun getPrincipal(): Any = PRINCIPAL

    companion object {
        const val PRINCIPAL = "admin"
    }
}
