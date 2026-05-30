package com.japanese.vocabulary.user

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.dto.UpdateProfileRequest
import com.japanese.vocabulary.user.dto.UserProfileResponse
import com.japanese.vocabulary.user.dto.UserSettingsDTO
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.put
import java.time.Instant

@AutoConfigureMockMvc
class UserDomainIntegrationTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var userRepository: UserRepository
    @Autowired private lateinit var userSettingsRepository: UserSettingsRepository
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUser(block: TestUserBuilder.() -> Unit = {}): UserEntity =
        TestUserBuilder(entityManager).apply(block).build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json, T::class.java)

    @Nested
    inner class Profile {

        @Test
        fun `PATCH updates both name and username`() {
            val me = newUser { withUsername("oldname"); withName("Old") }

            val body = mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = "New", username = "newname"))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<UserProfileResponse>(body)
            assertThat(resp.username).isEqualTo("newname")
            assertThat(resp.name).isEqualTo("New")

            entityManager.flush(); entityManager.clear()
            val reloaded = userRepository.findById(me.id!!).get()
            assertThat(reloaded.username).isEqualTo("newname")
            assertThat(reloaded.name).isEqualTo("New")
        }

        @Test
        fun `PATCH with only name leaves username unchanged`() {
            val me = newUser { withUsername("keepme"); withName("Old") }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = "Renamed", username = null))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val reloaded = userRepository.findById(me.id!!).get()
            assertThat(reloaded.username).isEqualTo("keepme")
            assertThat(reloaded.name).isEqualTo("Renamed")
        }

        @Test
        fun `PATCH with only username leaves name unchanged`() {
            val me = newUser { withUsername("renameme"); withName("StableName") }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = null, username = "renamed"))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val reloaded = userRepository.findById(me.id!!).get()
            assertThat(reloaded.username).isEqualTo("renamed")
            assertThat(reloaded.name).isEqualTo("StableName")
        }

        @Test
        fun `PATCH blank name stores null`() {
            val me = newUser { withUsername("blanker"); withName("Before") }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = "   ", username = null))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val reloaded = userRepository.findById(me.id!!).get()
            assertThat(reloaded.name).isNull()
        }

        @Test
        fun `PATCH to a username taken by another user returns 409`() {
            newUser { withUsername("occupied") }
            val me = newUser { withUsername("trying") }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = null, username = "occupied"))
            }.andExpect { status { isConflict() } }

            entityManager.flush(); entityManager.clear()
            assertThat(userRepository.findById(me.id!!).get().username).isEqualTo("trying")
        }

        @Test
        fun `PATCH with invalid username format returns 400`() {
            val me = newUser { withUsername("validone") }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = null, username = "ab"))
            }.andExpect { status { isBadRequest() } }
        }

        @Test
        fun `PATCH with reserved username returns 400`() {
            val me = newUser { withUsername("validone") }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = null, username = "admin"))
            }.andExpect { status { isBadRequest() } }
        }

        @Test
        fun `PATCH to own current username is a no-op`() {
            val me = newUser { withUsername("samesame"); withName("Same") }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = null, username = "samesame"))
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val reloaded = userRepository.findById(me.id!!).get()
            assertThat(reloaded.username).isEqualTo("samesame")
        }

        @Test
        fun `PATCH from a soft-deleted user is rejected`() {
            val me = newUser { withUsername("ghost") }
            me.deletedAt = Instant.parse("2024-01-01T00:00:00Z")
            entityManager.flush()

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = "X", username = null))
            }.andExpect { status { isUnauthorized() } }
        }

        @Test
        fun `DELETE marks user soft-deleted and scrubs PII`() {
            val me = newUser {
                withUsername("goingaway")
                withProviderSub("sub-leaving")
                withEmail("bye@example.com")
                withName("Going Away")
            }

            mockMvc.delete("/api/users/me") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNoContent() } }

            entityManager.flush(); entityManager.clear()
            val reloaded = userRepository.findById(me.id!!).get()
            assertThat(reloaded.deletedAt).isNotNull
            assertThat(reloaded.providerSub).isEqualTo("deleted:${me.id}:sub-leaving")
            assertThat(reloaded.username).isEqualTo("deleted:${me.id}:goingaway")
            assertThat(reloaded.email).isNull()
            assertThat(reloaded.name).isNull()
        }

        @Test
        fun `subsequent requests from a deleted user are rejected`() {
            val me = newUser { withUsername("nowgone") }

            mockMvc.delete("/api/users/me") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNoContent() } }

            mockMvc.patch("/api/users/me") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(UpdateProfileRequest(name = "Zombie", username = null))
            }.andExpect { status { isUnauthorized() } }
        }
    }

    @Nested
    inner class Settings {

        @Test
        fun `GET returns defaults when no row exists`() {
            val me = newUser()

            val body = mockMvc.get("/api/settings") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<UserSettingsDTO>(body)
            assertThat(resp.showIntervals).isTrue
            assertThat(resp.readingDisplay).isEqualTo("KOREAN")
            assertThat(resp.showKoreanPronunciation).isTrue
            assertThat(resp.showFurigana).isTrue
            assertThat(resp.dailyGoal).isEqualTo(100)
        }

        @Test
        fun `PUT creates row and subsequent GET reflects saved values`() {
            val me = newUser()
            val dto = UserSettingsDTO(
                showIntervals = false,
                readingDisplay = "HIRAGANA",
                showKoreanPronunciation = false,
                showFurigana = false,
                dailyGoal = 42,
            )

            mockMvc.put("/api/settings") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(dto)
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val getBody = mockMvc.get("/api/settings") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString
            assertThat(readBody<UserSettingsDTO>(getBody)).isEqualTo(dto)
        }

        @Test
        fun `second PUT updates the same row (one row per user)`() {
            val me = newUser()
            val first = UserSettingsDTO(readingDisplay = "HIRAGANA", dailyGoal = 30)
            val second = UserSettingsDTO(readingDisplay = "KATAKANA", dailyGoal = 60)

            mockMvc.put("/api/settings") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(first)
            }.andExpect { status { isOk() } }

            mockMvc.put("/api/settings") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(second)
            }.andExpect { status { isOk() } }

            entityManager.flush(); entityManager.clear()
            val rows = userSettingsRepository.findAll().filter { it.userId == me.id }
            assertThat(rows).hasSize(1)
            assertThat(rows.single().settings.readingDisplay).isEqualTo("KATAKANA")
            assertThat(rows.single().settings.dailyGoal).isEqualTo(60)
        }
    }

}
