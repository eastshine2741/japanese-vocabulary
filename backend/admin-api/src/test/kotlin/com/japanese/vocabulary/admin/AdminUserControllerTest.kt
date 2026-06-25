package com.japanese.vocabulary.admin

import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get
import java.time.Instant

@AutoConfigureMockMvc
class AdminUserControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `authenticated admin can inspect user detail`() {
        val user = TestUserBuilder(entityManager)
            .withUsername("adminread")
            .withEmail("adminread@example.com")
            .build()

        mockMvc.get("/admin/api/users/${user.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.email") { value("adminread@example.com") }
        }
    }

    @Test
    fun `soft deleted users stay visible to admin detail`() {
        val user = TestUserBuilder(entityManager).withUsername("deleteduser").build()
        user.deletedAt = Instant.parse("2026-01-01T00:00:00Z")
        entityManager.flush()

        mockMvc.get("/admin/api/users/${user.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.deletedAt") { exists() }
        }
    }
}
