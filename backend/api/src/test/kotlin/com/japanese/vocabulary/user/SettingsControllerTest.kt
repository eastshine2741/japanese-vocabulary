package com.japanese.vocabulary.user

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.model.UserSettingsData
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put

@AutoConfigureMockMvc
class SettingsControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var userSettingsRepository: UserSettingsRepository
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUser(block: TestUserBuilder.() -> Unit = {}): UserEntity =
        TestUserBuilder(entityManager).apply(block).build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json, T::class.java)

    @Test
    fun `GET returns defaults when no row exists`() {
        val me = newUser()

        val body = mockMvc.get("/api/settings") {
            header("Authorization", bearer(me))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        val resp = readBody<UserSettingsData>(body)
        assertThat(resp.showIntervals).isTrue
        assertThat(resp.readingDisplay).isEqualTo("KOREAN")
        assertThat(resp.showKoreanPronunciation).isTrue
        assertThat(resp.showFurigana).isTrue
        assertThat(resp.dailyGoal).isEqualTo(100)
    }

    @Test
    fun `PUT creates row and subsequent GET reflects saved values`() {
        val me = newUser()
        val dto = UserSettingsData(
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
        assertThat(readBody<UserSettingsData>(getBody)).isEqualTo(dto)
    }

    @Test
    fun `second PUT updates the same row (one row per user)`() {
        val me = newUser()
        val first = UserSettingsData(readingDisplay = "HIRAGANA", dailyGoal = 30)
        val second = UserSettingsData(readingDisplay = "KATAKANA", dailyGoal = 60)

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
