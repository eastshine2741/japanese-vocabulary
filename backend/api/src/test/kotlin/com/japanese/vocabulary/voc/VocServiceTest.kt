package com.japanese.vocabulary.voc

import com.japanese.vocabulary.github.client.GithubIssueClient
import com.japanese.vocabulary.user.dto.UserDto
import com.japanese.vocabulary.user.service.UserProfileService
import com.japanese.vocabulary.voc.dto.CreateVocRequest
import com.japanese.vocabulary.voc.service.VocService
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mock.env.MockEnvironment
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class VocServiceTest {

    private val clock = Clock.fixed(Instant.parse("2026-09-13T15:04:05Z"), ZoneOffset.UTC)
    private fun serviceWithProfiles(vararg profiles: String) = VocService(
        userProfileService = mockk<UserProfileService>(),
        githubIssueClient = mockk<GithubIssueClient>(),
        clock = clock,
        springEnvironment = MockEnvironment().apply { setActiveProfiles(*profiles) },
    )
    private val service = serviceWithProfiles("dev")
    private val user = UserDto(id = 7, provider = "google", providerSub = "sub", username = "eastshine", email = "e@x.com", name = "East")

    @Test
    fun `title is the first non-empty line`() {
        assertThat(service.buildTitle("\n  \n앱이 꺼져요\n두 번째 줄")).isEqualTo("앱이 꺼져요")
    }

    @Test
    fun `title longer than 80 chars is cut with an ellipsis`() {
        val line = "가".repeat(100)

        val title = service.buildTitle(line)

        assertThat(title).isEqualTo("가".repeat(80) + "…")
    }

    @Test
    fun `title of exactly 80 chars is kept as is`() {
        val line = "a".repeat(80)
        assertThat(service.buildTitle(line)).isEqualTo(line)
    }

    @Test
    fun `body carries content followed by identity, device and KST time rows`() {
        val request = CreateVocRequest(
            content = "앱이 꺼져요",
            os = "android", osVersion = "14",
            device = "Pixel 7", nativeVersion = "1.2.1 (42)", jsVersion = "update.3",
        )

        val body = service.buildBody("앱이 꺼져요", user, request)

        assertThat(body).startsWith("앱이 꺼져요\n\n---\n\n| Field | Value |\n|---|---|\n")
        assertThat(body).contains(
            "| User ID | 7 |",
            "| Username | eastshine |",
            "| Email | e@x.com |",
            "| OS | android 14 |",
            "| Device | Pixel 7 |",
            "| Native version | 1.2.1 (42) |",
            "| JS version | update.3 |",
            "| Time (KST) | 2026-09-14 00:04:05 |",
            "| Environment | dev |",
        )
    }

    @Test
    fun `prod profile stamps prod, anything else stamps dev`() {
        val request = CreateVocRequest(content = "x")

        assertThat(serviceWithProfiles("prod").buildBody("x", user, request)).contains("| Environment | prod |")
        assertThat(serviceWithProfiles("test").buildBody("x", user, request)).contains("| Environment | dev |")
        assertThat(serviceWithProfiles().buildBody("x", user, request)).contains("| Environment | dev |")
    }

    @Test
    fun `request email overrides the account email, blank falls back`() {
        assertThat(service.buildBody("x", user, CreateVocRequest(content = "x", email = " other@y.com ")))
            .contains("| Email | other@y.com |")
        assertThat(service.buildBody("x", user, CreateVocRequest(content = "x", email = "  ")))
            .contains("| Email | e@x.com |")
    }

    @Test
    fun `missing optional fields render as a dash`() {
        val body = service.buildBody("x", user.copy(email = null), CreateVocRequest(content = "x"))

        assertThat(body).contains("| Email | - |", "| OS | - |", "| Device | - |", "| Native version | - |", "| JS version | - |")
    }
}
