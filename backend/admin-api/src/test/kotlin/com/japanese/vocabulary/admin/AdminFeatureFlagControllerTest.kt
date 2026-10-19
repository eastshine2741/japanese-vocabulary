package com.japanese.vocabulary.admin

import com.japanese.vocabulary.admin.dto.AdminFeatureFlagRequest
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put
import java.time.Instant

@AutoConfigureMockMvc
class AdminFeatureFlagControllerTest : AdminBaseIntegrationTest() {
    private val start = Instant.parse("2026-01-02T00:00:00Z")

    @Test
    fun `upsert creates then updates and list reports whether the flag is on now`() {
        put("new-home", AdminFeatureFlagRequest(start, null, "새 홈")).andExpect {
            status { isOk() }
            jsonPath("$.key") { value("new-home") }
            jsonPath("$.on") { value(false) }
        }

        clock.setTo(start)
        put("new-home", AdminFeatureFlagRequest(start, start.plusSeconds(3600), "새 홈 v2")).andExpect {
            status { isOk() }
            jsonPath("$.on") { value(true) }
        }

        mockMvc.get("/admin/api/feature-flags") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].description") { value("새 홈 v2") }
            jsonPath("$[0].endAt") { value("2026-01-02T01:00:00Z") }
        }
    }

    @Test
    fun `invalid key or window is a bad request`() {
        put("New_Home", AdminFeatureFlagRequest(start, null)).andExpect { status { isBadRequest() } }
        put("new-home", AdminFeatureFlagRequest(start, start)).andExpect { status { isBadRequest() } }
    }

    @Test
    fun `delete removes the flag and unknown keys are not found`() {
        put("new-home", AdminFeatureFlagRequest(start, null)).andExpect { status { isOk() } }

        mockMvc.delete("/admin/api/feature-flags/new-home") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect { status { isNoContent() } }
        mockMvc.delete("/admin/api/feature-flags/new-home") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `requires admin token`() {
        mockMvc.get("/admin/api/feature-flags").andExpect { status { isForbidden() } }
    }

    private fun put(key: String, request: AdminFeatureFlagRequest): ResultActionsDsl =
        mockMvc.put("/admin/api/feature-flags/$key") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(request)
        }
}
