package com.japanese.vocabulary.song.dto.report

import com.japanese.vocabulary.song.model.SongReportType

data class SongReportTypeDto(
    val type: String,
    val group: String,
    val label: String,
    val targetKind: String,
    val suggestionRequired: Boolean,
    val tokenPrompt: String?,
    val suggestionPlaceholder: String,
) {
    companion object {
        fun from(type: SongReportType) = SongReportTypeDto(
            type = type.name,
            group = type.group.name,
            label = type.label,
            targetKind = type.targetKind.name,
            suggestionRequired = type.suggestionRequired,
            tokenPrompt = type.tokenPrompt,
            suggestionPlaceholder = type.suggestionPlaceholder,
        )
    }
}

/** [type] 은 문자열로 받는다. 모르는 유형을 역직렬화 오류가 아니라 SONG_REPORT_INVALID_TYPE 으로 돌려주기 위해서다. */
data class SubmitSongReportRequest(
    val type: String,
    val target: SongReportTargetRequest? = null,
    val suggestion: String? = null,
)

data class SongReportTargetRequest(
    val lineIndex: Int? = null,
    val charStart: Int? = null,
    val charEnd: Int? = null,
)

data class SubmitSongReportResponse(
    val id: Long,
    val status: String,
)

data class SongContributorsDto(
    val count: Int,
    val contributors: List<SongContributorDto>,
)

data class SongContributorDto(
    val userId: Long,
    val username: String,
    val name: String?,
    val profileImageUrl: String?,
)
