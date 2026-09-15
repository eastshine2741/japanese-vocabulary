package com.japanese.vocabulary.github.client

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.http.HttpStatus
import org.springframework.web.client.RestClient

class GithubIssueClientTest {

    @Test
    fun `posts the issue to the configured repository with bearer auth`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo("https://api.github.com/repos/owner/repo/issues"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Authorization", "Bearer secret-token"))
            .andExpect(header("Accept", "application/vnd.github+json"))
            .andExpect(header("X-GitHub-Api-Version", "2022-11-28"))
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.title").value("hello"))
            .andExpect(jsonPath("$.body").value("world"))
            .andExpect(jsonPath("$.labels[0]").value("type:voc"))
            .andRespond(
                withStatus(HttpStatus.CREATED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("""{"number":42,"html_url":"https://github.com/owner/repo/issues/42","state":"open"}"""),
            )
        val client = GithubIssueClient(builder, token = "secret-token", repository = "owner/repo")

        val issue = client.createIssue(title = "hello", body = "world", labels = listOf("type:voc"))

        assertThat(issue.number).isEqualTo(42L)
        assertThat(issue.htmlUrl).isEqualTo("https://github.com/owner/repo/issues/42")
        server.verify()
    }

    @Test
    fun `refuses to call GitHub when the token is blank`() {
        val client = GithubIssueClient(RestClient.builder(), token = "", repository = "owner/repo")

        assertThat(client.enabled).isFalse()
        assertThatThrownBy { client.createIssue("t", "b", emptyList()) }
            .isInstanceOf(IllegalStateException::class.java)
    }
}
