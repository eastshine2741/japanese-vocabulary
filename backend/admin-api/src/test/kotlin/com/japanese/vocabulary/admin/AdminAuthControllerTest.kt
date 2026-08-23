package com.japanese.vocabulary.admin

import com.japanese.vocabulary.admin.dto.AdminLoginRequest
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AdminAuthControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `login accepts admin password`() {
        mockMvc.post("/admin/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(AdminLoginRequest(password = "test-admin-password"))
        }.andExpect {
            status { isOk() }
            jsonPath("$.token") { exists() }
            jsonPath("$.expiresAt") { exists() }
        }
    }

    @Test
    fun `login failure is unauthorized and unauthenticated admin reads are rejected`() {
        mockMvc.post("/admin/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(AdminLoginRequest(password = "wrong"))
        }.andExpect { status { isUnauthorized() } }

        mockMvc.get("/admin/api/songs")
            .andExpect { status { isForbidden() } }
    }

    @Test
    fun `public app jwt shaped token is not accepted as admin token`() {
        mockMvc.get("/admin/api/users") {
            header("Authorization", "Bearer not-an-admin-token")
        }.andExpect { status { isForbidden() } }
    }
}
