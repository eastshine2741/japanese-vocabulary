package com.japanese.vocabulary.songanalysis.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

@Entity
@Table(name = "song_analysis_work")
@EntityListeners(AuditingEntityListener::class)
class SongAnalysisWorkEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "raw_title", nullable = false)
    val rawTitle: String,

    @Column(name = "raw_artist", nullable = false)
    val rawArtist: String,

    @Column(name = "duration_seconds")
    val durationSeconds: Int? = null,

    @Column(name = "artwork_url")
    val artworkUrl: String? = null,

    @Column(name = "active_dedup_key", unique = true, length = 512)
    var activeDedupKey: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: SongAnalysisWorkStatus = SongAnalysisWorkStatus.PENDING,

    @Enumerated(EnumType.STRING)
    @Column(name = "current_stage")
    var currentStage: SongAnalysisWorkStage? = null,

    @Column(name = "song_id")
    var songId: Long? = null,

    @Column(name = "lyric_id")
    var lyricId: Long? = null,

    @Column(name = "youtube_url", length = 500)
    var youtubeUrl: String? = null,

    @Column(name = "locked_by")
    var lockedBy: String? = null,

    @Column(name = "locked_until")
    var lockedUntil: Instant? = null,

    @Column(name = "error_code")
    var errorCode: String? = null,

    @Column(name = "error_message", columnDefinition = "TEXT")
    var errorMessage: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_source", nullable = false)
    val triggerSource: SongAnalysisTriggerSource,

    @Column(name = "created_by_user_id")
    val createdByUserId: Long? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,

    @Column(name = "player_ready_at")
    var playerReadyAt: Instant? = null,

    @Column(name = "completed_at")
    var completedAt: Instant? = null,

    @Column(name = "failed_at")
    var failedAt: Instant? = null,
) {
    fun clearFailure() {
        errorCode = null
        errorMessage = null
        failedAt = null
    }

    fun attachPlayerReady(songId: Long, lyricId: Long, youtubeUrl: String?, now: Instant) {
        this.songId = songId
        this.lyricId = lyricId
        this.youtubeUrl = youtubeUrl
        if (playerReadyAt == null) {
            playerReadyAt = now
        }
    }

    fun markCompleted(now: Instant) {
        status = SongAnalysisWorkStatus.COMPLETED
        currentStage = SongAnalysisWorkStage.ANALYZE_LYRICS
        activeDedupKey = null
        lockedBy = null
        lockedUntil = null
        completedAt = now
        clearFailure()
    }

    fun markFailed(code: String, message: String?, now: Instant) {
        status = SongAnalysisWorkStatus.FAILED
        activeDedupKey = null
        lockedBy = null
        lockedUntil = null
        errorCode = code
        errorMessage = message?.take(MAX_ERROR_MESSAGE_LENGTH)
        failedAt = now
    }

    companion object {
        const val MAX_ERROR_MESSAGE_LENGTH = 1000
    }
}
