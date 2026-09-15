package com.japanese.vocabulary.voc.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.github.client.GithubIssueClient
import com.japanese.vocabulary.user.dto.UserDto
import com.japanese.vocabulary.user.service.UserProfileService
import com.japanese.vocabulary.voc.dto.CreateVocRequest
import com.japanese.vocabulary.voc.dto.CreateVocResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * Turns a user's free-text report into a GitHub issue on the app repository.
 * Identity fields come from the DB, never from the request; the client only
 * supplies what the server cannot know (device, OS, bundle versions).
 */
@Service
class VocService(
    private val userProfileService: UserProfileService,
    private val githubIssueClient: GithubIssueClient,
    private val clock: Clock,
    @Value("\${voc.environment}") private val environment: String,
) {
    fun submit(userId: Long, request: CreateVocRequest): CreateVocResponse {
        val content = request.content.trim()
        if (content.isEmpty()) throw BusinessException(ErrorCode.VOC_CONTENT_REQUIRED)
        if (content.length > CONTENT_MAX_LENGTH) throw BusinessException(ErrorCode.VOC_CONTENT_TOO_LONG)
        if (!githubIssueClient.enabled) throw BusinessException(ErrorCode.VOC_UNAVAILABLE)

        val user = userProfileService.getProfile(userId)
        val issue = githubIssueClient.createIssue(
            title = buildTitle(content),
            body = buildBody(content, user, request),
            labels = listOf(LABEL),
        )
        return CreateVocResponse(issueNumber = issue.number, issueUrl = issue.htmlUrl)
    }

    /** GitHub caps titles at 256 chars and flattens newlines, so the first line (trimmed) stands in. */
    internal fun buildTitle(content: String): String {
        val firstLine = content.lineSequence().map { it.trim() }.first { it.isNotEmpty() }
        return if (firstLine.length <= TITLE_MAX_LENGTH) firstLine
        else firstLine.substring(0, TITLE_MAX_LENGTH).trimEnd() + "…"
    }

    internal fun buildBody(content: String, user: UserDto, request: CreateVocRequest): String {
        val submittedAt = ZonedDateTime.now(clock).withZoneSameInstant(KST).format(KST_FORMAT)
        val os = listOfNotNull(request.os, request.osVersion).joinToString(" ").ifBlank { null }
        val rows = listOf(
            "User ID" to user.id.toString(),
            "Username" to user.username,
            "Email" to user.email,
            "OS" to os,
            "Device" to request.device,
            "Native version" to request.nativeVersion,
            "JS version" to request.jsVersion,
            "Time (KST)" to submittedAt,
            "Environment" to environment,
        )
        return buildString {
            append(content)
            append("\n\n---\n\n")
            append("| Field | Value |\n|---|---|\n")
            rows.forEach { (label, value) -> append("| ").append(label).append(" | ").append(value ?: "-").append(" |\n") }
        }
    }

    companion object {
        const val CONTENT_MAX_LENGTH = 1000
        const val TITLE_MAX_LENGTH = 80
        const val LABEL = "type:voc"
        private val KST: ZoneId = ZoneId.of("Asia/Seoul")
        private val KST_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
    }
}
