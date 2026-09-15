package com.japanese.vocabulary.github.client

import com.japanese.vocabulary.github.client.dto.CreateGithubIssueRequest
import com.japanese.vocabulary.github.client.dto.GithubIssueDto
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

/**
 * Creates issues on a single GitHub repository with a fine-grained PAT.
 * `github.token` may be blank in local runs; callers check [enabled] and fail
 * softly instead of hitting the API unauthenticated.
 */
@Component
class GithubIssueClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${github.token:}") private val token: String,
    @Value("\${github.repository}") private val repository: String,
) {
    val enabled: Boolean = token.isNotBlank()

    private val restClient = restClientBuilder
        .baseUrl("https://api.github.com")
        .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
        .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
        .build()

    fun createIssue(title: String, body: String, labels: List<String>): GithubIssueDto {
        check(enabled) { "github.token is not configured" }
        return restClient.post()
            // `owner/repo` must stay a path, so it is spliced in rather than passed as a (percent-encoded) URI variable.
            .uri("/repos/$repository/issues")
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .contentType(MediaType.APPLICATION_JSON)
            .body(CreateGithubIssueRequest(title = title, body = body, labels = labels))
            .retrieve()
            .body(GithubIssueDto::class.java)
            ?: throw IllegalStateException("GitHub returned an empty body for issue creation")
    }
}
