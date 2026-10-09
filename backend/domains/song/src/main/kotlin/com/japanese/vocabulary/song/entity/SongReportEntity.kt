package com.japanese.vocabulary.song.entity

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.model.SongReportChange
import com.japanese.vocabulary.song.model.SongReportTarget
import com.japanese.vocabulary.song.model.SongReportType
import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

enum class SongReportStatus { PENDING, APPROVED, REJECTED }

@Entity
@Table(name = "song_reports")
@EntityListeners(AuditingEntityListener::class)
class SongReportEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "user_id", nullable = false)
    val userId: Long,
    @Column(name = "song_id", nullable = false)
    val songId: Long,
    @Column(name = "lyric_id")
    val lyricId: Long?,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    val type: SongReportType,
    @Convert(converter = SongReportTargetConverter::class)
    @Column(name = "report_target", columnDefinition = "JSON")
    val reportTarget: SongReportTarget?,
    @Column(name = "report_suggestion", columnDefinition = "TEXT")
    val reportSuggestion: String?,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: SongReportStatus = SongReportStatus.PENDING,
    @Convert(converter = SongReportChangesConverter::class)
    @Column(name = "review_changes", columnDefinition = "JSON")
    var reviewChanges: List<SongReportChange>? = null,
    @Column(name = "review_note", length = 500)
    var reviewNote: String? = null,
    @Column(name = "reviewed_at")
    var reviewedAt: Instant? = null,
    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null,
    @LastModifiedDate
    @Column(name = "updated_at")
    var updatedAt: Instant? = null,
) {
    fun approve(changes: List<SongReportChange>, note: String?, now: Instant) {
        review(SongReportStatus.APPROVED, note, now)
        reviewChanges = changes
    }

    fun reject(note: String?, now: Instant) = review(SongReportStatus.REJECTED, note, now)

    private fun review(next: SongReportStatus, note: String?, now: Instant) {
        if (status != SongReportStatus.PENDING) throw BusinessException(ErrorCode.SONG_REPORT_NOT_PENDING)
        val trimmed = note?.trim()?.takeIf { it.isNotEmpty() }
        require((trimmed?.length ?: 0) <= MAX_NOTE_LENGTH) { "note must be at most $MAX_NOTE_LENGTH characters" }
        status = next
        reviewNote = trimmed
        reviewedAt = now
    }

    companion object {
        const val MAX_NOTE_LENGTH = 500
    }
}
