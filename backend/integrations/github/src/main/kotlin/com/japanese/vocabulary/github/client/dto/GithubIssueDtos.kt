package com.japanese.vocabulary.github.client.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

data class CreateGithubIssueRequest(
    val title: String,
    val body: String,
    val labels: List<String>,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class GithubIssueDto(
    val number: Long,
    @JsonProperty("html_url") val htmlUrl: String,
)
