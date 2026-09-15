package com.japanese.vocabulary.voc

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.github.client.dto.GithubIssueDto
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.voc.dto.CreateVocRequest
import com.japanese.vocabulary.voc.dto.CreateVocResponse
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class VocControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUser(block: TestUserBuilder.() -> Unit = {}): UserEntity =
        TestUserBuilder(entityManager).apply(block).build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    @Test
    fun `POST creates a type-voc issue with the user's DB identity in the body`() {
        val me = newUser { withUsername("reporter") }
        every { githubIssueClient.enabled } returns true
        val titles = mutableListOf<String>()
        val bodies = mutableListOf<String>()
        val labels = mutableListOf<List<String>>()
        every { githubIssueClient.createIssue(capture(titles), capture(bodies), capture(labels)) } returns
            GithubIssueDto(number = 12, htmlUrl = "https://github.com/o/r/issues/12")

        val raw = mockMvc.post("/api/voc") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                CreateVocRequest(content = "검색이 안 돼요\n자세한 설명", os = "ios", osVersion = "17.4", device = "iPhone 15"),
            )
        }.andExpect { status { isCreated() } }.andReturn().response.contentAsString

        val resp = objectMapper.readValue(raw, CreateVocResponse::class.java)
        assertThat(resp.issueNumber).isEqualTo(12L)
        assertThat(resp.issueUrl).isEqualTo("https://github.com/o/r/issues/12")
        assertThat(titles.single()).isEqualTo("검색이 안 돼요")
        assertThat(labels.single()).containsExactly("type:voc")
        assertThat(bodies.single()).contains(
            "검색이 안 돼요\n자세한 설명",
            "| User ID | ${me.id} |",
            "| Username | reporter |",
            "| OS | ios 17.4 |",
            "| Device | iPhone 15 |",
        )
    }

    @Test
    fun `POST with blank content is rejected before touching GitHub`() {
        val me = newUser()
        every { githubIssueClient.enabled } returns true

        mockMvc.post("/api/voc") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(CreateVocRequest(content = "   \n "))
        }.andExpect { status { isBadRequest() } }

        verify(exactly = 0) { githubIssueClient.createIssue(any(), any(), any()) }
    }

    @Test
    fun `POST with more than 1000 chars is rejected`() {
        val me = newUser()
        every { githubIssueClient.enabled } returns true

        mockMvc.post("/api/voc") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(CreateVocRequest(content = "a".repeat(1001)))
        }.andExpect { status { isBadRequest() } }

        verify(exactly = 0) { githubIssueClient.createIssue(any(), any(), any()) }
    }

    @Test
    fun `POST returns 503 when no GitHub token is configured`() {
        val me = newUser()
        every { githubIssueClient.enabled } returns false

        mockMvc.post("/api/voc") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(CreateVocRequest(content = "hello"))
        }.andExpect { status { isServiceUnavailable() } }
    }

    @Test
    fun `POST without auth is rejected`() {
        mockMvc.post("/api/voc") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(CreateVocRequest(content = "hello"))
        }.andExpect { status { isForbidden() } }
    }
}
