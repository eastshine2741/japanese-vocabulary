package com.japanese.vocabulary.admin

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.admin.dto.AdminLoginRequest
import com.japanese.vocabulary.admin.dto.AdminLoginResponse
import com.japanese.vocabulary.test.TestcontainersConfig
import com.japanese.vocabulary.test.clock.MutableClock
import com.japanese.vocabulary.test.clock.TestClockConfig
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.event.RecordApplicationEvents
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@RecordApplicationEvents
@Import(TestcontainersConfig::class, TestClockConfig::class)
abstract class AdminBaseIntegrationTest {
    @Autowired protected lateinit var entityManager: EntityManager
    @Autowired protected lateinit var clock: MutableClock
    @Autowired protected lateinit var applicationContext: ApplicationContext
    @Autowired protected lateinit var mockMvc: MockMvc
    @Autowired protected lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun resetClock() {
        clock.setTo(TestClockConfig.DEFAULT_FIXED_INSTANT)
    }

    protected fun adminToken(): String {
        val body = mockMvc.post("/admin/api/auth/login") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(AdminLoginRequest(password = "test-admin-password"))
        }.andExpect { status { isOk() } }
            .andReturn().response.contentAsString

        return objectMapper.readValue(body, AdminLoginResponse::class.java).token
    }
}
