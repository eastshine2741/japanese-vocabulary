package com.japanese.vocabulary.user

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.dto.RegisterDeviceTokenRequest
import com.japanese.vocabulary.user.dto.UnregisterDeviceTokenRequest
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.DeviceTokenRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class DeviceTokenControllerIntegrationTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var deviceTokenRepository: DeviceTokenRepository
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUser(suffix: String): UserEntity = TestUserBuilder(entityManager)
        .withProviderSub("sub-$suffix-${System.nanoTime()}")
        .withUsername("u-$suffix-${System.nanoTime() % 1_000_000}")
        .build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    @Test
    fun `POST registers a new device token`() {
        val me = newUser("a")
        val body = RegisterDeviceTokenRequest(token = "fcm-token-A", platform = "ANDROID")

        mockMvc.post("/api/users/me/device-tokens") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }.andExpect { status { isNoContent() } }

        entityManager.flush(); entityManager.clear()
        val saved = deviceTokenRepository.findByToken("fcm-token-A")
        assertThat(saved).isNotNull
        assertThat(saved!!.userId).isEqualTo(me.id)
        assertThat(saved.platform).isEqualTo("ANDROID")
    }

    @Test
    fun `POST same token from a different user reassigns the row via ON DUPLICATE KEY UPDATE`() {
        val userA = newUser("a")
        val userB = newUser("b")
        val sharedToken = "fcm-shared-token"

        mockMvc.post("/api/users/me/device-tokens") {
            header("Authorization", bearer(userA))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                RegisterDeviceTokenRequest(token = sharedToken, platform = "ANDROID")
            )
        }.andExpect { status { isNoContent() } }

        mockMvc.post("/api/users/me/device-tokens") {
            header("Authorization", bearer(userB))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                RegisterDeviceTokenRequest(token = sharedToken, platform = "IOS")
            )
        }.andExpect { status { isNoContent() } }

        entityManager.flush(); entityManager.clear()
        val rows = deviceTokenRepository.findAll().filter { it.token == sharedToken }
        assertThat(rows).hasSize(1)
        assertThat(rows.single().userId).isEqualTo(userB.id)
        assertThat(rows.single().platform).isEqualTo("IOS")
    }

    @Test
    fun `DELETE removes the device token row`() {
        val me = newUser("c")
        val token = "fcm-token-to-delete"

        mockMvc.post("/api/users/me/device-tokens") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                RegisterDeviceTokenRequest(token = token, platform = "ANDROID")
            )
        }.andExpect { status { isNoContent() } }

        mockMvc.delete("/api/users/me/device-tokens") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(UnregisterDeviceTokenRequest(token = token))
        }.andExpect { status { isNoContent() } }

        entityManager.flush(); entityManager.clear()
        assertThat(deviceTokenRepository.findByToken(token)).isNull()
    }
}
